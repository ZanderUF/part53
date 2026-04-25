import Link from "next/link";
import { getSectionById, listDefinitions, listSubparts } from "@/db/queries";
import { EmptyState } from "@/components/EmptyState";

export default function GlossaryPage() {
  if (!listSubparts().length) return <EmptyState />;
  const defs = listDefinitions();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Glossary</h1>
        <p className="mt-1 text-sm text-slate-600">
          Defined terms extracted from Subpart A. Click a term to jump to its source paragraph.
        </p>
      </header>
      {defs.length === 0 ? (
        <p className="text-sm text-slate-600">No definitions extracted yet.</p>
      ) : (
        <dl className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
          {defs.map((d) => {
            const sec = getSectionById(d.section_id);
            return (
              <div key={d.id} className="px-4 py-3">
                <dt className="font-semibold text-ink">
                  {d.term}
                  {sec && (
                    <Link
                      href={`/section/${sec.code}#p-${d.paragraph_id}`}
                      className="ml-2 text-xs font-normal xref-link"
                    >
                      § {sec.code}
                    </Link>
                  )}
                </dt>
                <dd className="mt-1 text-sm text-slate-700">{d.text}</dd>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}
