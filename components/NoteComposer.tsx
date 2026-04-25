"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function NoteComposer({ defaultKind = "section", defaultCode = "" }: { defaultKind?: string; defaultCode?: string }) {
  const [kind, setKind] = useState(defaultKind);
  const [code, setCode] = useState(defaultCode);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !code.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, code, body }),
      });
      setBody("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex gap-2 text-sm">
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded border border-slate-300 px-2 py-1">
          <option value="section">section</option>
          <option value="paragraph">paragraph</option>
          <option value="requirement">requirement</option>
        </select>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder='target code (e.g. "53.210" or "53.210#42")'
          className="flex-1 rounded border border-slate-300 px-2 py-1"
        />
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Your note (Markdown allowed in the future)…"
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : "Add note"}
      </button>
    </form>
  );
}
