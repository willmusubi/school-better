import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
// Vision (image OCR) stays on Anthropic — Moonshot's multimodal shape differs
// and the upgrade is out of scope here. Text classification goes through the
// provider abstraction so kimi-k2-turbo-preview works when configured.
import { getAnthropic, getLLM, getClassifyModel } from "@/lib/llm";
import { addDocument, updateDocument, type Document } from "@/lib/store";

// Hard cap to keep a malicious upload from OOMing the dev server.
// Tune via NEXT_PUBLIC_MAX_UPLOAD_MB if you need to lift it.
export const MAX_UPLOAD_BYTES =
  Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || 25) * 1024 * 1024;

// pdfjs-dist ships a worker file that Turbopack does not bundle by default.
let pdfWorkerConfigured = false;
async function configurePdfWorker() {
  if (pdfWorkerConfigured) return;
  const { PDFParse } = await import("pdf-parse");
  const workerPath = path.join(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
  );
  PDFParse.setWorker(pathToFileURL(workerPath).href);
  pdfWorkerConfigured = true;
}

// Thrown by extractText when we cannot produce usable document content.
// The outer catch turns this into status:"error" so it never pollutes the LLM context.
class ParseError extends Error {
  constructor(public userMessage: string, cause?: unknown) {
    super(userMessage);
    if (cause instanceof Error) this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
  }
}

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
    : Math.random().toString(36).slice(2, 14);

// Strip path traversal, control chars, and slashes; keep length sane.
// Falls back to "untitled" if the result is empty.
function sanitizeFilename(name: string): string {
  // Take basename to strip any directories like "../foo.pdf" or "C:\bad.pdf".
  const base = path.basename(name).replace(/[\\/]/g, "_");
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\x00-\x1f<>:"|?*]/g, "_").trim();
  const trimmed = cleaned.length > 200 ? cleaned.slice(0, 200) : cleaned;
  return trimmed || "untitled";
}

const IMAGE_MEDIA_TYPES = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
} as const;

type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[keyof typeof IMAGE_MEDIA_TYPES];

function getExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() || "";
}

function detectFileType(name: string): Document["fileType"] {
  const ext = getExt(name);
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "doc";
  if (Object.keys(IMAGE_MEDIA_TYPES).includes(ext)) return "img";
  if (["ppt", "pptx"].includes(ext)) return "ppt";
  return "doc";
}

function detectImageMediaType(name: string): ImageMediaType {
  const ext = getExt(name);
  return IMAGE_MEDIA_TYPES[ext as keyof typeof IMAGE_MEDIA_TYPES] || "image/jpeg";
}

