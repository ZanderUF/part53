// Definitions in CFR follow predictable patterns:
//   "Term means ..."
//   "Term, as used in this part, means ..."
//   "Term refers to ..."
// One definition per paragraph (typical eCFR pattern).

const PATTERNS = [
  /^([A-Z][A-Za-z0-9 ,\-’'()]+?)\s+means\s+(.+?\.)\s*$/s,
  /^([A-Z][A-Za-z0-9 ,\-’'()]+?),\s+as\s+used\s+in\s+this\s+(?:part|subpart|section),\s+means\s+(.+?\.)\s*$/s,
  /^([A-Z][A-Za-z0-9 ,\-’'()]+?)\s+refers\s+to\s+(.+?\.)\s*$/s,
];

export function extractDefinition(text: string): { term: string; text: string } | null {
  const trimmed = text.trim();
  for (const re of PATTERNS) {
    const m = trimmed.match(re);
    if (m) {
      const term = m[1].trim();
      // skip if "term" is too long — likely a false positive (a normal sentence starting with a capital).
      if (term.length > 60) continue;
      return { term, text: m[2].trim() };
    }
  }
  return null;
}
