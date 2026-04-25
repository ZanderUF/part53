// Fetches 10 CFR Part 53 XML from eCFR and populates data/part53.sqlite.
// Idempotent: overwrites subparts/sections/paragraphs/requirements/cross_refs/definitions
// while preserving notes and bookmarks (keyed by stable section_code).

import * as fs from "node:fs";
import * as path from "node:path";
import { XMLParser } from "fast-xml-parser";
import { getRawDb, rebuildFts } from "../db/client";
import { extractRequirements } from "./extract-requirements";
import { extractXrefs } from "./extract-xrefs";
import { extractDefinition } from "./extract-definitions";

const DATA_DIR = path.join(process.cwd(), "data");
const XML_PATH = path.join(DATA_DIR, "part53.xml");

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

async function latestTitle10Date(): Promise<string> {
  const res = await fetch("https://www.ecfr.gov/api/versioner/v1/titles.json");
  if (!res.ok) throw new Error(`titles.json returned ${res.status}`);
  const json = (await res.json()) as { titles: Array<{ number: number; latest_issue_date: string }> };
  const t = json.titles.find((x) => x.number === 10);
  if (!t) throw new Error("Title 10 not in titles.json");
  return t.latest_issue_date;
}

async function fetchXml(date: string): Promise<string> {
  const url = `https://www.ecfr.gov/api/versioner/v1/full/${date}/title-10.xml?part=53`;
  console.log(`fetching ${url}`);
  const res = await fetch(url, { headers: { Accept: "application/xml" } });
  if (!res.ok) throw new Error(`eCFR returned ${res.status} ${res.statusText}`);
  return res.text();
}

async function loadXml(): Promise<{ xml: string; date: string }> {
  const date = process.env.ECFR_DATE ?? (await latestTitle10Date());
  console.log(`source date: ${date}`);
  if (process.env.PART53_USE_CACHE === "1" && fs.existsSync(XML_PATH)) {
    console.log(`using cached XML at ${XML_PATH}`);
    return { xml: fs.readFileSync(XML_PATH, "utf8"), date };
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    const xml = await fetchXml(date);
    fs.writeFileSync(XML_PATH, xml);
    return { xml, date };
  } catch (err) {
    if (fs.existsSync(XML_PATH)) {
      console.warn(`fetch failed (${(err as Error).message}); falling back to cached XML`);
      return { xml: fs.readFileSync(XML_PATH, "utf8"), date };
    }
    throw err;
  }
}

type AnyNode = Record<string, unknown> & { "#text"?: string; ":@"?: Record<string, string> };

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  preserveOrder: true,
  trimValues: false,
  parseTagValue: false,
});

function attrs(node: AnyNode): Record<string, string> {
  // In preserveOrder mode without attributesGroupName, attributes are stored under ":@" as a flat object.
  const a = node[":@"] as Record<string, unknown> | undefined;
  if (!a) return {};
  // Defensive: if the parser ever double-nests, unwrap one level.
  if (typeof a === "object" && a !== null && ":@" in a && Object.keys(a).length === 1) {
    return a[":@"] as Record<string, string>;
  }
  return a as Record<string, string>;
}

function getChildren(node: AnyNode, tag: string): AnyNode[] {
  // preserveOrder => node values are arrays of {tagName: [...]} objects
  const out: AnyNode[] = [];
  for (const key of Object.keys(node)) {
    if (key === ":@") continue;
    const v = node[key];
    if (key === tag && Array.isArray(v)) {
      out.push(node as AnyNode);
    }
  }
  return out;
}

// Walk a preserve-order tree to find all immediate children matching tag.
function childrenOfTag(arr: unknown, tag: string): AnyNode[] {
  if (!Array.isArray(arr)) return [];
  const out: AnyNode[] = [];
  for (const child of arr as AnyNode[]) {
    if (child && typeof child === "object" && tag in child) {
      out.push(child);
    }
  }
  return out;
}

function tagOf(node: AnyNode): string | null {
  for (const k of Object.keys(node)) {
    if (k !== ":@") return k;
  }
  return null;
}

