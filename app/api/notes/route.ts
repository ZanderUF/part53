import { NextRequest, NextResponse } from "next/server";
import { createNote, deleteNote, listNotes, listNotesFor, updateNote } from "@/db/notes";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind");
  const code = req.nextUrl.searchParams.get("code");
  if (kind && code) return NextResponse.json({ notes: listNotesFor(kind, code) });
  return NextResponse.json({ notes: listNotes() });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { kind: string; code: string; body: string };
  if (!body.kind || !body.code || !body.body) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const note = createNote(body.kind, body.code, body.body);
  return NextResponse.json({ note });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as { id: number; body: string };
  updateNote(body.id, body.body);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  deleteNote(id);
  return NextResponse.json({ ok: true });
}
