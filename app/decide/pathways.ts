// Curated decision model for the licensing-pathway wizard. The 1–5 base scores
// are expert-judgment starting points (the user re-weights them); the rationale
// is qualitative so it never drifts from the loaded regulations, while the live
// metrics shown alongside come straight from the database.
//
// Pure data + functions only — safe to import from a client component.

export type CriterionKey = "certainty" | "techfit" | "ease" | "schedule" | "operational";

export const CRITERIA: { key: CriterionKey; label: string; help: string }[] = [
  {
    key: "certainty",
    label: "Regulatory certainty & precedent",
    help: "Depth of precedent, published guidance (SRP, Reg Guides), and predictable review.",
  },
  {
    key: "techfit",
    label: "Flexibility & technology fit",
    help: "How well the framework accommodates your reactor technology and design choices.",
  },
  {
    key: "ease",
    label: "Ease of demonstrating compliance",
    help: "Lower analytical burden — prescriptive criteria vs. building a risk/PRA-based safety case.",
  },
  {
    key: "schedule",
    label: "Schedule predictability",
    help: "Confidence in the licensing timeline; exposure to first-of-a-kind review delays.",
  },
  {
    key: "operational",
    label: "Operational & lifecycle fit",
    help: "Staffing, security scaling, standardization, and fleet deployment.",
  },
];

export type PathwayId = "50" | "52" | "53" | "57";

// A concrete provision that compresses or front-loads NRC review for this pathway.
export type ScheduleLever = { label: string; detail: string; href?: string };

export type Pathway = {
  id: PathwayId;
  name: string;
  tagline: string;
  base: Record<CriterionKey, number>;
  why: Record<CriterionKey, string>;
  levers: ScheduleLever[];
};

