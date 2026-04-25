# 10 CFR Part 53 — Requirements Tracker

A web app that decomposes 10 CFR Part 53 (NRC's risk-informed, technology-inclusive framework for advanced reactors) into navigable units, surfaces cross-references as inline links and as a graph, and tracks personal study notes today / formal verification later.

## How it works

- **Source**: Federal Register XML for the published final rule (doc `2026-06048`,
  91 FR 15694, Mar. 30, 2026 — the same content backing the regulations.gov
  page at `https://www.regulations.gov/document/NRC-2019-0062-0310`).
  An eCFR-based ingest is also available as a fallback once eCFR catches up.
- **Storage**: SQLite (Drizzle ORM) with FTS5 full-text search.
- **App**: Next.js 15 (App Router), Tailwind, React Flow for the cross-reference graph.

## Setup

```bash
npm install
npm run ingest      # fetches the Part 53 final-rule XML from federalregister.gov
npm run dev         # http://localhost:3000
```

Override the source document with `FR_DOC=YYYY-NNNNN npm run ingest` (e.g.
`2026-07090` for the April 13, 2026 correction). Use `npm run ingest:ecfr`
to pull from eCFR.gov instead, or `npm run seed:sample` for a tiny labeled
sample dataset.

The `ingest` script is idempotent and preserves user data (notes, bookmarks, requirement statuses) across re-runs.

## What you get

- **Browse**: Subpart → Section → Paragraph hierarchy with paragraph designators preserved (`(a)(1)(i)`).
- **Search**: SQLite FTS5 across every paragraph.
- **Requirements catalog**: Auto-extracted "shall / must / may not" statements, taggable, with read/understood/verified status.
- **Cross-references**: Inline links for every `§ 53.xxx` and `10 CFR 50.xx` reference; graph view to explore the network.
- **Glossary**: Subpart A definitions surfaced as hover-cards everywhere their term appears.
- **Notes & bookmarks**: Personal markdown notes attached to any paragraph or requirement.

## Phasing

- **Phase 1 (this build)**: Personal study tool — browse, search, requirements catalog, graph, glossary, notes.
- **Phase 2 (later)**: Verification workflow with evidence attachments, owners, audit log, CSV export.

## Verification

See `/root/.claude/plans/the-goal-of-this-imperative-squirrel.md` for the verification checklist used after ingest.
