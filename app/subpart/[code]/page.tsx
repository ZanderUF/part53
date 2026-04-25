import Link from "next/link";
import { notFound } from "next/navigation";
import { getSubpart, listSectionsBySubpart } from "@/db/queries";

export default async function SubpartPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const subpart = getSubpart(code.toUpperCase());
  if (!subpart) notFound();
  const sections = listSectionsBySubpart(subpart.id);

  return (
    <div className="space-y-6">
      <nav className="text-xs text-slate-500">
        <Link href="/" className="hover:text-accent">
          Part 53
        </Link>{" "}
        / Subpart {subpart.code}
      </nav>
      <header>
        <div className="text-xs uppercase tracking-wide text-slate-500">Subpart {subpart.code}</div>
        <h1 className="mt-1 text-2xl font-semibold">{subpart.title}</h1>
      </header>
      <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
        {sections.map((s) => (
          <li key={s.code}>
            <Link
              href={`/section/${s.code}`}
              className="flex items-baseline gap-3 px-4 py-3 hover:bg-slate-50"
            >
              <span className="font-mono text-sm text-slate-600">§ {s.code}</span>
              <span className="text-ink">{s.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
