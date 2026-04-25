import { listSubparts } from "@/db/queries";
import { EmptyState } from "@/components/EmptyState";
import { GraphCanvas } from "@/components/GraphCanvas";

export default function GraphPage() {
  if (!listSubparts().length) return <EmptyState />;
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Cross-reference graph</h1>
        <p className="mt-1 text-sm text-slate-600">
          Each node is a section in Part 53. Edges show internal references between sections (
          <code>§ 53.xxx</code>). Use the filter to narrow to a single subpart.
        </p>
      </header>
      <div className="h-[75vh] rounded border border-slate-200 bg-white">
        <GraphCanvas />
      </div>
    </div>
  );
}
