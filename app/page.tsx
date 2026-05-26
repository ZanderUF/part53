import Link from "next/link";
import { listParts, listSubparts, getLatestIngest } from "@/db/queries";
import { EmptyState } from "@/components/EmptyState";
import { SearchBox } from "@/components/SearchBox";

export default function Home() {
  const parts = listParts();
  const latest = getLatestIngest();

  if (!parts.length) return <EmptyState />;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">10 CFR Requirements Tracker</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Decompose NRC regulations into navigable units, surface cross-references, and track
          requirements. Browse by part, search any paragraph, or jump to the requirements catalog and
          cross-reference graph.
        </p>
      </section>

      <SearchBox />

      {parts.map((part) => {
        const subparts = listSubparts(part.part_number);
        return (
          <section key={part.part_number} className="rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="text-xl font-semibold text-ink">
              10 CFR Part {part.part_number}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{part.title}</p>
            <p className="mt-1 text-xs text-slate-400">
              {part.subpart_count} subparts · {part.section_count} sections
            </p>
            <h3 className="mt-4 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Subparts
            </h3>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {subparts.map((sp) => (
                <li key={`${sp.part_number}-${sp.code}`}>
                  <Link
                    href={`/part/${sp.part_number}/${sp.code}`}
                    className="block rounded border border-slate-100 bg-slate-50 p-4 hover:border-accent hover:shadow-sm"
                  >
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      Part {sp.part_number} · Subpart {sp.code}
                    </div>
                    <div className="mt-1 font-medium text-ink">{sp.title}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {latest && (
        <p className="text-xs text-slate-500">
          Last ingest: {latest.source_date} · {latest.subpart_count} subparts ·{" "}
          {latest.section_count} sections · {latest.paragraph_count.toLocaleString()} paragraphs
        </p>
      )}
    </div>
  );
}
