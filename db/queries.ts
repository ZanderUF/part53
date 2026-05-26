import { getRawDb } from "./client";

export type Subpart = { id: number; part_number: string; code: string; title: string; ordinal: number };
export type Section = { id: number; subpart_id: number; code: string; title: string; ordinal: number };
export type Paragraph = {
  id: number;
  section_id: number;
  designator: string | null;
  depth: number;
  text_html: string;
  text_plain: string;
  ordinal: number;
};
export type Requirement = {
  id: number;
  paragraph_id: number;
  section_id: number;
  modal: string;
  text: string;
  tags: string;
  status: string;
};
export type CrossRef = {
  id: number;
  source_paragraph_id: number;
  source_section_id: number;
  target_kind: string;
  target_section_code: string | null;
  target_label: string;
  raw: string;
};
export type Definition = {
  id: number;
  term: string;
  paragraph_id: number;
  section_id: number;
  text: string;
};

export type PartInfo = { part_number: string; title: string; subpart_count: number; section_count: number };

export function listParts(): PartInfo[] {
  return getRawDb()
    .prepare(
      `SELECT sp.part_number, sp.title AS title,
              COUNT(DISTINCT sp.id) AS subpart_count,
              COUNT(DISTINCT s.id) AS section_count
       FROM subparts sp
       LEFT JOIN sections s ON s.subpart_id = sp.id
       GROUP BY sp.part_number
       ORDER BY sp.part_number`,
    )
    .all() as PartInfo[];
}

export function partTitle(partNumber: string): string {
  const row = getRawDb()
    .prepare(`SELECT title FROM subparts WHERE part_number = ? AND code = '_' LIMIT 1`)
    .get(partNumber) as { title: string } | undefined;
  if (row) return row.title;
  const row2 = getRawDb()
    .prepare(`SELECT title FROM subparts WHERE part_number = ? ORDER BY ordinal LIMIT 1`)
    .get(partNumber) as { title: string } | undefined;
  return row2?.title ?? `Part ${partNumber}`;
}

export function listSubparts(partNumber?: string): Subpart[] {
  if (partNumber) {
    return getRawDb()
      .prepare(`SELECT * FROM subparts WHERE part_number = ? ORDER BY ordinal`)
      .all(partNumber) as Subpart[];
  }
  return getRawDb()
    .prepare(`SELECT * FROM subparts ORDER BY part_number, ordinal`)
    .all() as Subpart[];
}

export function getSubpart(partNumber: string, code: string): Subpart | null {
  return (
    (getRawDb()
      .prepare(`SELECT * FROM subparts WHERE part_number = ? AND code = ?`)
      .get(partNumber, code) as Subpart | undefined) ?? null
  );
}

export function listSectionsBySubpart(subpartId: number): Section[] {
  return getRawDb()
    .prepare(`SELECT * FROM sections WHERE subpart_id = ? ORDER BY ordinal`)
    .all(subpartId) as Section[];
}

export function getSection(code: string): Section | null {
  return (
    (getRawDb()
      .prepare(`SELECT * FROM sections WHERE code = ?`)
      .get(code) as Section | undefined) ?? null
  );
}

export function getSectionById(id: number): Section | null {
  return (
    (getRawDb()
      .prepare(`SELECT * FROM sections WHERE id = ?`)
      .get(id) as Section | undefined) ?? null
  );
}

export function partNumberForSection(sectionCode: string): string | null {
  const row = getRawDb()
    .prepare(
      `SELECT sp.part_number FROM sections s JOIN subparts sp ON sp.id = s.subpart_id WHERE s.code = ?`,
    )
    .get(sectionCode) as { part_number: string } | undefined;
  return row?.part_number ?? null;
}

export function listParagraphs(sectionId: number): Paragraph[] {
  return getRawDb()
    .prepare(`SELECT * FROM paragraphs WHERE section_id = ? ORDER BY ordinal`)
    .all(sectionId) as Paragraph[];
}

export function listRequirementsForSection(sectionId: number): Requirement[] {
  return getRawDb()
    .prepare(`SELECT * FROM requirements WHERE section_id = ? ORDER BY id`)
    .all(sectionId) as Requirement[];
}

