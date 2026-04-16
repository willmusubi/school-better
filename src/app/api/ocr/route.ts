import { NextRequest, NextResponse } from "next/server";
import { getAnthropic } from "@/lib/llm";
import {
  effectiveProvider,
  effectiveApiKey,
  effectiveMoonshotBaseUrl,
} from "@/lib/app-settings";

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB for OCR images

const OCR_PROMPT = `这是一篇学生手写的作文。请逐字逐句完整提取图片中的所有文字内容。

要求:
- 保持原文不做任何修改或纠正,包括错别字也要原样保留
- 如有无法辨认的字,用□标注
- 保留原文的分段格式
- 如果有标题,先输出标题再输出正文
- 只输出作文内容,不要添加任何评论或说明`;

async function ocrWithAnthropic(
  base64: string,
  mediaType: string,
): Promise<string> {
  const model = process.env.ANTHROPIC_VISION_MODEL || "claude-sonnet-4-6";
  const result = await getAnthropic().messages.create({
    model,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
              data: base64,
            },
          },
          { type: "text", text: OCR_PROMPT },
        ],
      },
    ],
  });
  return result.content[0]?.type === "text" ? result.content[0].text : "";
}

async function ocrWithMoonshot(
  base64: string,
  mediaType: string,
): Promise<string> {
  const apiKey = effectiveApiKey("moonshot");
  if (!apiKey) {
    throw new Error("Moonshot API Key 未配置。请点击右上角头像 → AI 配置,填入 API Key。");
  }
  const baseUrl = effectiveMoonshotBaseUrl().replace(/\/+$/, "");
  // kimi-k2.5 is natively multimodal; kimi-k2-thinking may not support vision.
  const model = process.env.MOONSHOT_VISION_MODEL || "kimi-k2.5";
  const dataUri = `data:${mediaType};base64,${base64}`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUri } },
            { type: "text", text: OCR_PROMPT },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 1.0,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Moonshot ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "未选择文件" }, { status: 400 });
    }
    if (!IMAGE_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "仅支持 PNG、JPG、GIF、WebP 格式的图片" },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "图片大小不能超过 10 MB" },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    const provider = effectiveProvider();
    const text =
      provider === "moonshot"
        ? await ocrWithMoonshot(base64, file.type)
        : await ocrWithAnthropic(base64, file.type);

    return NextResponse.json({ text });
  } catch (err) {
    console.error("OCR error:", err);
    const msg = err instanceof Error ? err.message : "识别失败";
    if (msg.includes("API key") || msg.includes("API Key") || msg.includes("authentication")) {
      return NextResponse.json(
        { error: "API Key 未配置,请点击右上角头像 → AI 配置" },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: "图片识别失败,请重试" }, { status: 500 });
  }
}
