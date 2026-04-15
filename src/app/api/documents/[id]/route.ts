import { NextRequest, NextResponse } from "next/server";
import { getDocument, updateDocument, deleteDocument } from "@/lib/store";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = getDocument(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates = await req.json();
  // Only allow renaming for now
  if (typeof updates.name === "string" && updates.name.trim()) {
    updateDocument(id, { name: updates.name.trim() });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  deleteDocument(id);
  return NextResponse.json({ ok: true });
}
