import Link from "next/link";

export function renderInlineRefs(text: string, knownSectionCodes: Set<string>): React.ReactNode {
  // We re-scan paragraph plain text and wrap matches in links.
  // This is a UI concern; the canonical refs were stored at ingest time.
  const parts: Array<string | React.ReactNode> = [];
  const re =
    /(§{1,2}\s*\d{2,3}\.\d{1,4}(?:\([a-z0-9ivxlcdm]+\))*|10\s*CFR\s*(?:Part\s*\d{1,4}|\d{1,4}\.\d{1,4})|Subpart\s+[A-Z]\b)/gi;
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    const raw = m[0];
    parts.push(
      <XrefLink key={`x${key++}`} raw={raw} knownSectionCodes={knownSectionCodes} />,
    );
    last = start + raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function XrefLink({
  raw,
  knownSectionCodes,
}: {
  raw: string;
  knownSectionCodes: Set<string>;
}) {
  const sectionMatch = raw.match(/(\d{2,3}\.\d{1,4})/);
  const sectionCode = sectionMatch?.[1];
  if (sectionCode && knownSectionCodes.has(sectionCode)) {
    return (
      <Link href={`/section/${sectionCode}`} className="xref-link">
        {raw}
      </Link>
    );
  }
  if (/10\s*CFR\s*Part\s*(\d+)/i.test(raw)) {
    const part = raw.match(/Part\s*(\d+)/i)![1];
    return (
      <a
        href={`https://www.ecfr.gov/current/title-10/part-${part}`}
        target="_blank"
        rel="noreferrer"
        className="xref-link"
      >
        {raw}
      </a>
    );
  }
  if (/10\s*CFR\s*(\d+\.\d+)/i.test(raw)) {
    const code = raw.match(/(\d+\.\d+)/)![1];
    const part = code.split(".")[0];
    return (
      <a
        href={`https://www.ecfr.gov/current/title-10/part-${part}/section-${code}`}
        target="_blank"
        rel="noreferrer"
        className="xref-link"
      >
        {raw}
      </a>
    );
  }
  if (/Subpart\s+([A-Z])/.test(raw)) {
    return <span className="xref-link">{raw}</span>;
  }
  return <span>{raw}</span>;
}
