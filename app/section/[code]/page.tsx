import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSection,
  listAllSectionCodes,
  listIncomingXrefs,
  listParagraphs,
  listRequirementsForSection,
  listSectionsBySubpart,
  listSubparts,
  listXrefsBySection,
} from "@/db/queries";
import { ParagraphRenderer } from "@/components/ParagraphRenderer";

export default async function SectionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const section = getSection(code);
  if (!section) notFound();

  const subpart = listSubparts().find((sp) => sp.id === section.subpart_id) ?? null;
  const siblings = subpart ? listSectionsBySubpart(subpart.id) : [];
  const paragraphs = listParagraphs(section.id);
  const requirements = listRequirementsForSection(section.id);
  const outgoing = listXrefsBySection(section.id);
  const incoming = listIncomingXrefs(section.code);
  const knownSectionCodes = new Set(listAllSectionCodes());

  return (
    <div className="space-y-8">
      <nav className="text-xs text-slate-500">
        <Link href="/" className="hover:text-accent">
          Part 53
        </Link>{" "}
        /{" "}
        {subpart && (
          <Link href={`/subpart/${subpart.code}`} className="hover:text-accent">
            Subpart {subpart.code}
          </Link>
        )}{" "}
        / § {section.code}
      </nav>

      <header className="flex items-start justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">§ {section.code}</div>
          <h1 className="mt-1 text-2xl font-semibold">{section.title}</h1>
        </div>
        <a
          href={`https://www.ecfr.gov/current/title-10/chapter-I/part-53/section-${section.code}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs xref-link"
        >
          View on eCFR.gov →
        </a>
      </header>

      <article className="rounded border border-slate-200 bg-white p-6">
        <ParagraphRenderer paragraphs={paragraphs} knownSectionCodes={knownSectionCodes} />
      </article>

      {requirements.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Auto-extracted requirements ({requirements.length})
          </h2>
          <ul className="space-y-2">
            {requirements.map((r) => (
              <li
                key={r.id}
                className="rounded border border-slate-200 bg-white p-3 text-sm text-slate-800"
              >
                <span className="mr-2 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs uppercase tracking-wide text-slate-600">
                  {r.modal}
                </span>
                {r.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
            References out ({outgoing.length})
          </h2>
          <ul className="space-y-1 text-sm">
            {outgoing.length === 0 && <li className="text-slate-400">None.</li>}
            {outgoing.map((x) => (
              <li key={x.id}>
                {x.target_kind === "section" && x.target_section_code && knownSectionCodes.has(x.target_section_code) ? (
                  <Link href={`/section/${x.target_section_code}`} className="xref-link">
                    {x.target_label}
                  </Link>
                ) : (
                  <span className="text-slate-700">{x.target_label}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
            Referenced by ({incoming.length})
          </h2>
          <ul className="space-y-1 text-sm">
            {incoming.length === 0 && <li className="text-slate-400">None.</li>}
            {incoming.map((x) => (
              <li key={x.id}>
                <Link href={`/section/${x.source_section_code}`} className="xref-link">
                  § {x.source_section_code}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {siblings.length > 1 && (
        <nav className="flex justify-between border-t border-slate-200 pt-4 text-sm">
          {(() => {
            const idx = siblings.findIndex((s) => s.code === section.code);
            const prev = idx > 0 ? siblings[idx - 1] : null;
            const next = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
            return (
              <>
                {prev ? (
                  <Link href={`/section/${prev.code}`} className="xref-link">
                    ← § {prev.code}
                  </Link>
                ) : (
                  <span />
                )}
                {next ? (
                  <Link href={`/section/${next.code}`} className="xref-link">
                    § {next.code} →
                  </Link>
                ) : (
                  <span />
                )}
              </>
            );
          })()}
        </nav>
      )}
    </div>
  );
}
