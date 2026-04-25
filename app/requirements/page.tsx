import Link from "next/link";
import { listAllRequirements, listSubparts } from "@/db/queries";
import { EmptyState } from "@/components/EmptyState";

export default async function RequirementsPage({
  searchParams,
}: {
  searchParams: Promise<{ subpart?: string; modal?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const subparts = listSubparts();
  if (!subparts.length) return <EmptyState />;

  const reqs = listAllRequirements({
    subpartCode: sp.subpart,
    modal: sp.modal,
    status: sp.status,
  });

  const modals = ["shall", "must", "may not", "shall not", "is required to", "are required to"];
  const statuses = ["open", "understood", "verified"];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Requirements catalog</h1>
        <p className="mt-1 text-sm text-slate-600">
          Auto-extracted modal-verb statements (shall / must / may not). Filter by subpart, modal, or
          status.
        </p>
      </header>

      <form className="flex flex-wrap gap-3 text-sm">
        <FilterSelect name="subpart" current={sp.subpart} options={subparts.map((s) => ({ value: s.code, label: `Subpart ${s.code}` }))} placeholder="All subparts" />
        <FilterSelect name="modal" current={sp.modal} options={modals.map((m) => ({ value: m, label: m }))} placeholder="All modals" />
        <FilterSelect name="status" current={sp.status} options={statuses.map((m) => ({ value: m, label: m }))} placeholder="All statuses" />
        <button type="submit" className="rounded bg-accent px-3 py-1.5 text-white">
          Apply
        </button>
        <Link href="/requirements" className="rounded border border-slate-300 px-3 py-1.5">
          Reset
        </Link>
      </form>

      <p className="text-xs text-slate-500">{reqs.length.toLocaleString()} requirements</p>

      <ul className="space-y-2">
        {reqs.map((r) => (
          <li key={r.id} className="rounded border border-slate-200 bg-white p-3">
            <div className="flex items-baseline justify-between gap-3">
              <Link href={`/section/${r.section_code}#p-${r.paragraph_id}`} className="text-xs xref-link">
                § {r.section_code} — {r.section_title}
              </Link>
              <span className="text-[10px] uppercase tracking-wide text-slate-500">
                Subpart {r.subpart_code} · {r.modal} · {r.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-800">{r.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilterSelect({
  name,
  current,
  options,
  placeholder,
}: {
  name: string;
  current?: string;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
}) {
  return (
    <select
      name={name}
      defaultValue={current ?? ""}
      className="rounded border border-slate-300 bg-white px-2 py-1.5"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
