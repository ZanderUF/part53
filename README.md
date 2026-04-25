# 10 CFR Part 53 — Requirements Tracker

A web app that decomposes 10 CFR Part 53 (NRC's risk-informed, technology-inclusive framework for advanced reactors) into navigable units, surfaces cross-references as inline links and as a graph, and tracks personal study notes today / formal verification later.

## How it works

- **Source**: eCFR.gov bulk XML API (authoritative, structured, auto-tracks amendments)
- **Storage**: SQLite (Drizzle ORM) with FTS5 full-text search
- **App**: Next.js 15 (App Router), Tailwind, React Flow for the cross-reference graph

## Setup

```bash
npm install
npm run ingest      # fetches Part 53 XML from eCFR and populates data/part53.sqlite
npm run dev         # http://localhost:3000
```

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