export const PATHWAYS: Pathway[] = [
  {
    id: "50",
    name: "Part 50",
    tagline: "Traditional two-step licensing",
    base: { certainty: 5, techfit: 2, ease: 4, schedule: 4, operational: 2 },
    why: {
      certainty: "Decades of precedent, the Standard Review Plan (NUREG-0800), Reg Guides, and case law.",
      techfit: "Prescriptive and LWR-centric (Appendix A design criteria, Appendix K ECCS); non-LWRs need exemptions.",
      ease: "Compliance is largely measured against explicit, prescriptive criteria rather than a bespoke safety case.",
      schedule:
        "Predictable thanks to deep precedent, but slow: two sequential reviews (Construction Permit then Operating License) with full environmental review each time, and few built-in accelerators (standardization and combined licenses live in Part 52).",
      operational: "Rigid staffing and security requirements with limited risk-informed scaling.",
    },
    levers: [
      {
        label: "Limited Work Authorization (LWA)",
        detail: "Begin foundation-level safety construction before the construction permit, after a focused safety + environmental review.",
        href: "/section/50.10",
      },
      {
        label: "Standardized designs at multiple sites",
        detail: "Appendix N permits construction/operation of reactors of identical design at multiple sites, reusing the design review.",
        href: "/section/50.AppN",
      },
    ],
  },
  {
    id: "52",
    name: "Part 52",
    tagline: "One-step combined licensing & design certification",
    base: { certainty: 5, techfit: 2, ease: 3, schedule: 5, operational: 3 },
    why: {
      certainty:
        "Mature framework sharing the SRP and Reg Guides with Part 50, now backed by combined-license and certified-design precedent plus issue-finality provisions.",
      techfit:
        "LWR-centric in practice and reliant on Part 50's technical requirements; a poor fit for novel non-LWR designs.",
      ease: "Compliance is against explicit criteria, but the combined license / design certification process front-loads extensive analysis and documentation.",
      schedule:
        "Its signature advantage: a one-step combined license, plus early site permits and design certification, resolve issues up front with finality.",
      operational:
        "Standardized, certifiable designs suit fleet deployment, though operations remain large-LWR scale rather than risk-informed.",
    },
    levers: [
      {
        label: "Early Site Permit (Subpart A)",
        detail: "Resolve and bank site suitability and environmental issues years ahead of a construction application.",
        href: "/part/52/A",
      },
      {
        label: "Standard Design Certification (Subpart B)",
        detail: "Generic, rulemaking-based design review with issue finality — reused by every plant referencing the design.",
        href: "/part/52/B",
      },
      {
        label: "Combined License (Subpart C)",
        detail: "One license resolving construction and operation together, instead of separate CP and OL reviews.",
        href: "/part/52/C",
      },
      {
        label: "Manufacturing License (Subpart F)",
        detail: "Factory-fabricate the reactor under a separate license before the site is approved.",
        href: "/part/52/F",
      },
    ],
  },
  {
    id: "53",
    name: "Part 53",
    tagline: "Risk-informed, technology-inclusive",
    base: { certainty: 2, techfit: 5, ease: 2, schedule: 2, operational: 4 },
    why: {
      certainty: "New framework; supporting guidance is still maturing and precedent is limited.",
      techfit: "Technology-inclusive and performance-based — designed to accommodate any reactor technology.",
      ease: "Higher analytical burden: a mature PRA, systematic safety classification, and a defense-in-depth case.",
      schedule:
        "Less predictable until reviews establish precedent (first-of-a-kind risk), though it supports combined licenses, standard designs, and risk-informed scoping that can narrow the review.",
      operational: "Risk-informed staffing and security scaling; built for modern, flexible operation.",
    },
    levers: [
      {
        label: "Combined-license & standard-design pathways",
        detail: "Supports one-step combined licenses and standard design approvals rather than only two-step licensing.",
        href: "/section/53.600",
      },
      {
        label: "Risk-informed scoping",
        detail: "Performance-based, risk-informed categorization narrows what is safety-significant, reducing the scope of review.",
      },
    ],
  },
  {
    id: "57",
    name: "Part 57",
    tagline: "Microreactors & comparable-risk designs",
    base: { certainty: 2, techfit: 4, ease: 3, schedule: 2, operational: 5 },
    why: {
      certainty: "Newest pathway with the least precedent to date.",
      techfit: "Tailored to microreactors and low-consequence designs; technology-inclusive within that envelope.",
      ease: "Obligations are scaled to a low source term, reducing analytical burden relative to large reactors.",
      schedule:
        "First-of-a-kind timing is uncertain, but categorical exclusion, generic finality, and a general license for construction are purpose-built to compress review for standardized microreactors.",
      operational: "The leanest framework — best suited to standardized, factory-manufactured fleet deployment.",
    },
    levers: [
      {
        label: "Categorical exclusion (no site-specific EIS)",
        detail: "Microreactor licensing actions within the pre-set environmental plant/site-parameter envelope are excluded from an EIS/EA (Subpart K).",
        href: "/section/57.350",
      },
      {
        label: "Generic finality",
        detail: "Issues resolved once for a standard design are final and not re-litigated per deployment; protected from new requirements.",
        href: "/section/57.142",
      },
      {
        label: "General license for construction",
        detail: "Site construction can begin without case-by-case authorization for pre-vetted standardized designs.",
        href: "/section/57.45",
      },
      {
        label: "Manufacturing license (Subpart D)",
        detail: "Factory-fabricate the reactor before the site is approved.",
        href: "/part/57/D",
      },
    ],
  },
];

export type ProfileKey = "tech" | "size" | "deploy";

export const PROFILE_QUESTIONS: {
  key: ProfileKey;
  label: string;
  help: string;
  options: { value: string; label: string }[];
}[] = [
  {
    key: "tech",
    label: "Reactor technology",
    help: "Part 50's prescriptive criteria are LWR-oriented; Parts 53 & 57 are technology-inclusive.",
    options: [
      { value: "lwr", label: "Light-water reactor" },
      { value: "nonlwr", label: "Non-LWR / advanced" },
      { value: "undecided", label: "Undecided" },
    ],
  },
  {
    key: "size",
    label: "Source term & scale",
    help: "Part 57 is limited to microreactors and comparable low-risk profiles.",
    options: [
      { value: "micro", label: "Microreactor / low source term" },
      { value: "large", label: "Large / conventional source term" },
      { value: "uncertain", label: "Uncertain" },
    ],
  },
  {
    key: "deploy",
    label: "Deployment model",
    help: "Standardized, factory-built fleets favor the leaner, risk-informed frameworks.",
    options: [
      { value: "bespoke", label: "Single, bespoke site" },
      { value: "fleet", label: "Standardized / factory fleet" },
      { value: "undecided", label: "Undecided" },
    ],
  },
];

