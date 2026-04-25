// Extracts cross-references from a paragraph's plain text.
// Recognises:
//   - Internal:  § 53.210, §§ 53.210 and 53.220, § 53.210(a)(1)
//   - External:  10 CFR 50.34, 10 CFR Part 50, Part 100
//   - Subpart:   Subpart B, Subpart B of this part

export type Xref = {
  targetKind: "section" | "external" | "subpart";
  targetSectionCode: string | null;
  targetLabel: string;
  raw: string;
};

const SECTION_RE = /§{1,2}\s*(\d{2,3}\.\d{1,4})(?:\([a-z0-9ivx]+\))*/gi;
const EXTERNAL_RE = /\b10\s*CFR\s*(?:Part\s*(\d{1,4})|(\d{1,4}\.\d{1,4}))/gi;
const SUBPART_RE = /\bSubpart\s+([A-Z])\b/g;

export function extractXrefs(text: string): Xref[] {
  const out: Xref[] = [];
  const seen = new Set<string>();

  for (const m of text.matchAll(SECTION_RE)) {
    const code = m[1];
    const key = `section:${code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      targetKind: "section",
      targetSectionCode: code,
      targetLabel: `§ ${code}`,
      raw: m[0],
    });
  }

  for (const m of text.matchAll(EXTERNAL_RE)) {
    const part = m[1];
    const sectionRef = m[2];
    const label = part ? `10 CFR Part ${part}` : `10 CFR ${sectionRef}`;
    const key = `external:${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      targetKind: "external",
      targetSectionCode: sectionRef ?? null,
      targetLabel: label,
      raw: m[0],
    });
  }

  for (const m of text.matchAll(SUBPART_RE)) {
    const letter = m[1];
    const key = `subpart:${letter}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      targetKind: "subpart",
      targetSectionCode: null,
      targetLabel: `Subpart ${letter}`,
      raw: m[0],
    });
  }

  return out;
}
