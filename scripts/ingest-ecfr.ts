// Fetches an established 10 CFR part (default Part 50) from the eCFR full-text
// API and populates data/part53.sqlite. Used for long-standing parts that are
// NOT a single Federal Register final-rule document (unlike Parts 53 & 57,
// which come from scripts/ingest-fr.ts).
//
//   source: https://www.ecfr.gov/api/versioner/v1/full/{date}/title-10.xml?part=N
//
// eCFR encodes the hierarchy as DIV5 (part) → DIV6 (subpart) and/or
// DIV7 (subject group) → DIV8 (section). Part 50 has no lettered subparts;
// it groups its sections under 15 "subject groups" (DIV7), which we map onto
// the app's subpart navigation. Appendices (DIV9) are skipped.
//
// Idempotent & multi-part-safe: clears only the target part's rows, preserves
// notes and bookmarks (keyed by section_code), and leaves other parts intact.
//
// Override the part with CFR_PART=N and the snapshot date with ECFR_DATE=YYYY-MM-DD.

import * as fs from "node:fs";
import * as path from "node:path";
import { XMLParser } from "fast-xml-parser";
import { getRawDb, rebuildFts } from "../db/client";
import { extractRequirements } from "./extract-requirements";
import { extractXrefs } from "./extract-xrefs";
import { extractDefinition } from "./extract-definitions";

const DATA_DIR = path.join(process.cwd(), "data");

type AnyNode = Record<string, unknown> & { "#text"?: string; ":@"?: Record<string, string> };

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  preserveOrder: true,
  trimValues: false,
  parseTagValue: false,
});

function attrs(node: AnyNode): Record<string, string> {
  const a = node[":@"] as Record<string, unknown> | undefined;
  if (!a) return {};
  if (typeof a === "object" && a !== null && ":@" in a && Object.keys(a).length === 1) {
    return a[":@"] as Record<string, string>;
  }
  return a as Record<string, string>;
}

function tagOf(node: AnyNode): string | null {
  for (const k of Object.keys(node)) {
    if (k !== ":@") return k;
  }
  return null;
}

function childrenOfTag(arr: unknown, tag: string): AnyNode[] {
  if (!Array.isArray(arr)) return [];
  const out: AnyNode[] = [];
  for (const child of arr as AnyNode[]) {
    if (child && typeof child === "object" && tag in child) out.push(child);
  }
  return out;
}

function findFirst(arr: unknown, tag: string): AnyNode | null {
  if (!Array.isArray(arr)) return null;
  for (const child of arr as AnyNode[]) {
    if (child && typeof child === "object" && tag in child) return child;
  }
  return null;
}

function textContent(arr: unknown): string {
  if (!Array.isArray(arr)) return "";
  let out = "";
  for (const child of arr as AnyNode[]) {
    if (!child) continue;
    if (typeof child === "string") {
      out += decodeEntities(child);
      continue;
    }
    if ("#text" in child && typeof child["#text"] === "string") {
      out += decodeEntities(child["#text"]);
      continue;
    }
    const tag = tagOf(child);
    if (!tag) continue;
    out += textContent(child[tag] as unknown);
  }
  return out;
}