export type Answers = Record<ProfileKey, string>;
export type Weights = Record<CriterionKey, number>;

export const DEFAULT_ANSWERS: Answers = { tech: "undecided", size: "uncertain", deploy: "undecided" };
export const DEFAULT_WEIGHTS: Weights = { certainty: 3, techfit: 3, ease: 3, schedule: 3, operational: 3 };

const clamp = (n: number) => Math.max(1, Math.min(5, n));

export type PathwayProfile = {
  id: PathwayId;
  eligible: boolean;
  ineligibleReason?: string;
  scores: Record<CriterionKey, number>;
  caveats: string[];
};

// Apply the gating answers as eligibility gates + score modifiers.
export function computeProfiles(answers: Answers): PathwayProfile[] {
  return PATHWAYS.map((p) => {
    const scores = { ...p.base };
    const caveats: string[] = [];
    let eligible = true;
    let ineligibleReason: string | undefined;

    const lwrCentric = p.id === "50" || p.id === "52";
    if (answers.tech === "lwr" && lwrCentric) scores.techfit = clamp(scores.techfit + 1);
    if (answers.tech === "nonlwr" && lwrCentric) {
      scores.techfit = clamp(scores.techfit - 1);
      caveats.push(
        p.id === "50"
          ? "Non-LWR designs under Part 50 typically require exemptions or principal design criteria (cf. RG 1.232)."
          : "Part 52 is built around LWR-based standardized designs; non-LWR designs are a poor fit and usually pursue Part 53.",
      );
    }

    if (answers.size === "micro") {
      if (p.id === "57") scores.operational = clamp(scores.operational + 1);
      if (p.id === "50" || p.id === "52") scores.operational = clamp(scores.operational - 1);
    }
    if (answers.size === "large" && p.id === "57") {
      eligible = false;
      ineligibleReason =
        "Part 57 is limited to microreactors and comparable low-risk profiles; a large or conventional source term falls outside its scope.";
    }
    if (answers.size === "uncertain" && p.id === "57") {
      caveats.push("Confirm the design meets Part 57's comparable-risk eligibility threshold before relying on it.");
    }

    if (answers.deploy === "fleet") {
      if (p.id === "52" || p.id === "53" || p.id === "57") scores.operational = clamp(scores.operational + 1);
      if (p.id === "50") scores.schedule = clamp(scores.schedule - 1);
    }

    return { id: p.id, eligible, ineligibleReason, scores, caveats };
  });
}

export type RankedPathway = PathwayProfile & { pathway: Pathway; pct: number };

export type RankResult = {
  ranked: RankedPathway[]; // eligible, sorted best-first
  ineligible: RankedPathway[];
  totalWeight: number;
};

export function rankPathways(answers: Answers, weights: Weights): RankResult {
  const profiles = computeProfiles(answers);
  const totalWeight = CRITERIA.reduce((s, c) => s + (weights[c.key] ?? 0), 0);
  const maxScore = CRITERIA.reduce((s, c) => s + (weights[c.key] ?? 0) * 5, 0);

  const withPct: RankedPathway[] = profiles.map((prof) => {
    const pathway = PATHWAYS.find((p) => p.id === prof.id)!;
    const raw = CRITERIA.reduce((s, c) => s + (weights[c.key] ?? 0) * prof.scores[c.key], 0);
    const pct = maxScore > 0 ? Math.round((raw / maxScore) * 100) : 0;
    return { ...prof, pathway, pct };
  });

  const ranked = withPct.filter((p) => p.eligible).sort((a, b) => b.pct - a.pct);
  const ineligible = withPct.filter((p) => !p.eligible);
  return { ranked, ineligible, totalWeight };
}
