import { NextRequest, NextResponse } from "next/server";
import { getAllNotebooks, createNotebook, getNotebookDocuments } from "@/lib/store";

export async function GET() {
  const notebooks = getAllNotebooks().map((nb) => ({
    ...nb,
    sourceCount: getNotebookDocuments(nb.id).length,
  }));
  return NextResponse.json(notebooks);
}

export async function POST(req: NextRequest) {
  const { title, emoji, color } = await req.json();
  if (!title) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }
  const notebook = createNotebook({ title, emoji, color });
  return NextResponse.json(notebook);
}
