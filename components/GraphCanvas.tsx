"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import Link from "next/link";

type GraphData = {
  subparts: Array<{ code: string; title: string }>;
  sections: Array<{ code: string; title: string; subpart_code: string }>;
  edges: Array<{ source: string; target: string; count: number }>;
};

const SUBPART_COLORS = [
  "#1e40af", "#15803d", "#b45309", "#7c3aed", "#be185d",
  "#0e7490", "#a16207", "#9f1239", "#4338ca", "#166534",
];

function colorFor(subpartCode: string, all: string[]): string {
  const idx = all.indexOf(subpartCode);
  return SUBPART_COLORS[idx % SUBPART_COLORS.length];
}

export function GraphCanvas({ parts }: { parts: string[] }) {
  const [partFilter, setPartFilter] = useState<string>(parts[0] ?? "");
  const [data, setData] = useState<GraphData | null>(null);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    const qs = partFilter ? `?part=${partFilter}` : "";
    fetch(`/api/graph${qs}`)
      .then((r) => r.json())
      .then(setData);
  }, [partFilter]);

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [] as Node[], edges: [] as Edge[] };
    const subpartCodes = data.subparts.map((s) => s.code);
    const filteredSections = filter
      ? data.sections.filter((s) => s.subpart_code === filter)
      : data.sections;
    const codeSet = new Set(filteredSections.map((s) => s.code));

    // arrange sections in a grid grouped by subpart
    const bySubpart = new Map<string, typeof filteredSections>();
    for (const s of filteredSections) {
      if (!bySubpart.has(s.subpart_code)) bySubpart.set(s.subpart_code, []);
      bySubpart.get(s.subpart_code)!.push(s);
    }
    const cols = 6;
    const colW = 160;
    const rowH = 70;
    let yCursor = 0;
    const nodes: Node[] = [];
    for (const [sp, secs] of bySubpart) {
      secs.forEach((sec, i) => {
        const x = (i % cols) * colW;
        const y = yCursor + Math.floor(i / cols) * rowH;
        nodes.push({
          id: sec.code,
          position: { x, y },
          data: {
            label: (
              <Link href={`/section/${sec.code}`} className="block text-xs">
                <div className="font-mono">§ {sec.code}</div>
                <div className="truncate text-[10px] text-slate-600" style={{ maxWidth: 130 }}>
                  {sec.title}
                </div>
              </Link>
            ),
          },
          style: {
            background: "white",
            border: `2px solid ${colorFor(sp, subpartCodes)}`,
            borderRadius: 6,
            padding: 6,
            width: 150,
          },
        });
      });
      yCursor += Math.ceil(secs.length / cols) * rowH + 30;
    }

    const edges: Edge[] = data.edges
      .filter((e) => codeSet.has(e.source) && codeSet.has(e.target))
      .map((e, i) => ({
        id: `e${i}`,
        source: e.source,
        target: e.target,
        animated: e.count > 2,
        style: { stroke: "#64748b", strokeWidth: Math.min(3, 0.5 + e.count * 0.4) },
      }));

    return { nodes, edges };
  }, [data, filter]);

  if (!data) return <div className="p-6 text-sm text-slate-500">Loading graph…</div>;

  return (
    <div className="relative h-full">
      <div className="absolute left-3 top-3 z-10 flex gap-2 rounded bg-white/90 p-2 text-xs shadow">
        {parts.length > 1 && (
          <>
            <label>Part:</label>
            <select
              value={partFilter}
              onChange={(e) => { setPartFilter(e.target.value); setFilter(""); }}
              className="rounded border border-slate-300 px-1"
            >
              <option value="">All</option>
              {parts.map((p) => (
                <option key={p} value={p}>Part {p}</option>
              ))}
            </select>
          </>
        )}
        <label>Subpart:</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded border border-slate-300 px-1"
        >
          <option value="">All</option>
          {data.subparts.map((sp) => (
            <option key={sp.code} value={sp.code}>
              {sp.code} — {sp.title}
            </option>
          ))}
        </select>
        <span className="text-slate-500">
          {nodes.length} nodes · {edges.length} edges
        </span>
      </div>
      <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable proOptions={{ hideAttribution: true }}>
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
