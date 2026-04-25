import { getRawDb } from "./client";

export type Subpart = { id: number; code: string; title: string; ordinal: number };
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

export function listSubparts(): Subpart[] {
  return getRawDb()
    .prepare(`SELECT * FROM subparts ORDER BY ordinal`)
    .all() as Subpart[];
}

export function getSubpart(code: string): Subpart | null {
  return (
    (getRawDb()
      .prepare(`SELECT * FROM subparts WHERE code = ?`)
      .get(code) as Subpart | undefined) ?? null
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
}): Array<Requirement & { section_code: string; section_title: string; subpart_code: string }> {
  const where: string[] = [];
  const params: unknown[] = [];
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
    SELECT r.*, s.code AS section_code, s.title AS section_title, sp.code AS subpart_code
    FROM requirements r
    JOIN sections s ON s.id = r.section_id
    JOIN subparts sp ON sp.id = s.subpart_id
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY s.ordinal, r.id
  `;
  return getRawDb().prepare(sql).all(...params) as Array<
    Requirement & { section_code: string; section_title: string; subpart_code: string }
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

export function listAllSectionXrefs(): Array<{
  source: string;
  target: string;
  count: number;
}> {
  return getRawDb()
    .prepare(
      `SELECT s.code AS source, cr.target_section_code AS target, COUNT(*) AS count
       FROM cross_refs cr
       JOIN sections s ON s.id = cr.source_section_id
       WHERE cr.target_kind = 'section'
         AND cr.target_section_code IN (SELECT code FROM sections)
       GROUP BY s.code, cr.target_section_code`,
    )
    .all() as Array<{ source: string; target: string; count: number }>;
}

export function getSectionById(id: number): Section | null {
  return (
    (getRawDb()
      .prepare(`SELECT * FROM sections WHERE id = ?`)
      .get(id) as Section | undefined) ?? null
  );
}

export function listAllSectionCodes(): string[] {
  return (getRawDb().prepare(`SELECT code FROM sections ORDER BY ordinal`).all() as Array<{ code: string }>).map(
    (r) => r.code,
  );
}

export function listDefinitions(): Definition[] {
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
  // FTS5: escape double quotes by doubling, wrap each token in quotes for "phrase-or-prefix" matching.
  const safe = query
    .trim()
    .split(/\s+/)
    .map((t) => `"${t.replace(/"/g, '""')}"`)
    .join(" ");
  return getRawDb()
    .prepare(
      `SELECT p.id, p.designator, p.text_plain, s.code AS section_code, s.title AS section_title,
              snippet(paragraphs_fts, 2, '<mark>', '</mark>', '…', 18) AS snippet
       FROM paragraphs_fts
       JOIN paragraphs p ON p.id = paragraphs_fts.rowid
       JOIN sections s ON s.id = p.section_id
       WHERE paragraphs_fts MATCH ?
       LIMIT ?`,
    )
    .all(safe, limit) as Array<{
    id: number;
    designator: string | null;
    text_plain: string;
    section_code: string;
    section_title: string;
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
