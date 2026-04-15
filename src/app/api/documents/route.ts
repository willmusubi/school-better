import { NextRequest, NextResponse } from "next/server";
import { getNotebookDocuments, MAX_DOC_CHARS_IN_CONTEXT } from "@/lib/store";

export async function GET(req: NextRequest) {
  const notebookId = req.nextUrl.searchParams.get("notebookId");
  if (!notebookId) {
    return NextResponse.json({ error: "notebookId required" }, { status: 400 });
  }
  // Strip the bulky `content` from the response (we only need it server-side
  // for context assembly). Add a `truncated` flag so the UI can warn.
  const docs = getNotebookDocuments(notebookId).map((d) => ({
    id: d.id,
    notebookId: d.notebookId,
    name: d.name,
    type: d.type,
    typeLabel: d.typeLabel,
    summary: d.summary,
    pages: d.pages,
    fileType: d.fileType,
    uploadedAt: d.uploadedAt,
    status: d.status,
    contentLength: d.content.length,
    truncated: d.content.length > MAX_DOC_CHARS_IN_CONTEXT,
  }));
  return NextResponse.json(docs);
}
