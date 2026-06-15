// Fetches 10 CFR Part 53 from the Federal Register XML for the published
// final rule (default doc number 2026-06048 — "Risk-Informed, Technology-
// Inclusive Regulatory Framework for Advanced Reactors", 91 FR 15694,
// March 30, 2026; the same content backing
// https://www.regulations.gov/document/NRC-2019-0062-0310).
//
// Override with:  FR_DOC=YYYY-NNNNN  (e.g. FR_DOC=2026-07090 for a correction)
//
// Idempotent: clears subparts/sections/paragraphs/requirements/cross_refs/
// definitions on each run; preserves notes and bookmarks (keyed by section_code).

import * as fs from "node:fs";
import * as path from "node:path";
import { XMLParser } from "fast-xml-parser";
import { getRawDb, rebuildFts } from "../db/client";
import { extractRequirements } from "./extract-requirements";
import { extractXrefs } from "./extract-xrefs";
import { extractDefinition } from "./extract-definitions";

const DEFAULT_FR_DOCS: Record<string, string> = {
  "53": "2026-06048",
  "57": "2026-08550",
};
const DATA_DIR = path.join(process.cwd(), "data");

type AnyNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  preserveOrder: true,
  trimValues: false,
  parseTagValue: false,
});

function attrs(node: AnyNode): Record<string, string> {
  return ((node[":@"] as Record<string, string>) ?? {}) as Record<string, string>;
}

function tagOf(node: AnyNode): string | null {
  for (const k of Object.keys(node)) {
    if (k !== ":@") return k;
  }
  return null;
}

async function lookupDocMeta(docNumber: string): Promise<{ xmlUrl: string; date: string; title: string }> {
  const url = `https://www.federalregister.gov/api/v1/documents/${docNumber}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Federal Register API: ${res.status} for ${docNumber}`);
  const json = (await res.json()) as {
    full_text_xml_url?: string;
    publication_date: string;
    title: string;
  };
  if (!json.full_text_xml_url) throw new Error(`No full_text_xml_url for ${docNumber}`);
  return { xmlUrl: json.full_text_xml_url, date: json.publication_date, title: json.title };
}

async function loadXml(docNumber: string, partNum: string): Promise<{ xml: string; date: string; title: string }> {
  const xmlPath = path.join(DATA_DIR, `fr-part${partNum}.xml`);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (process.env.PART53_USE_CACHE === "1" && fs.existsSync(xmlPath)) {
    console.log(`using cached XML at ${xmlPath}`);
    return {
      xml: fs.readFileSync(xmlPath, "utf8"),
      date: process.env.ECFR_DATE ?? "cached",
      title: "(cached)",
    };
  }
  const meta = await lookupDocMeta(docNumber);
  console.log(`source: ${meta.title} (${meta.date})`);
  console.log(`fetching ${meta.xmlUrl}`);
  const res = await fetch(meta.xmlUrl);
  if (!res.ok) throw new Error(`XML fetch failed: ${res.status}`);
  const xml = await res.text();
  fs.writeFileSync(xmlPath, xml);
  return { xml, date: meta.date, title: meta.title };
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
    // skip page-break markers entirely
    if (tag === "PRTPAGE") continue;
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
    if (tag === "PRTPAGE") continue;
    const inner = htmlContent(child[tag] as unknown);
    if (tag === "E") out += `<em>${inner}</em>`;
    else out += inner;
  }
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function splitDesignator(text: string): { designator: string | null; rest: string } {
  const m = text.match(/^\s*((?:\([a-z0-9ivxlcdm]+\))+)\s*(.*)$/i);
  if (m) return { designator: m[1], rest: m[2] };
  return { designator: null, rest: text };
}

