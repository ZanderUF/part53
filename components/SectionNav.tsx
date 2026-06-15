import Link from "next/link";

type SectionRef = { code: string; title: string } | null;

export function SectionNav({ prev, next }: { prev: SectionRef; next: SectionRef }) {
  if (!prev && !next) return null;
  return (
    <nav className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
      {prev ? (
        <Link
          href={`/section/${prev.code}`}
          className="group flex flex-1 items-center gap-3 rounded-lg border border-slate-300 bg-white px-5 py-3 transition hover:border-accent hover:bg-slate-50"
        >
          <span aria-hidden className="text-2xl leading-none text-slate-400 group-hover:text-accent">
            ←
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-400">
              Previous
            </span>
            <span className="block truncate text-base font-medium text-slate-700 group-hover:text-accent">
              § {prev.code} · {prev.title}
            </span>
          </span>
        </Link>
      ) : (
        <span className="hidden flex-1 sm:block" />
      )}
      {next ? (
        <Link
          href={`/section/${next.code}`}
          className="group flex flex-1 items-center justify-end gap-3 rounded-lg border border-slate-300 bg-white px-5 py-3 text-right transition hover:border-accent hover:bg-slate-50"
        >
          <span className="min-w-0">
            <span className="block text-xs font-medium uppercase tracking-wide text-slate-400">
              Next
            </span>
            <span className="block truncate text-base font-medium text-slate-700 group-hover:text-accent">
              § {next.code} · {next.title}
            </span>
          </span>
          <span aria-hidden className="text-2xl leading-none text-slate-400 group-hover:text-accent">
            →
          </span>
        </Link>
      ) : (
        <span className="hidden flex-1 sm:block" />
      )}
    </nav>
  );
}
