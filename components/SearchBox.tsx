"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Hit = {
  id: number;
  designator: string | null;
  text_plain: string;
  section_code: string;
  section_title: string;
  part_number: string;
  snippet: string;
};

export function SearchBox() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!q.trim()) {
      setHits([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setHits(json.hits ?? []);
      } finally {
        setLoading(false);
      }
    }, 200);
  }, [q]);

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search Part 53 (e.g. design features, PRA, siting)…"
        className="w-full rounded border border-slate-300 bg-white px-4 py-2 text-base shadow-sm focus:border-accent focus:outline-none"
      />
      {loading && <div className="text-xs text-slate-500">Searching…</div>}
      {hits.length > 0 && (
        <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-white">
          {hits.map((h) => (
            <li key={h.id} className="p-3 hover:bg-slate-50">
              <Link href={`/section/${h.section_code}#p-${h.id}`}>
                <div className="text-xs text-slate-500">
                  Part {h.part_number} · § {h.section_code} — {h.section_title}
                </div>
                <div
                  className="mt-1 text-sm text-ink"
                  dangerouslySetInnerHTML={{ __html: h.snippet }}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
