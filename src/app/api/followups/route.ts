import { NextRequest, NextResponse } from "next/server";
import { getClient, teacherAddressLine } from "@/lib/anthropic";
import { getDocumentContext } from "@/lib/store";

// Generate 3 short, contextual follow-up questions after a chat exchange.
// Called client-side right after the main chat stream finishes.
//
// Uses Haiku: this is a short, bounded task and doesn't need Sonnet's reasoning.
// Cheaper + faster = pills appear under the response within ~1s.
const FOLLOWUP_MODEL = "claude-haiku-4-5-20251001";

// Hard cap on how much of the last exchange we feed back in. The follow-ups
// need context, not the full transcript — and long prompts blow the latency budget.
const MAX_TURN_CHARS = 2000;

export async function POST(req: NextRequest) {
  try {
    const { notebookId, userMessage, assistantMessage, teacherSurname } = await req.json();

    if (!notebookId || !userMessage || !assistantMessage) {
      return NextResponse.json(
        { followups: [], error: "Missing notebookId / userMessage / assistantMessage" },
        { status: 400 }
      );
    }

    const { context: docContext } = getDocumentContext(notebookId);
    const addressLine = teacherAddressLine(teacherSurname);

    const prompt = `你刚刚和一位中国高中语文教师完成了一次对话：

老师的问题:
${String(userMessage).slice(0, MAX_TURN_CHARS)}

你的回答:
${String(assistantMessage).slice(0, MAX_TURN_CHARS)}

请基于这次对话,为老师生成 3 个简短的后续追问,让老师可以一键继续深入探讨。

要求:
1. 每个追问控制在 8-20 个汉字,像真人口吻,不要啰嗦
2. 追问要顺着刚才的回答自然延伸(例如刚解释了概念,追问"如何实践"、"常见误区"、"评分标准"等)
3. 至少 1 个追问引导老师进一步调用知识库(例如"结合我上传的教材…"、"在知识库中找…")
4. 不要重复刚才的问题,也不要提出与话题无关的方向
5. 不要加任何解释性文字或编号

${addressLine ? addressLine + "\n\n" : ""}严格按以下 JSON 格式返回,不要 code fence,不要其他文字:
{"followups": ["追问1", "追问2", "追问3"]}

供参考的知识库摘要(不必强行引用):
${docContext.slice(0, 1500)}`;

    const client = getClient();
    let result;
    try {
      result = await client.messages.create(
        {
          model: FOLLOWUP_MODEL,
          max_tokens: 300,
          messages: [{ role: "user", content: prompt }],
        },
        { signal: req.signal }
      );
    } catch (err) {
      console.error("[followups] Claude API error:", err);
      // Graceful degradation: empty array keeps the UI quiet instead of exploding.
      return NextResponse.json({ followups: [] });
    }

    const raw = result.content[0]?.type === "text" ? result.content[0].text : "";
    const match = raw.match(/\{[\s\S]*\}/);

    let followups: string[] = [];
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed.followups)) {
          followups = parsed.followups
            .filter((s: unknown): s is string => typeof s === "string")
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0 && s.length <= 60)
            .slice(0, 3);
        }
      } catch {
        // fall through to empty array
      }
    }

    return NextResponse.json({ followups });
  } catch (err) {
    console.error("[followups] route error:", err);
    return NextResponse.json({ followups: [] }, { status: 500 });
  }
}
