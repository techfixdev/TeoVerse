-- Reference only — applied by scripts/build-fts.ts
-- Do NOT apply with drizzle-kit push/migrate.
--
-- Probe result: FTS5_EXTERNAL_CONTENT_SUPPORTED
-- Variant: external-content (primary)
--
-- The FTS5 virtual table mirrors the `versiculos` table via the external-content
-- mechanism. `recurso_id` is duplicated UNINDEXED for efficient version filtering
-- during MATCH scans without touching the base table. `content_rowid='id'` maps
-- FTS rowids to versiculos.id so we can JOIN back after ranking.
--
-- Tokenizer: unicode61 remove_diacritics 2 — normalises accents at index time
-- so that "corazon" matches "corazón" and vice-versa (spec FTS-1, FTS-2).
--
-- Population: INSERT INTO versiculos_fts(versiculos_fts) VALUES('rebuild')
-- run as the LAST step of prepare-build-data.ts (after all importers).
-- ROWIDs are unstable (importers DELETE+reinsert per resource), so we never
-- do incremental sync — always a full rebuild.

DROP TABLE IF EXISTS versiculos_fts;

CREATE VIRTUAL TABLE versiculos_fts USING fts5(
  texto,
  recurso_id UNINDEXED,
  content='versiculos',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);