// Dispatches on the real extension (not the coarse fileType enum) so .doc and .docx
// are handled by the right parser. Throws ParseError on failure — the outer catch
// marks the document as status:"error" instead of saving the sentinel as content.
async function extractText(buffer: Buffer, fileName: string): Promise<string> {
  const ext = getExt(fileName);

  if (ext === "pdf") {
    try {
      await configurePdfWorker();
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        const text = (result.text || "").trim();
        if (!text) throw new ParseError("PDF 中没有可提取的文本(可能是扫描件,请尝试导出为图片上传)");
        return text;
      } finally {
        await parser.destroy();
      }
    } catch (err) {
      if (err instanceof ParseError) throw err;
      console.error("[upload] PDF parse failed:", err);
      throw new ParseError("PDF 解析失败,请检查文件是否损坏", err);
    }
  }

  // Legacy Word 97-2003 binary format — mammoth can't read this, use word-extractor.
  if (ext === "doc") {
    try {
      const WordExtractor = (await import("word-extractor")).default;
      const extractor = new WordExtractor();
      const doc = await extractor.extract(buffer);
      const text = [doc.getBody(), doc.getFootnotes(), doc.getEndnotes()]
        .filter(Boolean)
        .join("\n\n")
        .trim();
      if (!text) throw new ParseError(".doc 文件中没有可提取的文本");
      return text;
    } catch (err) {
      if (err instanceof ParseError) throw err;
      console.error("[upload] .doc parse failed:", err);
      throw new ParseError(".doc 文件解析失败,建议另存为 .docx 后重新上传", err);
    }
  }

  // Modern Office + OpenDocument formats — officeparser handles all of these.
  if (["docx", "pptx", "xlsx", "odt", "odp", "ods", "rtf"].includes(ext)) {
    try {
      const { parseOffice } = await import("officeparser");
      const ast = await parseOffice(buffer);
      const text = (ast.toText?.() || "").trim();
      if (!text) throw new ParseError(`${ext.toUpperCase()} 文件中没有可提取的文本`);
      return text;
    } catch (err) {
      if (err instanceof ParseError) throw err;
      console.error(`[upload] .${ext} parse failed:`, err);
      throw new ParseError(`${ext.toUpperCase()} 文件解析失败,请检查文件是否损坏`, err);
    }
  }

  // Old PowerPoint binary .ppt — no reliable pure-JS parser. Tell the user to convert.
  if (ext === "ppt") {
    throw new ParseError("暂不支持旧版 .ppt 格式,请另存为 .pptx 后重新上传");
  }

  if (ext === "txt" || ext === "md") {
    const text = buffer.toString("utf-8").trim();
    if (!text) throw new ParseError("文件内容为空");
    return text;
  }

  // Image extraction is handled inline by the caller via Claude vision.
  if (Object.keys(IMAGE_MEDIA_TYPES).includes(ext)) {
    return `[图片文件: ${fileName}]`;
  }

  throw new ParseError(`暂不支持 .${ext} 格式`);
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const notebookId = formData.get("notebookId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!notebookId) {
    return NextResponse.json({ error: "notebookId required" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      {
        error: `文件超过 ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB 上限,请压缩或拆分后再上传。`,
      },
      { status: 413 }
    );
  }

  const safeName = sanitizeFilename(file.name);
  const id = newId();
  const fileType = detectFileType(safeName);
  const buffer = Buffer.from(await file.arrayBuffer());

  // Save file to uploads directory.
  const uploadDir = path.join(process.cwd(), "uploads");
  const filePath = path.join(uploadDir, `${id}-${safeName}`);
  await writeFile(filePath, buffer);

  // Display name: strip extension only.
  const displayName = safeName.replace(/\.[^.]+$/, "");

  const doc: Document = {
    id,
    notebookId,
    name: displayName,
    type: "other",
    typeLabel: "解析中...",
    content: "",
    summary: "正在解析文档...",
    pages: 0,
    fileType,
    uploadedAt: Date.now(),
    status: "parsing",
  };
  addDocument(doc);

  const responseDoc = { ...doc };

  // Background parsing
  (async () => {
    try {
      let textContent = "";

      if (fileType === "img") {
        const base64 = buffer.toString("base64");
        const mediaType = detectImageMediaType(safeName);
        // Vision: Anthropic only. Uses ANTHROPIC_API_KEY regardless of LLM_PROVIDER.
        const visionModel = process.env.ANTHROPIC_VISION_MODEL || "claude-sonnet-4-6";
        const visionResult = await getAnthropic().messages.create({
          model: visionModel,
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: { type: "base64", media_type: mediaType, data: base64 },
                },
                {
                  type: "text",
                  text: "请完整提取这张图片中的所有文字内容。如果是试卷,请按题目编号结构化输出。保持原文不修改。",
                },
              ],
            },
          ],
        });
        textContent = visionResult.content[0].type === "text" ? visionResult.content[0].text : "";
      } else {
        textContent = await extractText(buffer, safeName);
      }

      const llm = getLLM();
      const classifyResult = await llm.createChat({
        model: getClassifyModel(),
        maxTokens: 1024,
        system: "",
        messages: [
          {
            role: "user",
            content: `分析以下教学文档,返回JSON格式:
{
  "type": "textbook|exam|lesson_plan|reflection|other",
  "summary": "50字以内的中文摘要",
  "pages_estimate": 数字(估计页数)
}

文件名: ${safeName}
内容前2000字:
${textContent.slice(0, 2000)}

只返回JSON,不要其他文字。`,
          },
        ],
      });

      const classifyText = classifyResult.text || "{}";

      let parsed: { type?: string; summary?: string; pages_estimate?: number } = {};
      try {
        const jsonMatch = classifyText.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      } catch {
        // fallback
      }

      const typeLabels: Record<string, string> = {
        textbook: "教材",
        exam: "试卷",
        lesson_plan: "教案",
        reflection: "教学反思",
        other: "其他",
      };

      const docType = (parsed.type as Document["type"]) || "other";
      updateDocument(id, {
        type: docType,
        typeLabel: typeLabels[docType] || "其他",
        content: textContent,
        summary: parsed.summary || "文档已解析",
        pages: parsed.pages_estimate || Math.ceil(textContent.length / 1500),
        status: "ready",
      });
    } catch (err) {
      console.error("Document parsing error:", err);
      const summary =
        err instanceof ParseError
          ? err.userMessage
          : "解析失败,请重试";
      updateDocument(id, {
        status: "error",
        summary,
      });
    }
  })();

  return NextResponse.json(responseDoc);
}
