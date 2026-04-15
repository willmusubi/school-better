import { NextRequest, NextResponse } from "next/server";
import { getClient, MODEL } from "@/lib/anthropic";
import { getDocumentContext } from "@/lib/store";

const TOOL_PROMPTS: Record<string, (params: Record<string, string>) => string> = {
  quiz: (params) => {
    const count = params.count || "标准";
    const difficulty = params.difficulty || "中等";
    const topic = params.topic || "";

    return `你是一位经验丰富的高中语文教师。基于以下知识库中的教学材料,生成一套测验。

要求:
- 问题数量: ${count === "更少" ? "5-8题" : count === "更多" ? "15-20题" : "10-12题"}
- 难度等级: ${difficulty === "简单" ? "基础识记为主" : difficulty === "困难" ? "综合分析和鉴赏为主" : "基础+理解+分析混合"}
${topic ? `- 主题/范围: ${topic}` : "- 覆盖知识库中的主要内容"}

输出格式:
1. 每道题标明题号、题型(选择/填空/简答/论述)和分值
2. 选择题请提供A/B/C/D四个选项
3. 每道题后附上参考答案
4. 最后附上评分标准说明

请确保题目紧密关联知识库中的教材内容,考查重点知识点。`;
  },

  "student-sim": (params) => {
    const studentType = params.studentType || "混合";
    const topic = params.topic || "";

    return `你现在要模拟高中语文课堂上的学生提问。基于以下知识库中的教学材料,生成学生在课堂上可能提出的问题。

要求:
- 模拟学生类型: ${
      studentType === "优等生"
        ? "思维活跃、善于深入思考的学生,会提出有深度的延伸问题"
        : studentType === "中等生"
        ? "认真听讲但理解力一般的学生,会对重点难点提问"
        : studentType === "学困生"
        ? "基础薄弱的学生,会对基本概念和字词提问"
        : "混合不同水平的学生,各类问题都有"
    }
${topic ? `- 围绕主题: ${topic}` : "- 围绕知识库中的教学内容"}
- 生成8-12个学生可能提出的问题

输出格式:
每个问题前标注学生类型(如 [好奇型]、[困惑型]、[挑战型]、[基础型]),然后是问题内容。

每个问题后附上建议回答要点(帮助教师备课)。

请确保问题真实自然,像真实的高中生会提出的问题,不要太学术化。`;
  },

  "lesson-design": (params) => {
    const topic = params.topic || "";

    return `你是一位经验丰富的高中语文教研员。基于以下知识库中的教学材料,生成一份教案框架。

${topic ? `课题: ${topic}` : "请基于知识库中的教材内容,选择一个适合的课题"}

输出格式:
1. 课题名称
2. 教学目标(知识与能力/过程与方法/情感态度)
3. 教学重难点
4. 课时安排
5. 教学过程:
   - 导入(5分钟)
   - 整体感知(10分钟)
   - 深入研读(20分钟)
   - 拓展延伸(5分钟)
   - 课堂总结与作业(5分钟)
6. 板书设计
7. 教学反思预留

每个环节要有具体的教师活动和学生活动描述。`;
  },
};

export async function POST(req: NextRequest) {
  try {
    const { tool, params, notebookId } = await req.json();

    if (!tool || !TOOL_PROMPTS[tool]) {
      return NextResponse.json({ error: "Unknown tool" }, { status: 400 });
    }
    if (!notebookId) {
      return NextResponse.json({ error: "notebookId required" }, { status: 400 });
    }

    const { context: docContext, truncatedDocs } = getDocumentContext(notebookId);
    const truncationNote =
      truncatedDocs.length > 0
        ? `\n\n[系统提示] 以下文档内容超长,只取了前 8000 字: ${truncatedDocs.join(", ")}`
        : "";
    const toolPrompt = TOOL_PROMPTS[tool](params || {});

    const client = getClient();

    let stream;
    try {
      stream = await client.messages.stream(
        {
          model: MODEL,
          max_tokens: 8192,
          system: `${toolPrompt}${truncationNote}\n\n=== 教师知识库内容 ===\n${docContext}\n=== 知识库结束 ===`,
          messages: [{ role: "user", content: "请开始生成。" }],
        },
        { signal: req.signal }
      );
    } catch (apiError: unknown) {
      console.error("Claude API connection error:", apiError);
      const errMsg = apiError instanceof Error ? apiError.message : String(apiError);
      return NextResponse.json(
        { error: `Claude API连接失败: ${errMsg}` },
        { status: 502 }
      );
    }

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        const onAbort = () => {
          try {
            controller.close();
          } catch { /* already closed */ }
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
              try {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
              } catch {
                break;
              }
            }
          }
        } catch (streamError) {
          const isAbort =
            (streamError as Error)?.name === "AbortError" || req.signal.aborted;
          if (!isAbort) {
            console.error("Tool stream error:", streamError);
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: "\n\n[生成中断,请重试]" })}\n\n`)
              );
            } catch { /* closed */ }
          }
        } finally {
          req.signal.removeEventListener("abort", onAbort);
          try {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
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
    console.error("Tool route error:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
