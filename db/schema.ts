import { sqliteTable, integer, text, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const subparts = sqliteTable(
  "subparts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    partNumber: text("part_number").notNull().default("53"),
    code: text("code").notNull(),
    title: text("title").notNull(),
    ordinal: integer("ordinal").notNull(),
  },
  (t) => ({
    partCodeIdx: uniqueIndex("subparts_part_code_idx").on(t.partNumber, t.code),
  }),
);

export const sections = sqliteTable(
  "sections",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    subpartId: integer("subpart_id").notNull().references(() => subparts.id),
    code: text("code").notNull(),
    title: text("title").notNull(),
    ordinal: integer("ordinal").notNull(),
  },
  (t) => ({
    codeIdx: uniqueIndex("sections_code_idx").on(t.code),
    subpartIdx: index("sections_subpart_idx").on(t.subpartId),
  }),
);

export const paragraphs = sqliteTable(
  "paragraphs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sectionId: integer("section_id").notNull().references(() => sections.id),
    designator: text("designator"),
    depth: integer("depth").notNull().default(0),
    parentId: integer("parent_id"),
    textHtml: text("text_html").notNull(),
    textPlain: text("text_plain").notNull(),
    ordinal: integer("ordinal").notNull(),
  },
  (t) => ({
    sectionIdx: index("paragraphs_section_idx").on(t.sectionId),
  }),
);

export const requirements = sqliteTable(
  "requirements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    paragraphId: integer("paragraph_id").notNull().references(() => paragraphs.id),
    sectionId: integer("section_id").notNull().references(() => sections.id),
    modal: text("modal").notNull(),
    text: text("text").notNull(),
    tags: text("tags").notNull().default("[]"),
    status: text("status").notNull().default("open"),
  },
  (t) => ({
    paragraphIdx: index("requirements_paragraph_idx").on(t.paragraphId),
    sectionIdx: index("requirements_section_idx").on(t.sectionId),
    statusIdx: index("requirements_status_idx").on(t.status),
  }),
);

export const crossRefs = sqliteTable(
  "cross_refs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceParagraphId: integer("source_paragraph_id").notNull().references(() => paragraphs.id),
    sourceSectionId: integer("source_section_id").notNull().references(() => sections.id),
    targetKind: text("target_kind").notNull(),
    targetSectionCode: text("target_section_code"),
    targetLabel: text("target_label").notNull(),
    raw: text("raw").notNull(),
  },
  (t) => ({
    sourceIdx: index("cross_refs_source_idx").on(t.sourceParagraphId),
    targetIdx: index("cross_refs_target_idx").on(t.targetSectionCode),
  }),
);

export const definitions = sqliteTable(
  "definitions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    term: text("term").notNull(),
    paragraphId: integer("paragraph_id").notNull().references(() => paragraphs.id),
    sectionId: integer("section_id").notNull().references(() => sections.id),
    text: text("text").notNull(),
  },
  (t) => ({
    termIdx: uniqueIndex("definitions_term_idx").on(t.term),
  }),
);

export const notes = sqliteTable(
  "notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    targetKind: text("target_kind").notNull(),
    targetCode: text("target_code").notNull(),
    body: text("body").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    targetIdx: index("notes_target_idx").on(t.targetKind, t.targetCode),
  }),
);

export const bookmarks = sqliteTable(
  "bookmarks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sectionCode: text("section_code").notNull(),
    label: text("label"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    codeIdx: uniqueIndex("bookmarks_section_idx").on(t.sectionCode),
  }),
);

export const ingestRuns = sqliteTable("ingest_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceDate: text("source_date").notNull(),
  amendmentDate: text("amendment_date"),
  paragraphCount: integer("paragraph_count").notNull(),
  sectionCount: integer("section_count").notNull(),
  subpartCount: integer("subpart_count").notNull(),
  completedAt: integer("completed_at").notNull(),
});
