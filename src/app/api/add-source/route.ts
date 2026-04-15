import { NextRequest, NextResponse } from "next/server";
import { getLLM, getClassifyModel } from "@/lib/llm";
import { addDocument, updateDocument, type Document } from "@/lib/store";

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

async function fetchUrl(url: string): Promise<{ title: string; text: string }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; JiaoshiBaobaoxiang/1.0)",
    },
    signal: AbortSignal.timeout(15000),
  });
  const html = await res.text();

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : url;

  // Strip HTML tags, scripts, styles
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  // Limit to 50KB of text
  if (text.length > 50000) text = text.slice(0, 50000) + "\n\n[内容过长已截断]";

  return { title, text };
}

async function classifyAndSummarize(
  name: string,
  textContent: string
): Promise<{ type: Document["type"]; typeLabel: string; summary: string; pages: number }> {
  const llm = getLLM();
  const classifyResult = await llm.createChat({
    model: getClassifyModel(),
    maxTokens: 1024,
    system: "",
    messages: [
      {
        role: "user",
        content: `分析以下教学内容,返回JSON格式:
{
  "type": "textbook|exam|lesson_plan|reflection|other",
  "summary": "50字以内的中文摘要",
  "pages_estimate": 数字(估计页数)
}

标题: ${name}
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
  } catch { /* ignore */ }

  const typeLabels: Record<string, string> = {
    textbook: "教材",
    exam: "试卷",
    lesson_plan: "教案",
    reflection: "教学反思",
    other: "其他",
  };

  const docType = (parsed.type as Document["type"]) || "other";
  return {
    type: docType,
    typeLabel: typeLabels[docType] || "其他",
    summary: parsed.summary || "已添加到知识库",
    pages: parsed.pages_estimate || Math.ceil(textContent.length / 1500),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { type, notebookId, urls, text } = await req.json();

    if (!notebookId) {
      return NextResponse.json({ error: "notebookId required" }, { status: 400 });
    }

    if (type === "urls") {
      if (!Array.isArray(urls) || urls.length === 0) {
        return NextResponse.json({ error: "urls required" }, { status: 400 });
      }

      const docs: Document[] = [];
      for (const url of urls) {
        const id = genId();
        const doc: Document = {
          id,
          notebookId,
          name: url,
          type: "other",
          typeLabel: "解析中...",
          content: "",
          summary: "正在抓取网页内容...",
          pages: 0,
          fileType: "doc",
          uploadedAt: Date.now(),
          status: "parsing",
        };
        addDocument(doc);
        docs.push(doc);

        // Background fetch & parse
        (async () => {
          try {
            const { title, text: pageText } = await fetchUrl(url);
            const classification = await classifyAndSummarize(title, pageText);
            updateDocument(id, {
              name: title,
              content: pageText,
              ...classification,
              status: "ready",
            });
          } catch (err) {
            console.error("URL fetch error:", err);
            updateDocument(id, {
              status: "error",
              summary: "网页抓取失败",
            });
          }
        })();
      }

      return NextResponse.json({ docs });
    }

    if (type === "text") {
      if (!text || typeof text !== "string") {
        return NextResponse.json({ error: "text required" }, { status: 400 });
      }

      const id = genId();
      // Use first line as name, or first 30 chars
      const firstLine = text.split("\n").find((l) => l.trim()) || "";
      const name = firstLine.slice(0, 30).trim() || `文本片段 ${new Date().toLocaleString("zh-CN")}`;

      const doc: Document = {
        id,
        notebookId,
        name,
        type: "other",
        typeLabel: "解析中...",
        content: text,
        summary: "正在分析...",
        pages: 0,
        fileType: "doc",
        uploadedAt: Date.now(),
        status: "parsing",
      };
      addDocument(doc);

      // Background classify
      (async () => {
        try {
          const classification = await classifyAndSummarize(name, text);
          updateDocument(id, {
            ...classification,
            status: "ready",
          });
        } catch (err) {
          console.error("Text parse error:", err);
          updateDocument(id, {
            status: "error",
            summary: "分析失败",
          });
        }
      })();

      return NextResponse.json({ doc });
    }

    return NextResponse.json({ error: "Unknown type" }, { status: 400 });
  } catch (err) {
    console.error("Add source error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