function textContent(arr: unknown): string {
  if (!Array.isArray(arr)) return "";
  let out = "";
  for (const child of arr as AnyNode[]) {
    if (!child) continue;
    if (typeof child === "string") {
      out += child;
      continue;
    }
    if ("#text" in child && typeof child["#text"] === "string") {
      out += child["#text"];
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
      out += escapeHtml(child);
      continue;
    }
    if ("#text" in child && typeof child["#text"] === "string") {
      out += escapeHtml(child["#text"]);
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
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Parse "(a)", "(1)", "(i)" etc. from start of paragraph; return designator + remaining text.
function splitDesignator(text: string): { designator: string | null; rest: string } {
  const m = text.match(/^\s*((?:\([a-z0-9ivxlcdm]+\))+)\s*(.*)$/i);
  if (m) return { designator: m[1], rest: m[2] };
  return { designator: null, rest: text };
}

function depthFromDesignator(designator: string | null): number {
  if (!designator) return 0;
  return (designator.match(/\(/g) ?? []).length;
}

function findFirst(arr: unknown, tag: string): AnyNode | null {
  if (!Array.isArray(arr)) return null;
  for (const child of arr as AnyNode[]) {
    if (child && typeof child === "object" && tag in child) return child;
  }
  return null;
}

function headingOf(divChildren: unknown): string {
  const head = findFirst(divChildren, "HEAD");
  if (!head) return "";
  return textContent(head["HEAD"] as unknown).trim();
}

type SubpartRow = { code: string; title: string };
type SectionRow = {
  subpartCode: string;
  code: string;
  title: string;
  paragraphs: ParagraphRow[];
};
type ParagraphRow = {
  designator: string | null;
  depth: number;
  textHtml: string;
  textPlain: string;
};

function parseSubpartCode(rawHead: string): string {
  // "Subpart A—General Provisions"  →  "A"
  const m = rawHead.match(/Subpart\s+([A-Z])/);
  return m ? m[1] : rawHead.slice(0, 30);
}

function parseSubpartTitle(rawHead: string): string {
  const m = rawHead.match(/Subpart\s+[A-Z][\s—\-:]+(.+)$/);
  return m ? m[1].trim() : rawHead;
}

function parseSectionCode(rawHead: string): string {
  // "§ 53.210 Design features."  →  "53.210"
  const m = rawHead.match(/§\s*(\d{2,3}\.\d{1,4})/);
  return m ? m[1] : rawHead.slice(0, 30);
}

function parseSectionTitle(rawHead: string): string {
  const m = rawHead.match(/§\s*\d{2,3}\.\d{1,4}\s+(.+?)\.?$/);
  return m ? m[1].trim() : rawHead;
}

function walkPart(partChildren: unknown): SubpartRow[] {
  const subparts: SubpartRow[] = [];
  const subpartNodes = childrenOfTag(partChildren, "DIV6");
  for (const sp of subpartNodes) {
    const inner = sp["DIV6"] as unknown;
    const head = headingOf(inner);
    subparts.push({ code: parseSubpartCode(head), title: parseSubpartTitle(head) });
  }
  return subparts;
}

function walkSubpart(subpartChildren: unknown, subpartCode: string): SectionRow[] {
  const out: SectionRow[] = [];
  const sections = childrenOfTag(subpartChildren, "DIV8");
  for (const sec of sections) {
    const inner = sec["DIV8"] as unknown;
    const head = headingOf(inner);
    const code = parseSectionCode(head);
    const title = parseSectionTitle(head);
    out.push({ subpartCode, code, title, paragraphs: walkSection(inner) });
  }
  return out;
}

function walkSection(sectionChildren: unknown): ParagraphRow[] {
  const out: ParagraphRow[] = [];
  if (!Array.isArray(sectionChildren)) return out;
  for (const child of sectionChildren as AnyNode[]) {
    const tag = tagOf(child);
    if (!tag || tag === "HEAD") continue;
    if (tag === "P") {
      const html = htmlContent(child["P"] as unknown);
      const plain = textContent(child["P"] as unknown).replace(/\s+/g, " ").trim();
      if (!plain) continue;
      const { designator, rest } = splitDesignator(plain);
      out.push({
        designator,
        depth: depthFromDesignator(designator),
        textHtml: html,
        textPlain: rest || plain,
      });
    }
  }
  return out;
}

function findPart53(roots: unknown): unknown {
  // The XML root is an array of top-level nodes. Recursively search for DIV5 with attr N=53.
  function rec(arr: unknown): unknown | null {
    if (!Array.isArray(arr)) return null;
    for (const node of arr as AnyNode[]) {
      const tag = tagOf(node);
      if (!tag) continue;
      if (tag === "DIV5") {
        const a = attrs(node);
        if (a.N === "53" || a.TYPE === "PART") return node["DIV5"];
      }
      const inner = node[tag] as unknown;
      const found = rec(inner);
      if (found) return found;
    }
    return null;
  }
  return rec(roots);
}

async function main() {
  console.log("─── 10 CFR Part 53 ingest ───");
  const { xml, date: sourceDate } = await loadXml();
  console.log(`parsing ${xml.length.toLocaleString()} bytes`);
  const roots = parser.parse(xml) as unknown;

  const partChildren = findPart53(roots);
  if (!partChildren) throw new Error("Part 53 not found in XML");

  const subparts = walkPart(partChildren);
  console.log(`found ${subparts.length} subparts`);

  if (subparts.length === 0) {
    console.warn(
      "\n  Part 53 was found in eCFR but contains no subparts at this date.\n" +
        "  The eCFR snapshot has not yet been populated with the published rule body.\n" +
        "  Options:\n" +
        "    1. Re-run later with ECFR_DATE=YYYY-MM-DD once eCFR catches up.\n" +
        "    2. Run `npm run seed:sample` to populate a small representative sample\n" +
        "       so you can exercise the app end-to-end.\n",
    );
    process.exit(2);
  }

  const sectionsBySubpart: Record<string, SectionRow[]> = {};
  const subpartNodes = childrenOfTag(partChildren, "DIV6");
  for (let i = 0; i < subpartNodes.length; i++) {
    const inner = subpartNodes[i]["DIV6"] as unknown;
    const code = subparts[i].code;
    sectionsBySubpart[code] = walkSubpart(inner, code);
  }

  const sqlite = getRawDb();
  const tx = sqlite.transaction(() => {
    sqlite.exec(`
      DELETE FROM cross_refs;
      DELETE FROM definitions;
      DELETE FROM requirements;
      DELETE FROM paragraphs;
      DELETE FROM sections;
      DELETE FROM subparts;
    `);

    const insSubpart = sqlite.prepare(
      `INSERT INTO subparts (code, title, ordinal) VALUES (?, ?, ?)`,
    );
    const insSection = sqlite.prepare(
      `INSERT INTO sections (subpart_id, code, title, ordinal) VALUES (?, ?, ?, ?)`,
    );
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

    for (let i = 0; i < subparts.length; i++) {
      const sp = subparts[i];
      const subpartId = insSubpart.run(sp.code, sp.title, i + 1).lastInsertRowid as number;

      const sections = sectionsBySubpart[sp.code] ?? [];
      sections.forEach((sec, j) => {
        const sectionId = insSection.run(subpartId, sec.code, sec.title, j + 1)
          .lastInsertRowid as number;
        totalSections++;

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
          totalParagraphs++;

          // Requirements
          for (const req of extractRequirements(para.textPlain)) {
            insRequirement.run(paragraphId, sectionId, req.modal, req.text);
          }

          // Cross-refs
          for (const xr of extractXrefs(para.textPlain)) {
            insXref.run(
              paragraphId,
              sectionId,
              xr.targetKind,
              xr.targetSectionCode,
              xr.targetLabel,
              xr.raw,
            );
          }

          // Definitions (Subpart A only by convention; safe to run elsewhere too)
          if (sp.code === "A") {
            const def = extractDefinition(para.textPlain);
            if (def) insDef.run(def.term, paragraphId, sectionId, def.text);
          }
        });
      });
    }

    insRun.run(
      sourceDate,
      sourceDate,
      totalParagraphs,
      totalSections,
      subparts.length,
      Date.now(),
    );

    console.log(
      `inserted: ${subparts.length} subparts, ${totalSections} sections, ${totalParagraphs} paragraphs`,
    );
  });

  tx();
  rebuildFts();
  console.log("FTS rebuilt");
  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
