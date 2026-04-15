// Shared lightweight Markdown renderer used by chat and studio tool outputs.
// Supports: #/##/### headings, **bold** lines as heading, inline **bold**,
// unordered lists (- / *), ordered lists (1. 2. ...), blockquotes (>),
// fenced code blocks (```), horizontal rules (---).
// Kept regex-based for the MVP; swap for react-markdown when we need tables.

import type { ReactNode } from "react";

type Variant = "chat" | "tool";

export function Markdown({ content, variant = "chat" }: { content: string; variant?: Variant }) {
  const isTool = variant === "tool";
  const lines = content.split("\n");
  const out: ReactNode[] = [];

  let i = 0;
  let inCode = false;
  let codeBuffer: string[] = [];
  let codeLang = "";

  const flushCode = (key: string) => {
    if (codeBuffer.length === 0 && !inCode) return;
    out.push(
      <pre
        key={key}
        className="my-2 overflow-x-auto rounded-lg border border-ink-100/60 bg-paper-100/80 px-3 py-2 font-mono text-[11.5px] leading-[1.7] text-ink-800"
        data-lang={codeLang || undefined}
      >
        <code>{codeBuffer.join("\n")}</code>
      </pre>
    );
    codeBuffer = [];
    codeLang = "";
    inCode = false;
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();

    // Fenced code block
    if (line.startsWith("```")) {
      if (!inCode) {
        inCode = true;
        codeLang = line.slice(3).trim();
      } else {
        flushCode(`code-${i}`);
      }
      i++;
      continue;
    }
    if (inCode) {
      codeBuffer.push(raw);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line)) {
      out.push(<div key={i} className="my-3 h-px bg-ink-100/60" />);
      i++;
      continue;
    }

    // Headings (# / ## / ###)
    const h = /^(#{1,3})\s+(.+)$/.exec(line);
    if (h) {
      out.push(
        <h4
          key={i}
          className={`mt-4 mb-1.5 flex items-center gap-2 font-serif font-semibold text-ink-900 first:mt-0 ${
            isTool ? "text-[13px]" : "text-[14px]"
          }`}
        >
          <span className="inline-block h-3.5 w-0.5 rounded-full bg-zhusha-500" />
          {stripBold(h[2])}
        </h4>
      );
      i++;
      continue;
    }

    // Bold-only line as heading
    if (/^\*\*[^*]+\*\*$/.test(line)) {
      out.push(
        <h4
          key={i}
          className={`mt-3 mb-1 font-serif font-semibold text-ink-800 ${
            isTool ? "text-[13px]" : "text-[13px]"
          }`}
        >
          {stripBold(line)}
        </h4>
      );
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      out.push(
        <blockquote
          key={i}
          className="my-1 border-l-2 border-zhusha-500/40 pl-3 text-[13px] leading-[1.9] text-ink-600"
        >
          {renderInline(line.replace(/^>\s?/, ""))}
        </blockquote>
      );
      i++;
      continue;
    }

    // Unordered list — collect consecutive items
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      out.push(
        <ul key={`ul-${i}`} className="my-1 space-y-0.5 pl-4">
          {items.map((it, k) => (
            <li
              key={k}
              className={`relative text-ink-700 ${isTool ? "text-[12px] leading-[1.8]" : "text-[13px] leading-[1.9]"}`}
            >
              <span className="absolute -left-3 top-0 text-zhusha-500">·</span>
              {renderInline(it)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      out.push(
        <ol key={`ol-${i}`} className="my-1 list-decimal space-y-0.5 pl-5">
          {items.map((it, k) => (
            <li
              key={k}
              className={`text-ink-700 marker:text-zhusha-500 marker:font-medium ${
                isTool ? "text-[12px] leading-[1.8]" : "text-[13px] leading-[1.9]"
              }`}
            >
              {renderInline(it)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty line
    if (line === "") {
      out.push(<div key={i} className="h-2" />);
      i++;
      continue;
    }

    // Paragraph
    out.push(
      <p
        key={i}
        className={`mb-1 text-ink-700 ${isTool ? "text-[12px] leading-[1.8]" : "text-[13px] leading-[1.9]"}`}
      >
        {renderInline(raw)}
      </p>
    );
    i++;
  }

  if (inCode) flushCode("code-final");

  return <>{out}</>;
}

function stripBold(s: string) {
  return s.replace(/\*\*/g, "");
}

function renderInline(text: string): ReactNode[] {
  // Handles **bold** and `inline code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, j) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={j} className="font-medium text-ink-800">
          {part.replace(/\*\*/g, "")}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={j}
          className="rounded bg-paper-200 px-1 py-0.5 font-mono text-[11.5px] text-zhusha-700"
        >
          {part.replace(/`/g, "")}
        </code>
      );
    }
    return <span key={j}>{part}</span>;
  });
}
