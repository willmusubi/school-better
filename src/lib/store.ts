// File-backed store. Persists to data/store.json on every mutation.
// MVP-grade: sync writes are fine at this scale (single-user dev, tiny JSON).
// Swap for SQLite / Postgres when concurrent writers or large history become real.

import * as fs from "fs";
import * as path from "path";

// Per-doc text limit when concatenating into the model context window.
// Keep in sync with `truncated` flag returned by /api/documents.
export const MAX_DOC_CHARS_IN_CONTEXT = 8000;

export interface Notebook {
  id: string;
  title: string;
  emoji: string;
  color: string; // pastel tint for card background
  createdAt: number;
  updatedAt: number;
}

export interface Document {
  id: string;
  notebookId: string;
  name: string;
  type: "textbook" | "exam" | "lesson_plan" | "reflection" | "other";
  typeLabel: string;
  content: string;
  summary: string;
  pages: number;
  fileType: "pdf" | "doc" | "img" | "ppt";
  uploadedAt: number;
  status: "uploading" | "parsing" | "ready" | "error";
}

export interface ChatMessage {
  id: string;
  notebookId: string;
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  timestamp: number;
}

interface Snapshot {
  notebooks: [string, Notebook][];
  documents: [string, Document][];
  messages: ChatMessage[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const DEFAULT_ID = "default";

function loadSnapshot(): Snapshot | null {
  try {
    if (!fs.existsSync(DATA_FILE)) return null;
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Snapshot>;
    return {
      notebooks: parsed.notebooks || [],
      documents: parsed.documents || [],
      messages: parsed.messages || [],
    };
  } catch (err) {
    console.error("[store] failed to load store.json, starting fresh:", err);
    return null;
  }
}

const initial = loadSnapshot();
const notebooks: Map<string, Notebook> = new Map(initial?.notebooks);
const documents: Map<string, Document> = new Map(initial?.documents);
const messages: ChatMessage[] = initial?.messages ?? [];

function persist() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const snapshot: Snapshot = {
      notebooks: Array.from(notebooks.entries()),
      documents: Array.from(documents.entries()),
      messages,
    };
    // Write to temp file then rename for atomic replacement.
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2));
    fs.renameSync(tmp, DATA_FILE);
  } catch (err) {
    console.error("[store] failed to persist store.json:", err);
  }
}

// First-run seed: only inject the demo notebook when there is no file yet.
// If the user has deleted it, a restart must not resurrect it.
if (initial === null) {
  notebooks.set(DEFAULT_ID, {
    id: DEFAULT_ID,
    title: "高中语文 · 入门笔记本",
    emoji: "📚",
    color: "paper-300",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  persist();
}

// ---- Notebooks ----

export function createNotebook(data: Partial<Notebook> & { title: string }): Notebook {
  const id = Math.random().toString(36).slice(2, 10);
  const emojis = ["📚", "📖", "✍️", "🎓", "📝", "🏛️", "🌸", "🍃", "⭐", "🔖", "🏮", "🖋️"];
  const colors = ["paper-300", "zhusha-300", "dian-300", "zhu-300", "jin-300"];
  const notebook: Notebook = {
    id,
    title: data.title,
    emoji: data.emoji || emojis[Math.floor(Math.random() * emojis.length)],
    color: data.color || colors[Math.floor(Math.random() * colors.length)],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  notebooks.set(id, notebook);
  persist();
  return notebook;
}

export function getNotebook(id: string): Notebook | undefined {
  return notebooks.get(id);
}

export function getAllNotebooks(): Notebook[] {
  return Array.from(notebooks.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function deleteNotebook(id: string) {
  notebooks.delete(id);
  // cascade delete documents and messages
  for (const [docId, doc] of documents.entries()) {
    if (doc.notebookId === id) documents.delete(docId);
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].notebookId === id) messages.splice(i, 1);
  }
  persist();
}

export function updateNotebook(id: string, updates: Partial<Notebook>) {
  const nb = notebooks.get(id);
  if (nb) {
    Object.assign(nb, updates, { updatedAt: Date.now() });
    persist();
  }
}

// ---- Documents ----

export function addDocument(doc: Document) {
  documents.set(doc.id, doc);
  updateNotebook(doc.notebookId, {}); // bumps updatedAt + persists
}

export function updateDocument(id: string, updates: Partial<Document>) {
  const doc = documents.get(id);
  if (doc) {
    Object.assign(doc, updates);
    persist();
  }
}

export function getDocument(id: string): Document | undefined {
  return documents.get(id);
}

export function deleteDocument(id: string) {
  documents.delete(id);
  persist();
}

export function getNotebookDocuments(notebookId: string): Document[] {
  return Array.from(documents.values())
    .filter((d) => d.notebookId === notebookId)
    .sort((a, b) => b.uploadedAt - a.uploadedAt);
}

export function getDocumentContext(notebookId: string): {
  context: string;
  truncatedDocs: string[];
} {
  const docs = getNotebookDocuments(notebookId).filter((d) => d.status === "ready");
  if (docs.length === 0) {
    return { context: "（知识库为空,教师尚未上传任何文档）", truncatedDocs: [] };
  }
  const truncatedDocs: string[] = [];
  const context = docs
    .map((d) => {
      const truncated = d.content.length > MAX_DOC_CHARS_IN_CONTEXT;
      if (truncated) truncatedDocs.push(d.name);
      const slice = d.content.slice(0, MAX_DOC_CHARS_IN_CONTEXT);
      const note = truncated
        ? `\n[注：本文档共 ${d.content.length} 字,仅取前 ${MAX_DOC_CHARS_IN_CONTEXT} 字]\n`
        : "";
      return `=== 文档: ${d.name} (${d.typeLabel}) ===\n${slice}${note}\n`;
    })
    .join("\n");
  if (truncatedDocs.length > 0) {
    console.warn(
      `[store] knowledge-base truncated for notebook=${notebookId}: ${truncatedDocs.join(", ")}`
    );
  }
  return { context, truncatedDocs };
}

// ---- Messages ----

export function addMessage(msg: ChatMessage) {
  messages.push(msg);
  persist();
}

export function getNotebookMessages(notebookId: string): ChatMessage[] {
  return messages.filter((m) => m.notebookId === notebookId);
}

export function clearNotebookMessages(notebookId: string) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].notebookId === notebookId) messages.splice(i, 1);
  }
  persist();
}
