import { NextRequest, NextResponse } from "next/server";
import { getLLM, getFollowupModel } from "@/lib/llm";
import { getDocumentContext } from "@/lib/store";

// Note: teacherAddressLine is deliberately NOT used here. It tells the model
// to address the teacher as "X老师" — correct for the main chat's REPLIES to
// the teacher, but wrong for follow-up suggestions, which are first-person
// questions the teacher would ask next. A pill that says "赵老师, 评分标准是?"
// reads like someone asking 赵老师, not 赵老师 asking the AI.

// Generate 3 short, contextual follow-up questions after a chat exchange.
// Called client-side right after the main chat stream finishes.
//
// Uses a fast model (Haiku on Anthropic, kimi-k2-turbo-preview on Moonshot).
// FOLLOWUP_MODEL is resolved from env/defaults in @/lib/llm.

// Hard cap on how much of the last exchange we feed back in. The follow-ups
// need context, not the full transcript — and long prompts blow the latency budget.
const MAX_TURN_CHARS = 2000;

export async function POST(req: NextRequest) {
  try {
    const { notebookId, userMessage, assistantMessage } = await req.json();

    if (!notebookId || !userMessage || !assistantMessage) {
      return NextResponse.json(
        { followups: [], error: "Missing notebookId / userMessage / assistantMessage" },
        { status: 400 }
      );
    }

    const { context: docContext } = getDocumentContext(notebookId);

    const prompt = `你要为一位中国高中语文教师生成 3 个"下一句她/他可能继续问 AI 的问题"。这些问题会作为一键可发送的按钮出现在老师面前,点击后直接作为她/他的下一条消息发送给 AI 助手。

上一轮对话:

[老师发给 AI 的问题]
${String(userMessage).slice(0, MAX_TURN_CHARS)}

[AI 的回答]
${String(assistantMessage).slice(0, MAX_TURN_CHARS)}

生成 3 个追问,严格要求:
1. **视角**: 每个追问是"老师向 AI 发起的新提问",第一人称口吻。绝对不要出现"X 老师"、"请问老师"等称呼 —— 老师不会管自己叫老师。
2. **长度**: 8-20 个汉字,像真人口吻,短促利落。
3. **延续性**: 顺着 AI 刚才的回答自然延伸。刚解释了概念就追问"如何实践"、"常见误区"、"评分标准"、"例题"等。
4. **知识库引导**: 至少 1 个追问引导继续调用知识库,例如"结合我上传的教材...""在知识库里找..."。
5. **多样性**: 三个追问要走不同方向,不要全问同一件事。
6. **不要**重复刚才的问题,也不要跳到无关话题。
7. **不要**加任何解释性文字、编号或标点装饰。

严格按以下 JSON 格式返回,不要 code fence,不要其他文字:
{"followups": ["追问1", "追问2", "追问3"]}

示例(这是一段 PEEL 评价量表讲解之后的好追问):
{"followups": ["三个水平的区分标准能否更具体","结合我的教材给一个学生范文示例","学生最常卡在哪个水平"]}

供参考的知识库摘要(不必强行引用):
${docContext.slice(0, 1500)}`;

    const llm = getLLM();
    let raw = "";
    try {
      const result = await llm.createChat({
        model: getFollowupModel(),
        maxTokens: 300,
        system: "",
        messages: [{ role: "user", content: prompt }],
        signal: req.signal,
      });
      raw = result.text;
    } catch (err) {
      console.error("[followups] LLM call error:", err);
      // Graceful degradation: empty array keeps the UI quiet instead of exploding.
      return NextResponse.json({ followups: [] });
    }

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
