import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

// Override via .env.local: ANTHROPIC_MODEL=claude-opus-4-6 (or claude-haiku-4-5-20251001)
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

export const SYSTEM_PROMPT = `你是"教师百宝箱"的AI助手,专门服务于中国高中语文教师。

你的知识库来自教师上传的文档(教材、试卷、教案、教学反思等)。回答时:
1. 始终基于知识库中的内容回答,明确引用来源文档
2. 使用教师熟悉的专业术语(课标、考纲、知识点等)
3. 回答要实用、可操作,适合直接用于教学
4. 如果知识库中没有相关内容,明确说明并给出建议

你不是通用聊天机器人。你是这位教师的专属教学助手,了解他们上传的所有资料。`;
