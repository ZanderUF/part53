// Extracts modal "shall / must / may not / is required to" statements from a paragraph.
// We split on sentence boundaries and keep clauses that contain a modal verb.

const MODAL_PATTERNS: Array<{ modal: string; re: RegExp }> = [
  { modal: "shall", re: /\bshall\b/i },
  { modal: "must", re: /\bmust\b/i },
  { modal: "may not", re: /\bmay\s+not\b/i },
  { modal: "shall not", re: /\bshall\s+not\b/i },
  { modal: "is required to", re: /\bis\s+required\s+to\b/i },
  { modal: "are required to", re: /\bare\s+required\s+to\b/i },
];

function splitSentences(text: string): string[] {
  // Naive sentence split; preserves "§ 53.210(a)." style citations by requiring a following capital or end-of-string.
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function extractRequirements(text: string): Array<{ modal: string; text: string }> {
  const out: Array<{ modal: string; text: string }> = [];
  for (const sentence of splitSentences(text)) {
    for (const { modal, re } of MODAL_PATTERNS) {
      if (re.test(sentence)) {
        out.push({ modal, text: sentence });
        break;
      }
    }
  }
  return out;
}
