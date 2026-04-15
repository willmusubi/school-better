import { NextRequest, NextResponse } from "next/server";
import { getNotebook, deleteNotebook, updateNotebook, getNotebookDocuments } from "@/lib/store";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const notebook = getNotebook(id);
  if (!notebook) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...notebook, sourceCount: getNotebookDocuments(id).length });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteNotebook(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const updates = await req.json();
  updateNotebook(id, updates);
  return NextResponse.json({ ok: true });
}
