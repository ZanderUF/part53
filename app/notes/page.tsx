import Link from "next/link";
import { listNotes } from "@/db/notes";
import { listSubparts } from "@/db/queries";
import { EmptyState } from "@/components/EmptyState";
import { NoteComposer } from "@/components/NoteComposer";

export default function NotesPage() {
  if (!listSubparts().length) return <EmptyState />;
  const notes = listNotes();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Notes</h1>
        <p className="mt-1 text-sm text-slate-600">
          Personal notes attached to sections, paragraphs, or requirements.
        </p>
      </header>

      <NoteComposer />

      {notes.length === 0 ? (
        <p className="text-sm text-slate-500">No notes yet. Add one above.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => {
            const linkHref =
              n.target_kind === "section"
                ? `/section/${n.target_code}`
                : n.target_kind === "paragraph"
                ? `/section/${n.target_code.split("#")[0]}#p-${n.target_code.split("#")[1] ?? ""}`
                : "#";
            return (
              <li key={n.id} className="rounded border border-slate-200 bg-white p-3">
                <div className="flex items-baseline justify-between text-xs text-slate-500">
                  <Link href={linkHref} className="xref-link">
                    {n.target_kind} · {n.target_code}
                  </Link>
                  <span>{new Date(n.updated_at).toLocaleString()}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{n.body}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
