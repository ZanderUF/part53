import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as path from "node:path";
import * as fs from "node:fs";
import * as schema from "./schema";

const DB_PATH = process.env.PART53_DB_PATH ?? path.join(process.cwd(), "data", "part53.sqlite");

let _db: ReturnType<typeof openDb> | null = null;

function openDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  ensureSchema(sqlite);
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

export function getDb() {
  if (!_db) _db = openDb();
  return _db.db;
}

export function getRawDb() {
  if (!_db) _db = openDb();
  return _db.sqlite;
}

function ensureSchema(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS subparts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_number TEXT NOT NULL DEFAULT '53',
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      ordinal INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS subparts_part_code_idx ON subparts(part_number, code);

    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subpart_id INTEGER NOT NULL REFERENCES subparts(id),
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      ordinal INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS sections_code_idx ON sections(code);
    CREATE INDEX IF NOT EXISTS sections_subpart_idx ON sections(subpart_id);

    CREATE TABLE IF NOT EXISTS paragraphs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_id INTEGER NOT NULL REFERENCES sections(id),
      designator TEXT,
      depth INTEGER NOT NULL DEFAULT 0,
      parent_id INTEGER,
      text_html TEXT NOT NULL,
      text_plain TEXT NOT NULL,
      ordinal INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS paragraphs_section_idx ON paragraphs(section_id);

    CREATE TABLE IF NOT EXISTS requirements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paragraph_id INTEGER NOT NULL REFERENCES paragraphs(id),
      section_id INTEGER NOT NULL REFERENCES sections(id),
      modal TEXT NOT NULL,
      text TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'open'
    );
    CREATE INDEX IF NOT EXISTS requirements_paragraph_idx ON requirements(paragraph_id);
    CREATE INDEX IF NOT EXISTS requirements_section_idx ON requirements(section_id);
    CREATE INDEX IF NOT EXISTS requirements_status_idx ON requirements(status);

    CREATE TABLE IF NOT EXISTS cross_refs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_paragraph_id INTEGER NOT NULL REFERENCES paragraphs(id),
      source_section_id INTEGER NOT NULL REFERENCES sections(id),
      target_kind TEXT NOT NULL,
      target_section_code TEXT,
      target_label TEXT NOT NULL,
      raw TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS cross_refs_source_idx ON cross_refs(source_paragraph_id);
    CREATE INDEX IF NOT EXISTS cross_refs_target_idx ON cross_refs(target_section_code);

    CREATE TABLE IF NOT EXISTS definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term TEXT NOT NULL,
      paragraph_id INTEGER NOT NULL REFERENCES paragraphs(id),
      section_id INTEGER NOT NULL REFERENCES sections(id),
      text TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS definitions_term_idx ON definitions(term);

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_kind TEXT NOT NULL,
      target_code TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS notes_target_idx ON notes(target_kind, target_code);

    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_code TEXT NOT NULL,
      label TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS bookmarks_section_idx ON bookmarks(section_code);

    CREATE TABLE IF NOT EXISTS ingest_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_date TEXT NOT NULL,
      amendment_date TEXT,
      paragraph_count INTEGER NOT NULL,
      section_count INTEGER NOT NULL,
      subpart_count INTEGER NOT NULL,
      completed_at INTEGER NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS paragraphs_fts USING fts5(
      designator,
      section_code,
      text_plain
    );
  `);
}

export function rebuildFts() {
  const sqlite = getRawDb();
  sqlite.exec(`DELETE FROM paragraphs_fts;`);
  const insert = sqlite.prepare(
    `INSERT INTO paragraphs_fts (rowid, designator, section_code, text_plain) VALUES (?, ?, ?, ?)`,
  );
  const rows = sqlite
    .prepare(
      `SELECT p.id, p.designator, s.code AS section_code, p.text_plain
       FROM paragraphs p JOIN sections s ON s.id = p.section_id`,
    )
    .all() as Array<{ id: number; designator: string | null; section_code: string; text_plain: string }>;
  const tx = sqlite.transaction(() => {
    for (const r of rows) insert.run(r.id, r.designator ?? "", r.section_code, r.text_plain);
  });
  tx();
}