export function listAllRequirements(filter: {
  modal?: string;
  status?: string;
  subpartCode?: string;
  partNumber?: string;
}): Array<Requirement & { section_code: string; section_title: string; subpart_code: string; part_number: string }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.partNumber) {
    where.push(`sp.part_number = ?`);
    params.push(filter.partNumber);
  }
  if (filter.modal) {
    where.push(`r.modal = ?`);
    params.push(filter.modal);
  }
  if (filter.status) {
    where.push(`r.status = ?`);
    params.push(filter.status);
  }
  if (filter.subpartCode) {
    where.push(`sp.code = ?`);
    params.push(filter.subpartCode);
  }
  const sql = `
    SELECT r.*, s.code AS section_code, s.title AS section_title,
           sp.code AS subpart_code, sp.part_number
    FROM requirements r
    JOIN sections s ON s.id = r.section_id
    JOIN subparts sp ON sp.id = s.subpart_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY sp.part_number, s.ordinal, r.id
  `;
  return getRawDb().prepare(sql).all(...params) as Array<
    Requirement & { section_code: string; section_title: string; subpart_code: string; part_number: string }
  >;
}

export function listXrefsBySection(sectionId: number): CrossRef[] {
  return getRawDb()
    .prepare(`SELECT * FROM cross_refs WHERE source_section_id = ? ORDER BY id`)
    .all(sectionId) as CrossRef[];
}

export function listIncomingXrefs(sectionCode: string): Array<CrossRef & { source_section_code: string }> {
  return getRawDb()
    .prepare(
      `SELECT cr.*, s.code AS source_section_code
       FROM cross_refs cr
       JOIN sections s ON s.id = cr.source_section_id
       WHERE cr.target_kind = 'section' AND cr.target_section_code = ?
       ORDER BY s.ordinal`,
    )
    .all(sectionCode) as Array<CrossRef & { source_section_code: string }>;
}

export function listAllSectionXrefs(partNumber?: string): Array<{
  source: string;
  target: string;
  count: number;
}> {
  const partFilter = partNumber
    ? `AND sp.part_number = ?`
    : "";
  const params = partNumber ? [partNumber] : [];
  return getRawDb()
    .prepare(
      `SELECT s.code AS source, cr.target_section_code AS target, COUNT(*) AS count
       FROM cross_refs cr
       JOIN sections s ON s.id = cr.source_section_id
       JOIN subparts sp ON sp.id = s.subpart_id
       WHERE cr.target_kind = 'section'
         AND cr.target_section_code IN (SELECT code FROM sections)
         ${partFilter}
       GROUP BY s.code, cr.target_section_code`,
    )
    .all(...params) as Array<{ source: string; target: string; count: number }>;
}

export function listAllSectionCodes(): string[] {
  return (getRawDb().prepare(`SELECT code FROM sections ORDER BY ordinal`).all() as Array<{ code: string }>).map(
    (r) => r.code,
  );
}

export function listDefinitions(partNumber?: string): Definition[] {
  if (partNumber) {
    return getRawDb()
      .prepare(
        `SELECT d.* FROM definitions d
         JOIN sections s ON s.id = d.section_id
         JOIN subparts sp ON sp.id = s.subpart_id
         WHERE sp.part_number = ?
         ORDER BY d.term COLLATE NOCASE`,
      )
      .all(partNumber) as Definition[];
  }
  return getRawDb()
    .prepare(`SELECT * FROM definitions ORDER BY term COLLATE NOCASE`)
    .all() as Definition[];
}

export function getDefinitionsMap(): Map<string, Definition> {
  const map = new Map<string, Definition>();
  for (const d of listDefinitions()) map.set(d.term.toLowerCase(), d);
  return map;
}

export function searchParagraphs(query: string, limit = 50) {
  if (!query.trim()) return [];
  const safe = query
    .trim()
    .split(/\s+/)
    .map((t) => `"${t.replace(/"/g, '""')}"`)
    .join(" ");
  return getRawDb()
    .prepare(
      `SELECT p.id, p.designator, p.text_plain, s.code AS section_code, s.title AS section_title,
              sp.part_number,
              snippet(paragraphs_fts, 2, '<mark>', '</mark>', '…', 18) AS snippet
       FROM paragraphs_fts
       JOIN paragraphs p ON p.id = paragraphs_fts.rowid
       JOIN sections s ON s.id = p.section_id
       JOIN subparts sp ON sp.id = s.subpart_id
       WHERE paragraphs_fts MATCH ?
       LIMIT ?`,
    )
    .all(safe, limit) as Array<{
    id: number;
    designator: string | null;
    text_plain: string;
    section_code: string;
    section_title: string;
    part_number: string;
    snippet: string;
  }>;
}

export function getLatestIngest():
  | {
      id: number;
      source_date: string;
      paragraph_count: number;
      section_count: number;
      subpart_count: number;
      completed_at: number;
    }
  | null {
  return (
    (getRawDb()
      .prepare(`SELECT * FROM ingest_runs ORDER BY id DESC LIMIT 1`)
      .get() as
      | {
          id: number;
          source_date: string;
          paragraph_count: number;
          section_count: number;
          subpart_count: number;
          completed_at: number;
        }
      | undefined) ?? null
  );
}
