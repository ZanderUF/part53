import { listParts } from "@/db/queries";
import { EmptyState } from "@/components/EmptyState";
import { GraphCanvas } from "@/components/GraphCanvas";

export default function GraphPage() {
  const parts = listParts();
  if (!parts.length) return <EmptyState />;
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Cross-reference graph</h1>
        <p className="mt-1 text-sm text-slate-600">
          Each node is a section. Edges show internal references between sections. Filter by part
          and/or subpart.
        </p>
      </header>
      <div className="h-[75vh] rounded border border-slate-200 bg-white">
        <GraphCanvas parts={parts.map((p) => p.part_number)} />
      </div>
    </div>
  );
}
