import { NextRequest, NextResponse } from "next/server";
import { getNotebookMessages, clearNotebookMessages } from "@/lib/store";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const messages = getNotebookMessages(id).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
  }));
  return NextResponse.json(messages);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  clearNotebookMessages(id);
  return NextResponse.json({ ok: true });
}
