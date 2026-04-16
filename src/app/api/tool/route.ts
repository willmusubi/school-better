import { NextRequest, NextResponse } from "next/server";
import { getLLM, getChatModel } from "@/lib/llm";
import { teacherAddressLine } from "@/lib/prompts";
import { getDocumentContext } from "@/lib/store";

const TOOL_PROMPTS: Record<string, (params: Record<string, string>) => string> =
  {
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

    "essay-grade": (params) => {
      const focus = params.focus || "综合评价";
      const essayPrompt = params.essayPrompt || "";

      const focusInstruction =
        focus === "内容立意"
          ? "请重点评价作文的中心思想、选材、题意理解和内容充实度,其他维度简要点评。"
          : focus === "语言表达"
            ? "请重点评价作文的语言流畅度、简洁性、用语规范和表现力,其他维度简要点评。"
            : focus === "结构布局"
              ? "请重点评价作文的思路、层次、结构完整性和详略安排,其他维度简要点评。"
              : "请对作文进行全面综合评价,各维度均衡分析。";

      return `你是一位经验丰富的新疆高考语文阅卷教师。请严格按照以下评分标准对学生作文进行批改。

${essayPrompt ? `作文题目/要求: ${essayPrompt}` : "（未提供作文题目,请根据作文内容判断是否切题）"}

批改侧重: ${focusInstruction}

=== 高考作文评分标准（满分60分）===

三个评分维度: 中心与材料（25分）+ 语言（25分）+ 思路与结构（10分）= 60分
五个等第: A / B / C / D / E,每个等第有基准分,在基准分上下浮动。

【A等 · 综合 60-53分 · 基准分56分】
- 中心与材料（25-22分）: 切合题意,中心突出,选材恰当,有新意,感情真挚,内容充实
- 语言（25-22分）: 语言流畅、简洁、得体,有一定的表现力
- 思路与结构（10-9分）: 思路通畅,结构完整,详略得当
- 评分细则: 基本符合三项条件得基准分56分;三项中有一项富有特色,其他两项达到B,可评为A

【B等 · 综合 52-43分 · 基准分47分】
- 中心与材料（21-18分）: 符合题意,中心明确,选材恰当,感情真实,内容较充实
- 语言（21-18分）: 语言通顺、简洁,用语规范
- 思路与结构（8-7分）: 思路连贯,层次较清楚,结构完整,能注意详略
- 评分细则: 基本符合三项条件得基准分47分;中心与材料或语言有一项较好的,酌情加分;其中一项有欠缺的,酌情减分

【C等 · 综合 42-33分 · 基准分36分】
- 中心与材料（17-14分）: 基本符合题意,中心基本明确,选材基本恰当,内容不够充实
- 语言（17-14分）: 语言基本通顺,用语基本规范
- 思路与结构（6-5分）: 思路基本清楚,结构完整,但不够合理,详略安排不够恰当
- 评分细则: 基本符合三项条件得基准分36分;其中两项较好的,酌情加分;有欠缺的,酌情减分

【D等 · 综合 32-24分 · 基准分28分】
- 中心与材料（13-11分）: 题意理解偏颇,中心不明确,选材不合理,内容空洞
- 语言（13-11分）: 语言不通顺,用语不恰当,病句比较多
- 思路与结构（4-2分）: 思路不清楚,结构不完整
- 评分细则: 基本符合三项条件得基准分28分;其中一项在C、D之间,酌情加分

【E等 · 综合 23-0分】
- 中心与材料（10-0分）: 偏离题意,无中心
- 语言（10-0分）: 词不达意,表达混乱
- 思路与结构（1-0分）: 思路混乱,结构残缺,文不成篇
- 评分细则: 严重偏离题意或有严重语病或字数不足300字,18分以下

补充扣分项（通用规则）:
- 缺标题: 扣2分
- 错别字: 每个扣1分（第3个起扣,上限5分）
- 标点错误多: 扣1至2分
- 字数不足800字: 每少50字扣1分

=== 评分标准结束 ===

输出格式要求（请严格按此结构输出）:

## 总评

**总分: X/60（等第: X等 · 基准分: X分）**

| 维度 | 得分 | 说明 |
|------|------|------|
| 中心与材料 | X/25 | 一句话概括 |
| 语言 | X/25 | 一句话概括 |
| 思路与结构 | X/10 | 一句话概括 |

## 扣分项
列出所有扣分项（错别字、标点、字数等）及扣分分值。无则注明"无扣分项"。

## 各维度详评

### 中心与材料（X/25）
给出评分理由,引用作文中的具体内容佐证。分析审题是否准确、中心是否突出、选材是否恰当。

### 语言（X/25）
给出评分理由,指出语言优点和病句（如有）,引用原文。分析语言是否流畅、简洁、得体。

### 思路与结构（X/10）
给出评分理由,分析文章的思路是否通畅、层次是否清楚、详略是否得当。

## 优点
用要点列出3-5个具体优点,每个优点引用作文原文作为例证（用引号标注原文）。

## 问题与建议
用要点列出具体问题,每个问题:
1. 指出问题所在（引用原文）
2. 说明为什么是问题
3. 给出具体修改建议

## 修改方向
总结2-3个最关键的提升方向,帮助学生下次写作时改进。`;
    },
  };

export async function POST(req: NextRequest) {
  try {
    const { tool, params, notebookId, teacherSurname } = await req.json();

    if (!tool || !TOOL_PROMPTS[tool]) {
      return NextResponse.json({ error: "Unknown tool" }, { status: 400 });
    }
    if (!notebookId) {
      return NextResponse.json(
        { error: "notebookId required" },
        { status: 400 },
      );
    }

    const { context: docContext, truncatedDocs } =
      getDocumentContext(notebookId);
    const truncationNote =
      truncatedDocs.length > 0
        ? `\n\n[系统提示] 以下文档内容超长,只取了前 8000 字: ${truncatedDocs.join(", ")}`
        : "";
    const toolPrompt = TOOL_PROMPTS[tool](params || {});
    const addressLine = teacherAddressLine(teacherSurname);
    const addressingSuffix = addressLine ? `\n\n${addressLine}` : "";

    const userContent =
      tool === "essay-grade" && params?.essay
        ? `请根据评分标准批改以下学生作文:\n\n${params.essay}`
        : "请开始生成。";

    const llm = getLLM();
    const stream = llm.streamChat({
      model: getChatModel(),
      maxTokens: tool === "essay-grade" ? 12288 : 8192,
      system: `${toolPrompt}${addressingSuffix}${truncationNote}\n\n=== 教师知识库内容 ===\n${docContext}\n=== 知识库结束 ===`,
      messages: [{ role: "user", content: userContent }],
      signal: req.signal,
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        const onAbort = () => {
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
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text })}\n\n`),
              );
            } catch {
              break;
            }
          }
        } catch (streamError) {
          const isAbort =
            (streamError as Error)?.name === "AbortError" || req.signal.aborted;
          if (!isAbort) {
            console.error("Tool stream error:", streamError);
            const msg =
              streamError instanceof Error
                ? streamError.message
                : String(streamError);
            try {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ text: `\n\n[LLM 调用失败: ${msg.slice(0, 200)}]` })}\n\n`,
                ),
              );
            } catch {
              /* closed */
            }
          }
        } finally {
          req.signal.removeEventListener("abort", onAbort);
          try {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          } catch {
            /* already closed */
          }
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
