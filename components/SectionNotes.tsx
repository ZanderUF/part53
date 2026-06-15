"use client";
import { useState } from "react";

type Note = {
  id: number;
  target_kind: string;
  target_code: string;
  body: string;
  created_at: number;
  updated_at: number;
};

export function SectionNotes({
  targetKind = "section",
  targetCode,
  initialNotes,
}: {
  targetKind?: string;
  targetCode: string;
  initialNotes: Note[];
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: targetKind, code: targetCode, body: draft.trim() }),
      });
      const { note } = (await res.json()) as { note: Note };
      setNotes((prev) => [note, ...prev]);
      setDraft("");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: number) {
    if (!editBody.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, body: editBody.trim() }),
      });
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, body: editBody.trim(), updated_at: Date.now() } : n)),
      );
      setEditingId(null);
      setEditBody("");
    } finally {
      setBusy(false);
    }
  }

  async function removeNote(id: number) {
    setBusy(true);
    try {
      await fetch(`/api/notes?id=${id}`, { method: "DELETE" });
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Notes ({notes.length})</h2>

      <form onSubmit={addNote} className="rounded border border-slate-200 bg-white p-4 space-y-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder={`Add a note for § ${targetCode}…`}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="rounded bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Add note"}
        </button>
      </form>

      {notes.length > 0 && (
        <ul className="mt-3 space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded border border-slate-200 bg-white p-3">
              <div className="flex items-baseline justify-between text-xs text-slate-500">
                <span>{new Date(n.updated_at).toLocaleString()}</span>
                <div className="flex gap-3">
                  {editingId === n.id ? (
                    <>
                      <button
                        onClick={() => saveEdit(n.id)}
                        disabled={busy}
                        className="text-accent hover:underline disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditBody("");
                        }}
                        className="hover:underline"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(n.id);
                          setEditBody(n.body);
                        }}
                        className="hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removeNote(n.id)}
                        disabled={busy}
                        className="text-red-600 hover:underline disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
              {editingId === n.id ? (
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
              ) : (
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{n.body}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
