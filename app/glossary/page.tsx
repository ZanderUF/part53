import Link from "next/link";
import { getSectionById, listDefinitions, listParts } from "@/db/queries";
import { EmptyState } from "@/components/EmptyState";

export default async function GlossaryPage({
  searchParams,
}: {
  searchParams: Promise<{ part?: string }>;
}) {
  const sp = await searchParams;
  const parts = listParts();
  if (!parts.length) return <EmptyState />;
  const defs = listDefinitions(sp.part);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Glossary</h1>
        <p className="mt-1 text-sm text-slate-600">
          Defined terms extracted from Subpart A. Click a term to jump to its source paragraph.
        </p>
      </header>

      {parts.length > 1 && (
        <div className="flex gap-2 text-sm">
          <Link
            href="/glossary"
            className={`rounded border px-3 py-1 ${!sp.part ? "border-accent bg-accent/10 text-accent" : "border-slate-300"}`}
          >
            All
          </Link>
          {parts.map((p) => (
            <Link
              key={p.part_number}
              href={`/glossary?part=${p.part_number}`}
              className={`rounded border px-3 py-1 ${sp.part === p.part_number ? "border-accent bg-accent/10 text-accent" : "border-slate-300"}`}
            >
              Part {p.part_number}
            </Link>
          ))}
        </div>
      )}

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
