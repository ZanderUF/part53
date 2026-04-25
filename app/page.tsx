import Link from "next/link";
import { getLatestIngest, listSubparts } from "@/db/queries";
import { EmptyState } from "@/components/EmptyState";
import { SearchBox } from "@/components/SearchBox";

export default function Home() {
  const subparts = listSubparts();
  const latest = getLatestIngest();

  if (!subparts.length) return <EmptyState />;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">10 CFR Part 53</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Risk-Informed, Technology-Inclusive Regulatory Framework for Advanced Reactors. Browse by
          subpart, search any paragraph, or jump to the requirements catalog and cross-reference graph.
        </p>
      </section>

      <SearchBox />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Subparts</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {subparts.map((sp) => (
            <li key={sp.code}>
              <Link
                href={`/subpart/${sp.code}`}
                className="block rounded border border-slate-200 bg-white p-4 hover:border-accent hover:shadow-sm"
              >
                <div className="text-xs uppercase tracking-wide text-slate-500">Subpart {sp.code}</div>
                <div className="mt-1 font-medium text-ink">{sp.title}</div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {latest && (
        <p className="text-xs text-slate-500">
          Last ingest: {latest.source_date} · {latest.subpart_count} subparts ·{" "}
          {latest.section_count} sections · {latest.paragraph_count.toLocaleString()} paragraphs
        </p>
      )}
    </div>
  );
}
