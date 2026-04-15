// Prompt text and prompt-building helpers. Intentionally provider-agnostic —
// just strings, no SDK imports.

export const SYSTEM_PROMPT = `你是"教师百宝箱"的AI助手,专门服务于中国高中语文教师。

你的知识库来自教师上传的文档(教材、试卷、教案、教学反思等)。回答时:
1. 始终基于知识库中的内容回答,明确引用来源文档
2. 使用教师熟悉的专业术语(课标、考纲、知识点等)
3. 回答要实用、可操作,适合直接用于教学
4. 如果知识库中没有相关内容,明确说明并给出建议

你不是通用聊天机器人。你是这位教师的专属教学助手,了解他们上传的所有资料。`;

/**
 * Turn a raw surname string into a directive we can append to the system prompt.
 * Returns "" when the input is unusable, so callers can safely do `prompt + addressLine`.
 */
export function teacherAddressLine(surname: unknown): string {
  if (typeof surname !== "string") return "";
  const first = Array.from(surname.trim())[0];
  if (!first) return "";
  if (!/^[\u4e00-\u9fffA-Za-z]$/.test(first)) return "";
  return `称呼要求:这位老师姓"${first}",请在回答中自然地以"${first}老师"称呼对方,不要询问姓名。`;
}
