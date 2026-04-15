import { NextRequest, NextResponse } from "next/server";
import { getLLM, getChatModel } from "@/lib/llm";
import { SYSTEM_PROMPT, teacherAddressLine } from "@/lib/prompts";
import { getDocumentContext, addMessage } from "@/lib/store";

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

export async function POST(req: NextRequest) {
  try {
    const { message, notebookId, teacherSurname } = await req.json();
    if (!message || !notebookId) {
      return NextResponse.json({ error: "Missing message or notebookId" }, { status: 400 });
    }
    const addressLine = teacherAddressLine(teacherSurname);

    // Save user message
    addMessage({
      id: newId(),
      notebookId,
      role: "user",
      content: message,
      timestamp: Date.now(),
    });

    const { context: docContext, truncatedDocs } = getDocumentContext(notebookId);
    const truncationNote =
      truncatedDocs.length > 0
        ? `\n\n[系统提示] 以下文档因长度超限只取了前 8000 字, 如答案不完整请提示用户分段提问: ${truncatedDocs.join(", ")}`
        : "";
    const systemWithContext = `${SYSTEM_PROMPT}${addressLine ? `\n\n${addressLine}` : ""}${truncationNote}\n\n=== 教师知识库内容 ===\n${docContext}\n=== 知识库结束 ===`;

    const llm = getLLM();
    // The provider may throw before any chunk is produced (bad auth, network,
    // misconfig). We only get a stream-like async iterable here — actual HTTP
    // calls happen inside the for-await loop below. Errors from there are
    // caught by the stream error branch.
    const stream = llm.streamChat({
      model: getChatModel(),
      maxTokens: 4096,
      system: systemWithContext,
      messages: [{ role: "user", content: message }],
      signal: req.signal,
    });

    const encoder = new TextEncoder();
    let fullResponse = "";

    const persistAssistant = (extraSuffix = "") => {
      const finalContent = fullResponse + extraSuffix;
      if (!finalContent.trim()) return;
      addMessage({
        id: newId(),
        notebookId,
        role: "assistant",
        content: finalContent,
        timestamp: Date.now(),
      });
    };

    const readable = new ReadableStream({
      async start(controller) {
        const onAbort = () => {
          // Client disconnected; persist whatever we got so it survives reload.
          persistAssistant("\n\n[已停止生成]");
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        };
        req.signal.addEventListener("abort", onAbort, { once: true });

        try {
          for await (const { text } of stream) {
            if (req.signal.aborted) break;
            fullResponse += text;
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
              );
            } catch {
              // Controller already closed (client gone).
              break;
            }
          }

          if (!req.signal.aborted) {
            persistAssistant();
            try {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            } catch { /* closed */ }
          }
        } catch (streamError) {
          const isAbort =
            (streamError as Error)?.name === "AbortError" || req.signal.aborted;
          if (isAbort) {
            persistAssistant("\n\n[已停止生成]");
          } else {
            console.error("Stream error:", streamError);
            const msg = streamError instanceof Error ? streamError.message : String(streamError);
            const hint = `\n\n[LLM 调用失败: ${msg.slice(0, 200)}]`;
            // Save what we have so it doesn't vanish on reload.
            persistAssistant(hint);
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: hint })}\n\n`)
              );
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            } catch { /* closed */ }
          }
        } finally {
          req.signal.removeEventListener("abort", onAbort);
          try {
            controller.close();
          } catch { /* already closed */ }
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("Chat route error:", err);
    return NextResponse.json(
      { error: "服务器内部错误" },
      { status: 500 }
    );
  }
}
