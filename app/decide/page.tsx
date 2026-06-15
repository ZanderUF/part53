import { listPathwayMetrics } from "@/db/queries";
import { EmptyState } from "@/components/EmptyState";
import { DecisionWizard } from "@/components/DecisionWizard";

export const metadata = {
  title: "Licensing pathway guide · 10 CFR Tracker",
  description: "Structure the choice between 10 CFR Part 50, 53, and 57 and weigh the tradeoffs.",
};

export default function DecidePage() {
  const metrics = listPathwayMetrics();
  if (!metrics.length) return <EmptyState />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Licensing pathway guide</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          A structured way to choose among the major reactor licensing pathways — 10 CFR Part 50
          (traditional two-step), Part 52 (one-step combined licenses), Part 53 (risk-informed,
          technology-inclusive), and Part 57 (microreactors). Set your project profile and priorities;
          the recommendation and tradeoffs update live.
        </p>
      </header>
      <DecisionWizard metrics={metrics} />
    </div>
  );
}