function depthFromDesignator(d: string | null): number {
  return d ? (d.match(/\(/g) ?? []).length : 0;
}

type ParsedSection = {
  code: string;
  title: string;
  paragraphs: Array<{ designator: string | null; depth: number; textHtml: string; textPlain: string }>;
};
type ParsedSubpart = { code: string; title: string; sections: ParsedSection[] };

function parseSubpartHeading(raw: string): { code: string; title: string } {
  // "Subpart A—General Provisions"
  const m = raw.match(/Subpart\s+([A-Z])\s*[—\-:]\s*(.+?)\s*$/);
  if (m) return { code: m[1], title: m[2] };
  return { code: raw.slice(0, 4), title: raw };
}

function parseSectionCode(rawSectno: string): string {
  // "§ 53.000" → "53.000"
  const m = rawSectno.match(/(\d{2,3}\.\d{1,4})/);
  return m ? m[1] : rawSectno.trim();
}

function buildSection(sectionNode: AnyNode): ParsedSection | null {
  const children = sectionNode["SECTION"] as unknown;
  if (!Array.isArray(children)) return null;
  let code = "";
  let title = "";
  const paragraphs: ParsedSection["paragraphs"] = [];
  for (const child of children as AnyNode[]) {
    const tag = tagOf(child);
    if (!tag) continue;
    if (tag === "SECTNO") code = parseSectionCode(textContent(child[tag] as unknown));
    else if (tag === "SUBJECT") title = textContent(child[tag] as unknown).replace(/\.\s*$/, "").trim();
    else if (tag === "P") {
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
  if (!code) return null;
  return { code, title, paragraphs };
}

// Walk the parsed XML tree to find the Part 53 region and extract subparts/sections.
function toTitleCase(s: string): string {
  const minor = new Set(["a", "an", "the", "and", "but", "or", "for", "nor", "of", "in", "on", "at", "to", "by", "with"]);
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i === 0 || !minor.has(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

type CollectResult = { subparts: ParsedSubpart[]; partHeading: string | null };

function collectPartSections(roots: unknown, partNum: string): CollectResult {
  const subparts: ParsedSubpart[] = [];
  let foundTarget = false;
  let preamble: ParsedSubpart | null = null;
  let partHeading: string | null = null;
  const partRe = new RegExp(`PART\\s+${partNum}\\b`, "i");

  function walk(arr: unknown) {
    if (!Array.isArray(arr)) return;
    for (const node of arr as AnyNode[]) {
      const tag = tagOf(node);
      if (!tag) continue;
      const inner = node[tag] as unknown;

      if (tag === "PART") {
        const heading = findHeading(inner);
        if (heading && partRe.test(heading)) {
          foundTarget = true;
          const rawTitle = heading.replace(/^PART\s+\d+\s*[—\-:]\s*/i, "").trim() || heading;
          partHeading = toTitleCase(rawTitle);
          const innerSections: ParsedSection[] = [];
          if (Array.isArray(inner)) {
            for (const c of inner as AnyNode[]) {
              if (tagOf(c) === "SECTION") {
                const sec = buildSection(c);
                if (sec) innerSections.push(sec);
              }
            }
          }
          if (innerSections.length) {
            preamble = { code: "_", title: `Part ${partNum} Introduction`, sections: innerSections };
          }
        } else if (foundTarget && heading && /PART\s+\d+/i.test(heading) && !partRe.test(heading)) {
          foundTarget = false;
        }
        walk(inner);
        continue;
      }

      if (tag === "SUBPART" && foundTarget) {
        const heading = findHeading(inner);
        if (!heading) {
          walk(inner);
          continue;
        }
        const { code, title } = parseSubpartHeading(heading);
        const sections: ParsedSection[] = [];
        if (Array.isArray(inner)) {
          for (const c of inner as AnyNode[]) {
            if (tagOf(c) === "SECTION") {
              const sec = buildSection(c);
              if (sec) sections.push(sec);
            }
          }
        }
        if (sections.length) subparts.push({ code, title, sections });
        continue;
      }

      // Recurse into containers we expect (REGTEXT, RULE, etc.)
      walk(inner);
    }
  }

  function findHeading(arr: unknown): string | null {
    if (!Array.isArray(arr)) return null;
    for (const c of arr as AnyNode[]) {
      if (tagOf(c) === "HD") {
        const a = attrs(c);
        if (a.SOURCE === "HED") return textContent(c["HD"] as unknown).trim();
      }
    }
    return null;
  }

  walk(roots);

  const allSubparts = preamble ? [preamble, ...subparts] : subparts;
  return { subparts: allSubparts, partHeading };
}

export async function ingestPart(partNum: string, docNumber?: string): Promise<void> {
  const resolvedDoc = docNumber ?? DEFAULT_FR_DOCS[partNum] ?? DEFAULT_FR_DOCS["53"];
  console.log(`─── 10 CFR Part ${partNum} ingest (Federal Register source) ───`);
  console.log(`Federal Register doc: ${resolvedDoc}`);
  const { xml, date, title } = await loadXml(resolvedDoc, partNum);
  console.log(`parsing ${xml.length.toLocaleString()} bytes`);

  const roots = parser.parse(xml);
  const { subparts, partHeading } = collectPartSections(roots, partNum);
  console.log(`extracted ${subparts.length} subparts`);
  if (partHeading) console.log(`part heading: ${partHeading}`);
  if (!subparts.length) {
    const msg = `No Part ${partNum} content found in the Federal Register document.`;
    console.error(`\n${msg}`);
    throw new Error(msg);
  }

  const sqlite = getRawDb();
  const tx = sqlite.transaction(() => {
    // Only delete rows belonging to this part number, leaving other parts intact
    const subpartIds = sqlite
      .prepare(`SELECT id FROM subparts WHERE part_number = ?`)
      .all(partNum) as Array<{ id: number }>;
    const spIds = subpartIds.map((r) => r.id);
    if (spIds.length) {
      const ph = spIds.map(() => "?").join(",");
      const sectionIds = sqlite
        .prepare(`SELECT id FROM sections WHERE subpart_id IN (${ph})`)
        .all(...spIds) as Array<{ id: number }>;
      const secIds = sectionIds.map((r) => r.id);
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

    sqlite.prepare(
      `INSERT OR REPLACE INTO parts (part_number, title, fr_doc, source_url) VALUES (?, ?, ?, ?)`,
    ).run(
      partNum,
      partHeading ?? title,
      resolvedDoc,
      `https://www.federalregister.gov/documents/full_text/xml/${date.replace(/-/g, "/")}/${resolvedDoc}.xml`,
    );

    const insSubpart = sqlite.prepare(`INSERT INTO subparts (part_number, code, title, ordinal) VALUES (?, ?, ?, ?)`);
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

    subparts.forEach((sp, i) => {
      const subpartId = insSubpart.run(partNum, sp.code, sp.title, i + 1).lastInsertRowid as number;
      sp.sections.forEach((sec, j) => {
        const sectionId = insSection.run(subpartId, sec.code, sec.title, j + 1).lastInsertRowid as number;
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
          for (const req of extractRequirements(para.textPlain)) {
            insRequirement.run(paragraphId, sectionId, req.modal, req.text);
          }
          for (const xr of extractXrefs(para.textPlain)) {
            insXref.run(paragraphId, sectionId, xr.targetKind, xr.targetSectionCode, xr.targetLabel, xr.raw);
          }
          if (sp.code === "A") {
            const def = extractDefinition(para.textPlain);
            if (def) insDef.run(def.term, paragraphId, sectionId, def.text);
          }
        });
      });
    });

    insRun.run(`fr:${resolvedDoc}`, date, totalParagraphs, totalSections, subparts.length, Date.now());
    console.log(
      `inserted: ${subparts.length} subparts, ${totalSections} sections, ${totalParagraphs} paragraphs`,
    );
    console.log(`source: Federal Register ${resolvedDoc} — ${title}`);
  });
  tx();
  rebuildFts();
  console.log("FTS rebuilt; ingest complete.");
}

async function main() {
  await ingestPart(process.env.CFR_PART ?? "53", process.env.FR_DOC);
}

// Only auto-run when this file is the entry point (tsx scripts/ingest-fr.ts)
const _argv1 = process.argv[1] ?? "";
if (_argv1.endsWith("ingest-fr.ts") || _argv1.endsWith("ingest-fr.js")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
