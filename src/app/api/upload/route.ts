import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
import { getClient, MODEL } from "@/lib/anthropic";
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

function detectFileType(name: string): Document["fileType"] {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "doc";
  if (Object.keys(IMAGE_MEDIA_TYPES).includes(ext)) return "img";
  if (["ppt", "pptx"].includes(ext)) return "ppt";
  return "doc";
}

function detectImageMediaType(name: string): ImageMediaType {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return IMAGE_MEDIA_TYPES[ext as keyof typeof IMAGE_MEDIA_TYPES] || "image/jpeg";
}

async function extractText(buffer: Buffer, fileName: string, fileType: Document["fileType"]): Promise<string> {
  if (fileType === "pdf") {
    try {
      await configurePdfWorker();
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        return result.text || "";
      } finally {
        await parser.destroy();
      }
    } catch (err) {
      console.error("[upload] PDF parse failed:", err);
      return "[PDF解析失败,请尝试其他格式]";
    }
  }

  if (fileType === "doc") {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value || "";
    } catch {
      return "[Word文档解析失败]";
    }
  }

  if (fileType === "img") {
    return `[图片文件: ${fileName}]`;
  }

  return "[不支持的文件格式]";
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
        const client = getClient();
        const visionResult = await client.messages.create({
          model: MODEL,
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
        textContent = await extractText(buffer, safeName, fileType);
      }

      const client = getClient();
      const classifyResult = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
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

      const classifyText =
        classifyResult.content[0].type === "text"
          ? classifyResult.content[0].text
          : "{}";

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
      updateDocument(id, {
        status: "error",
        summary: "解析失败,请重试",
      });
    }
  })();

  return NextResponse.json(responseDoc);
}
