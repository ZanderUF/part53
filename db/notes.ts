import { getRawDb } from "./client";

export type Note = {
  id: number;
  target_kind: "paragraph" | "requirement" | "section";
  target_code: string;
  body: string;
  created_at: number;
  updated_at: number;
};

export function listNotes(): Note[] {
  return getRawDb()
    .prepare(`SELECT * FROM notes ORDER BY updated_at DESC`)
    .all() as Note[];
}

export function listNotesFor(targetKind: string, targetCode: string): Note[] {
  return getRawDb()
    .prepare(`SELECT * FROM notes WHERE target_kind = ? AND target_code = ? ORDER BY updated_at DESC`)
    .all(targetKind, targetCode) as Note[];
}

export function createNote(targetKind: string, targetCode: string, body: string): Note {
  const now = Date.now();
  const id = getRawDb()
    .prepare(
      `INSERT INTO notes (target_kind, target_code, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(targetKind, targetCode, body, now, now).lastInsertRowid as number;
  return getRawDb().prepare(`SELECT * FROM notes WHERE id = ?`).get(id) as Note;
}

export function updateNote(id: number, body: string): void {
  getRawDb()
    .prepare(`UPDATE notes SET body = ?, updated_at = ? WHERE id = ?`)
    .run(body, Date.now(), id);
}

export function deleteNote(id: number): void {
  getRawDb().prepare(`DELETE FROM notes WHERE id = ?`).run(id);
}

export function setRequirementStatus(id: number, status: string): void {
  if (!["open", "understood", "verified"].includes(status)) throw new Error("invalid status");
  getRawDb().prepare(`UPDATE requirements SET status = ? WHERE id = ?`).run(status, id);
}
