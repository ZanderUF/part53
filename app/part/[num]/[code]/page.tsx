import Link from "next/link";
import { notFound } from "next/navigation";
import { getSubpart, listSectionsBySubpart, partTitle } from "@/db/queries";

export default async function SubpartPage({
  params,
}: {
  params: Promise<{ num: string; code: string }>;
}) {
  const { num, code } = await params;
  const subpart = getSubpart(num, code.toUpperCase());
  if (!subpart) notFound();
  const sections = listSectionsBySubpart(subpart.id);
  const pTitle = partTitle(num);

  return (
    <div className="space-y-6">
      <nav className="text-xs text-slate-500">
        <Link href="/" className="hover:text-accent">
          Home
        </Link>{" "}
        / Part {num} / Subpart {subpart.code}
      </nav>
      <header>
        <div className="text-xs uppercase tracking-wide text-slate-500">
          Part {num} · Subpart {subpart.code}
        </div>
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
