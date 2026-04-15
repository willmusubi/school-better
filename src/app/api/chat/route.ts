import { NextRequest, NextResponse } from "next/server";
import { getClient, MODEL, SYSTEM_PROMPT } from "@/lib/anthropic";
import { getDocumentContext, addMessage } from "@/lib/store";

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

export async function POST(req: NextRequest) {
  try {
    const { message, notebookId } = await req.json();
    if (!message || !notebookId) {
      return NextResponse.json({ error: "Missing message or notebookId" }, { status: 400 });
    }

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
    const systemWithContext = `${SYSTEM_PROMPT}${truncationNote}\n\n=== 教师知识库内容 ===\n${docContext}\n=== 知识库结束 ===`;

    const client = getClient();

    let stream;
    try {
      stream = await client.messages.stream(
        {
          model: MODEL,
          max_tokens: 4096,
          system: systemWithContext,
          messages: [{ role: "user", content: message }],
        },
        // Forward client disconnect to Anthropic so we stop burning tokens.
        { signal: req.signal }
      );
    } catch (apiError: unknown) {
      console.error("Claude API connection error:", apiError);
      const errMsg = apiError instanceof Error ? apiError.message : String(apiError);
      return NextResponse.json(
        { error: `Claude API连接失败: ${errMsg}. 请检查API Key和网络代理设置。` },
        { status: 502 }
      );
    }

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
          for await (const event of stream) {
            if (req.signal.aborted) break;
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const text = event.delta.text;
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
            // Save what we have so it doesn't vanish on reload.
            persistAssistant("\n\n[流式传输中断,请重试]");
            try {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ text: "\n\n[流式传输中断,请重试]" })}\n\n`
                )
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