function htmlContent(arr: unknown): string {
  if (!Array.isArray(arr)) return "";
  let out = "";
  for (const child of arr as AnyNode[]) {
    if (!child) continue;
    if (typeof child === "string") {
      out += escapeHtml(decodeEntities(child));
      continue;
    }
    if ("#text" in child && typeof child["#text"] === "string") {
      out += escapeHtml(decodeEntities(child["#text"]));
      continue;
    }
    const tag = tagOf(child);
    if (!tag) continue;
    const inner = htmlContent(child[tag] as unknown);
    if (tag === "E") out += `<em>${inner}</em>`;
    else if (tag === "I") out += `<i>${inner}</i>`;
    else if (tag === "B") out += `<strong>${inner}</strong>`;
    else if (tag === "XREF") out += `<span data-xref="1">${inner}</span>`;
    else out += inner;
  }
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// eCFR XML encodes special characters as numeric character references (e.g.
// &#xA7; for §, &#x2014; for —) that fast-xml-parser does not decode under the
// options we use. Decode them ourselves; &amp; is handled last so existing
// single-escaped sequences aren't double-decoded.
function decodeEntities(s: string): string {
  if (!s.includes("&")) return s;
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function splitDesignator(text: string): { designator: string | null; rest: string } {
  const m = text.match(/^\s*((?:\([a-z0-9ivxlcdm]+\))+)\s*(.*)$/i);
  if (m) return { designator: m[1], rest: m[2] };
  return { designator: null, rest: text };
}

function depthFromDesignator(designator: string | null): number {
  if (!designator) return 0;
  return (designator.match(/\(/g) ?? []).length;
}

function headingOf(divChildren: unknown): string {
  const head = findFirst(divChildren, "HEAD");
  if (!head) return "";
  return textContent(head["HEAD"] as unknown).replace(/\s+/g, " ").trim();
}

function letterCode(n: number): string {
  // 1 → "A" … 26 → "Z"; beyond that fall back to the number.
  return n >= 1 && n <= 26 ? String.fromCharCode(64 + n) : `${n}`;
}

function parseSubpartCode(rawHead: string): string {
  const m = rawHead.match(/Subpart\s+([A-Z])/);
  return m ? m[1] : "";
}

function parseSubpartTitle(rawHead: string): string {
  const m = rawHead.match(/Subpart\s+[A-Z][\s—\-:]+(.+)$/);
  return m ? m[1].trim() : rawHead;
}

function parseSectionCode(rawHead: string): string {
  const m = rawHead.match(/§\s*(\d{2,3}\.\d{1,4}[a-z]?)/);
  return m ? m[1] : rawHead.slice(0, 30);
}

function parseSectionTitle(rawHead: string): string {
  const m = rawHead.match(/§\s*\d{2,3}\.\d{1,4}[a-z]?\s+(.+?)\.?$/);
  return m ? m[1].trim() : rawHead;
}

type ParsedParagraph = { designator: string | null; depth: number; textHtml: string; textPlain: string };
type ParsedSection = { code: string; title: string; paragraphs: ParsedParagraph[] };
type ParsedGroup = { code: string; title: string; sections: ParsedSection[] };

function parseSection(div8Children: unknown): ParsedSection {
  const head = headingOf(div8Children);
  const paragraphs: ParsedParagraph[] = [];
  if (Array.isArray(div8Children)) {
    for (const child of div8Children as AnyNode[]) {
      const tag = tagOf(child);
      if (!tag || tag === "HEAD") continue;
      if (tag === "P" || tag === "FP") {
        const html = htmlContent(child[tag] as unknown);
        const plain = textContent(child[tag] as unknown).replace(/\s+/g, " ").trim();
        if (!plain) continue;
        const { designator, rest } = splitDesignator(plain);
        paragraphs.push({
          designator,
          depth: depthFromDesignator(designator),
          textHtml: html,
          textPlain: rest || plain,
        });
      }
    }
  }
  return { code: parseSectionCode(head), title: parseSectionTitle(head), paragraphs };
}

function findPart(roots: unknown, partNum: string): unknown {
  function rec(arr: unknown): unknown | null {
    if (!Array.isArray(arr)) return null;
    for (const node of arr as AnyNode[]) {
      const tag = tagOf(node);
      if (!tag) continue;
      if (tag === "DIV5") {
        const a = attrs(node);
        if (a.N === partNum) return node["DIV5"];
      }
      const found = rec(node[tag] as unknown);
      if (found) return found;
    }
    return null;
  }
  return rec(roots);
}

const APPENDIX_HEAD_TAGS = new Set(["HD", "HD1", "HD2", "HD3", "HD4"]);
const APPENDIX_PARA_TAGS = new Set(["P", "FP", "FP-1", "FP-2", "FP1", "FP2"]);

function appendixId(nAttr: string, head: string): string {
  // "Appendix A to Part 50" → "A";  "Appendixes L-M to Part 50" → "L-M"
  const m = (nAttr || head).match(/Appendix(?:es)?\s+([A-Z0-9]+(?:-[A-Z0-9]+)?)/i);
  return m ? m[1].toUpperCase() : "X";
}

// Flatten an appendix body (headings, paragraphs, nested DIVs) into paragraph rows.
function flattenAppendix(children: unknown, out: ParsedParagraph[]): void {
  if (!Array.isArray(children)) return;
  for (const child of children as AnyNode[]) {
    const tag = tagOf(child);
    if (!tag || tag === "HEAD" || tag === "CITA" || tag === "EDNOTE" || tag === "SECAUTH") continue;
    const inner = child[tag] as unknown;
    if (tag.startsWith("DIV")) {
      flattenAppendix(inner, out); // nested division (e.g. Appendix A criteria list)
    } else if (APPENDIX_HEAD_TAGS.has(tag)) {
      const text = textContent(inner).replace(/\s+/g, " ").trim();
      if (text) out.push({ designator: null, depth: 0, textHtml: `<strong>${escapeHtml(text)}</strong>`, textPlain: text });
    } else if (APPENDIX_PARA_TAGS.has(tag) || tag === "FTNT") {
      const plain = textContent(inner).replace(/\s+/g, " ").trim();
      if (!plain) continue;
      const { designator, rest } = splitDesignator(plain);
      out.push({ designator, depth: depthFromDesignator(designator), textHtml: htmlContent(inner), textPlain: rest || plain });
    }
    // other tags (tables, images) are skipped
  }
}

function parseAppendix(div9Children: unknown, nAttr: string, partNum: string): ParsedSection | null {
  const head = headingOf(div9Children);
  if (/\[Reserved\]/i.test(head)) return null;
  const paragraphs: ParsedParagraph[] = [];
  flattenAppendix(div9Children, paragraphs);
  if (!paragraphs.length) return null;
  return { code: `${partNum}.App${appendixId(nAttr, head)}`, title: head, paragraphs };
}

// Appendices (DIV9) may be direct children of the part (Part 52) or nested
// inside the final subject group (Part 50), so search the whole subtree.
function collectAppendices(div5Children: unknown, partNum: string): ParsedSection[] {
  const out: ParsedSection[] = [];
  const visit = (arr: unknown) => {
    if (!Array.isArray(arr)) return;
    for (const node of arr as AnyNode[]) {
      const tag = tagOf(node);
      if (!tag) continue;
      if (tag === "DIV9") {
        const sec = parseAppendix(node["DIV9"] as unknown, attrs(node).N ?? "", partNum);
        if (sec) out.push(sec);
        continue; // don't descend into the appendix body
      }
      visit(node[tag] as unknown);
    }
  };
  visit(div5Children);
  return out;
}

type CollectResult = { partHeading: string; groups: ParsedGroup[] };

// Walk the DIV5 children in document order, mapping DIV6 (subpart) / DIV7
// (subject group) containers — and any sections directly under the part — onto
// the app's "subpart" grouping. Appendices (DIV9) are gathered into a trailing
// "Appendices" group.
function collectPart(div5Children: unknown, partNum: string): CollectResult {
  let partHeading = `Part ${partNum}`;
  const groups: ParsedGroup[] = [];
  let current: ParsedGroup | null = null;
  // Parts like 50 are entirely subject groups (DIV7) → sequential letters.
  // Parts like 52 mix real lettered subparts (DIV6) with a leading subject
  // group ("General Provisions"); give those non-subpart groups a distinct
  // "G#" code so they can never collide with a real subpart letter.
  const hasSubparts = childrenOfTag(div5Children, "DIV6").some((d) =>
    parseSubpartCode(headingOf(d["DIV6"] as unknown)),
  );
  let letterSeq = 0;
  let groupSeq = 0;
  const nonSubpartCode = () => (hasSubparts ? `G${(groupSeq += 1)}` : letterCode((letterSeq += 1)));

  if (Array.isArray(div5Children)) {
    for (const child of div5Children as AnyNode[]) {
      const tag = tagOf(child);
      if (!tag) continue;
      const inner = child[tag] as unknown;

      if (tag === "HEAD") {
        const raw = textContent(inner).replace(/\s+/g, " ").trim();
        partHeading = raw.replace(/^PART\s+\d+\s*[—\-:]\s*/i, "").trim() || raw;
        continue;
      }

      if (tag === "DIV6" || tag === "DIV7") {
        const head = headingOf(inner);
        const subLetter = tag === "DIV6" ? parseSubpartCode(head) : "";
        const code = subLetter || nonSubpartCode();
        const title = subLetter ? parseSubpartTitle(head) : head;
        current = { code, title: title || `Group ${code}`, sections: [] };
        groups.push(current);
        for (const sec of childrenOfTag(inner, "DIV8")) {
          current.sections.push(parseSection(sec["DIV8"] as unknown));
        }
        continue;
      }

      if (tag === "DIV8") {
        if (!current) {
          current = { code: nonSubpartCode(), title: "General", sections: [] };
          groups.push(current);
        }
        current.sections.push(parseSection(inner));
        continue;
      }
      // DIV9 appendices are gathered separately by collectAppendices().
    }
  }

  // Drop groups that ended up with no sections (e.g. a heading with only appendices).
  const cleanGroups = groups.filter((g) => g.sections.length);

  // Appendices become a final "Appendices" group so they're browsable and
  // searchable like sections (each appendix → one section, code <part>.App<id>).
  const appendices = collectAppendices(div5Children, partNum);
  if (appendices.length) cleanGroups.push({ code: "APP", title: "Appendices", sections: appendices });

  return { partHeading: toTitleCase(partHeading), groups: cleanGroups };
}

function toTitleCase(s: string): string {
  const minor = new Set(["a", "an", "the", "and", "but", "or", "for", "nor", "of", "in", "on", "at", "to", "by", "with"]);
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i === 0 || !minor.has(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

async function latestTitle10Date(): Promise<string> {
  const res = await fetch("https://www.ecfr.gov/api/versioner/v1/titles.json");
  if (!res.ok) throw new Error(`titles.json returned ${res.status}`);
  const json = (await res.json()) as { titles: Array<{ number: number; latest_issue_date: string }> };
  const t = json.titles.find((x) => x.number === 10);
  if (!t) throw new Error("Title 10 not in titles.json");
  return t.latest_issue_date;
}

async function loadXml(partNum: string): Promise<{ xml: string; date: string }> {
  const date = process.env.ECFR_DATE ?? (await latestTitle10Date());
  const xmlPath = path.join(DATA_DIR, `part${partNum}-ecfr.xml`);
  console.log(`source date: ${date}`);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (process.env.PART53_USE_CACHE === "1" && fs.existsSync(xmlPath)) {
    console.log(`using cached XML at ${xmlPath}`);
    return { xml: fs.readFileSync(xmlPath, "utf8"), date };
  }
  const url = `https://www.ecfr.gov/api/versioner/v1/full/${date}/title-10.xml?part=${partNum}`;
  console.log(`fetching ${url}`);
  const res = await fetch(url, { headers: { Accept: "application/xml" } });
  if (!res.ok) {
    if (fs.existsSync(xmlPath)) {
      console.warn(`fetch failed (${res.status}); falling back to cached XML`);
      return { xml: fs.readFileSync(xmlPath, "utf8"), date };
    }
    throw new Error(`eCFR returned ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();
  fs.writeFileSync(xmlPath, xml);
  return { xml, date };
}

export async function ingestPartFromEcfr(partNum: string): Promise<void> {
  console.log(`─── 10 CFR Part ${partNum} ingest (eCFR source) ───`);
  const { xml, date } = await loadXml(partNum);
  console.log(`parsing ${xml.length.toLocaleString()} bytes`);

  const roots = parser.parse(xml) as unknown;
  const partChildren = findPart(roots, partNum);
  if (!partChildren) throw new Error(`Part ${partNum} (DIV5 N="${partNum}") not found in eCFR XML`);

  const { partHeading, groups } = collectPart(partChildren, partNum);
  const totalSectionsParsed = groups.reduce((n, g) => n + g.sections.length, 0);
  console.log(`extracted ${groups.length} groups, ${totalSectionsParsed} sections`);
  console.log(`part heading: ${partHeading}`);
  if (!groups.length) throw new Error(`No section content found for Part ${partNum} at ${date}.`);

  const sqlite = getRawDb();
  const tx = sqlite.transaction(() => {
    // Delete only this part's rows; leave other parts (and notes/bookmarks) intact.
    const subpartIds = (
      sqlite.prepare(`SELECT id FROM subparts WHERE part_number = ?`).all(partNum) as Array<{ id: number }>
    ).map((r) => r.id);
    if (subpartIds.length) {
      const ph = subpartIds.map(() => "?").join(",");
      const secIds = (
        sqlite.prepare(`SELECT id FROM sections WHERE subpart_id IN (${ph})`).all(...subpartIds) as Array<{
          id: number;
        }>
      ).map((r) => r.id);
      if (secIds.length) {
        const ph2 = secIds.map(() => "?").join(",");
        sqlite.prepare(`DELETE FROM cross_refs WHERE source_section_id IN (${ph2})`).run(...secIds);
        sqlite.prepare(`DELETE FROM definitions WHERE section_id IN (${ph2})`).run(...secIds);
        sqlite.prepare(`DELETE FROM requirements WHERE section_id IN (${ph2})`).run(...secIds);
        sqlite.prepare(`DELETE FROM paragraphs WHERE section_id IN (${ph2})`).run(...secIds);
        sqlite.prepare(`DELETE FROM sections WHERE id IN (${ph2})`).run(...secIds);
      }
      sqlite.prepare(`DELETE FROM subparts WHERE part_number = ?`).run(partNum);
    }

    sqlite
      .prepare(`INSERT OR REPLACE INTO parts (part_number, title, fr_doc, source_url) VALUES (?, ?, ?, ?)`)
      .run(
        partNum,
        partHeading,
        null,
        `https://www.ecfr.gov/current/title-10/chapter-I/part-${partNum}`,
      );

    const insSubpart = sqlite.prepare(`INSERT INTO subparts (part_number, code, title, ordinal) VALUES (?, ?, ?, ?)`);
    const insSection = sqlite.prepare(`INSERT INTO sections (subpart_id, code, title, ordinal) VALUES (?, ?, ?, ?)`);
    const insParagraph = sqlite.prepare(
      `INSERT INTO paragraphs (section_id, designator, depth, parent_id, text_html, text_plain, ordinal)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const insRequirement = sqlite.prepare(
      `INSERT INTO requirements (paragraph_id, section_id, modal, text) VALUES (?, ?, ?, ?)`,
    );
    const insXref = sqlite.prepare(
      `INSERT INTO cross_refs (source_paragraph_id, source_section_id, target_kind, target_section_code, target_label, raw)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const insDef = sqlite.prepare(
      `INSERT OR IGNORE INTO definitions (term, paragraph_id, section_id, text) VALUES (?, ?, ?, ?)`,
    );
    const insRun = sqlite.prepare(
      `INSERT INTO ingest_runs (source_date, amendment_date, paragraph_count, section_count, subpart_count, completed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    let totalParagraphs = 0;
    let totalSections = 0;

    groups.forEach((grp, i) => {
      const subpartId = insSubpart.run(partNum, grp.code, grp.title, i + 1).lastInsertRowid as number;
      grp.sections.forEach((sec, j) => {
        const sectionId = insSection.run(subpartId, sec.code, sec.title, j + 1).lastInsertRowid as number;
        totalSections += 1;
        sec.paragraphs.forEach((para, k) => {
          const paragraphId = insParagraph.run(
            sectionId,
            para.designator,
            para.depth,
            null,
            para.textHtml,
            para.textPlain,
            k + 1,
          ).lastInsertRowid as number;
          totalParagraphs += 1;
          for (const req of extractRequirements(para.textPlain)) {
            insRequirement.run(paragraphId, sectionId, req.modal, req.text);
          }
          for (const xr of extractXrefs(para.textPlain)) {
            insXref.run(paragraphId, sectionId, xr.targetKind, xr.targetSectionCode, xr.targetLabel, xr.raw);
          }
          // § 50.2 (Definitions) lives in the first subject group; extract there.
          if (i === 0) {
            const def = extractDefinition(para.textPlain);
            if (def) insDef.run(def.term, paragraphId, sectionId, def.text);
          }
        });
      });
    });

    insRun.run(`ecfr:${date}:part-${partNum}`, date, totalParagraphs, totalSections, groups.length, Date.now());
    console.log(`inserted: ${groups.length} groups, ${totalSections} sections, ${totalParagraphs} paragraphs`);
  });
  tx();
  rebuildFts();
  console.log("FTS rebuilt; ingest complete.");
}

async function main() {
  await ingestPartFromEcfr(process.env.CFR_PART ?? "50");
}

const _argv1 = process.argv[1] ?? "";
if (_argv1.endsWith("ingest-ecfr.ts") || _argv1.endsWith("ingest-ecfr.js")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
