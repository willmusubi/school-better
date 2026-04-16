import { NextRequest, NextResponse } from "next/server";
import { getLLM, getChatModel } from "@/lib/llm";
import { teacherAddressLine } from "@/lib/prompts";
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

  "essay-grade": (params) => {
    const focus = params.focus || "综合评价";
    const essayPrompt = params.essayPrompt || "";

    const focusInstruction =
      focus === "内容立意"
        ? "请重点评价作文的立意、审题、中心思想和内容充实度,其他维度简要点评。"
        : focus === "语言表达"
        ? "请重点评价作文的语言运用、文采、句式和修辞手法,其他维度简要点评。"
        : focus === "结构布局"
        ? "请重点评价作文的结构安排、层次逻辑、段落衔接和文体特征,其他维度简要点评。"
        : "请对作文进行全面综合评价,各维度均衡分析。";

    return `你是一位经验丰富的高考语文阅卷教师。请严格按照以下全国卷高考作文评分标准对学生作文进行批改。

${essayPrompt ? `作文题目/要求: ${essayPrompt}` : "（未提供作文题目,请根据作文内容判断是否切题）"}

批改侧重: ${focusInstruction}

=== 高考作文评分标准（满分60分）===

一、基础等级（40分）

【内容（20分）】
| 等级 | 分数 | 标准 |
|一等|20-17|切合题意、中心突出、内容充实、思想健康、感情真挚|
|二等|16-12|符合题意、中心明确、内容较充实、思想健康、感情真实|
|三等|11-7|基本符合题意、中心基本明确、内容单薄、思想基本健康、感情基本真实|
|四等|6-0|偏离题意、中心不明确或立意不当、内容不当、思想不健康、感情虚假|

【表达（20分）】
| 等级 | 分数 | 标准 |
|一等|20-17|符合文体要求、结构严谨、语言流畅、字迹工整|
|二等|16-12|符合文体要求、结构完整、语言通顺、字迹清楚|
|三等|11-7|基本符合文体要求、结构基本完整、语言基本通顺、字迹基本清楚|
|四等|6-0|不符合文体要求、结构混乱、语言不通顺语病多、字迹潦草难辨|

二、发展等级（20分）
| 等级 | 分数 | 标准 |
|一等|20-17|深刻、丰富、有文采、有创意|
|二等|16-12|较深刻、较丰富、较有文采、较有创新|
|三等|11-7|略显深刻、略显丰富、略有文采、略显创新|
|四等|6-0|个别语句有深意、个别细节较好、个别语句较精彩、略显个性|

发展等级评价维度:
- 深刻: 透过现象深入本质、揭示事物因果关系、观点具有启发作用
- 丰富: 材料丰富、论据充实、形象丰满、意境深远
- 有文采: 用词贴切、句式灵活、善于运用修辞手法、文句有表现力
- 有创意: 见解新颖、材料新鲜、构思新巧、推理想象有独到之处、有个性色彩

三、评分原则
- 表达项评分不得跨越内容等级（如内容三等,表达只能在二等到四等之间）
- 发展等级分不能跨越基础等级的得分等级
- 内容四等时,发展等级最多给1-2分
- "文体特征不明"上限36分;"文体不合要求"上限30分
- 语言流畅=无语病;通顺=允许2个左右病句;基本通顺=允许3个不通顺句子
- 6个以上病句视为"语言不通顺"

四、扣分项
- 缺标题: 扣2分
- 错别字: 每个扣1分（第3个起扣,上限5分）
- 标点错误多: 扣1至2分
- 字数不足800字: 每少50字扣1分
- 字数不足600字: 总分控制在36分以下
- 字数不足400字: 总分控制在20分以下
- 套作: 总分不超过20分
- 抄袭: 基础等级在四等以内,发展等级不给分

=== 评分标准结束 ===

输出格式要求（请严格按此结构输出）:

## 总评

**总分: X/60**

| 维度 | 得分 | 等级 |
|------|------|------|
| 内容 | X/20 | X等 |
| 表达 | X/20 | X等 |
| 发展等级 | X/20 | X等 |

## 扣分项
列出所有扣分项（错别字、标点、字数等）及扣分分值。无则注明"无扣分项"。

## 各维度详评

### 内容（X/20）
给出评分理由,引用作文中的具体内容佐证。

### 表达（X/20）
给出评分理由,指出语言优点和病句（如有）,引用原文。

### 发展等级（X/20）
说明在深刻/丰富/文采/创意四个维度的表现,引用原文佐证。

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
      return NextResponse.json({ error: "notebookId required" }, { status: 400 });
    }

    const { context: docContext, truncatedDocs } = getDocumentContext(notebookId);
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
          } catch { /* already closed */ }
        };
        req.signal.addEventListener("abort", onAbort, { once: true });

        try {
          for await (const { text } of stream) {
            if (req.signal.aborted) break;
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            } catch {
              break;
            }
          }
        } catch (streamError) {
          const isAbort =
            (streamError as Error)?.name === "AbortError" || req.signal.aborted;
          if (!isAbort) {
            console.error("Tool stream error:", streamError);
            const msg = streamError instanceof Error ? streamError.message : String(streamError);
            try {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ text: `\n\n[LLM 调用失败: ${msg.slice(0, 200)}]` })}\n\n`
                )
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
