import Link from "next/link";

export function EmptyState({ message }: { message?: string }) {
  return (
    <div className="rounded border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
      <p className="mb-2 font-medium">No data yet.</p>
      <p className="text-sm">
        {message ??
          "Run the ingest script to fetch 10 CFR Part 53 from eCFR.gov and populate the database:"}
      </p>
      <pre className="mt-3 inline-block rounded bg-slate-100 px-3 py-2 text-left text-xs">
        npm run ingest
      </pre>
      <p className="mt-3 text-xs text-slate-600">
        If eCFR has not yet published Part 53 body content, run{" "}
        <code className="rounded bg-slate-100 px-1">npm run seed:sample</code> to populate a small
        labeled sample so you can exercise the app.
      </p>
      <p className="mt-3 text-xs">
        Then refresh, or visit{" "}
        <Link href="/" className="xref-link">
          the home page
        </Link>
        .
      </p>
    </div>
  );
}
