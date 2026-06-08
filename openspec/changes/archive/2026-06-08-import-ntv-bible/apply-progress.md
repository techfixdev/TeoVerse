# Apply Progress: Import NTV Bible from e-Sword .bblx

## Mode: Standard (no strict TDD)
## Chain strategy: stacked-to-main
## Current work unit: PR 3 — Verification Extensions (COMPLETE)

## PR 1: Generic BBLX Parser (Foundation) — COMPLETE

- [x] 1.1 Add `better-sqlite3` and `@types/better-sqlite3` to `devDependencies` in `package.json`; add `better-sqlite3` to `pnpm.onlyBuiltDependencies`
- [x] 1.2 Create `src/importers/bblx.ts` with types `ParsedBblxVerse`, `BblxMetadata`, `ParsedBblx` and function `parseBblx(filePath: string): ParsedBblx`
- [x] 1.3 Implement SQLite read via `better-sqlite3` (read-only): `SELECT Book, Chapter, Verse, Scripture FROM Bible`
- [x] 1.4 Implement `*` footnote marker stripping with regex replacement on `Scripture` field
- [x] 1.5 Implement `Details` table metadata extraction (description, abbreviation, hasOT, hasNT)
- [x] 1.6 Add validation: throw descriptive error if file is not valid SQLite or lacks `Bible` table
- [x] 1.7 Add validation: warn if book count does not cover 1–66

## PR 2: NTV Import Pipeline (Consumer) — COMPLETE

- [x] 2.1 Create `src/importers/ntv-manifest.ts` with `NTV_SOURCE` constant (slug, name, language, license, source, bblxFile)
- [x] 2.2 Define `NTV_BOOKS` array: 66 entries with NTV Spanish names, canonical slugs matching `SPAPDDPT_BOOKS` positional order, testament, abbreviation, order
- [x] 2.3 Create `scripts/import-ntv.ts` CLI script following `import-mensaje.ts` structure: read source, parse, upsert recurso/libros/versiculos
- [x] 2.4 Implement idempotent re-import: delete existing NTV versiculos and recursoLibros before insert
- [x] 2.5 Implement chunked verse insertion (350 per batch) for performance
- [x] 2.6 Add guard clause: exit with descriptive error if `sources/ntv/NTV.bblx` does not exist
- [x] 2.7 Add `"import:ntv": "tsx scripts/import-ntv.ts"` to `package.json` scripts
- [x] 2.8 Add `runPnpmScript('import:ntv')` to `scripts/prepare-build-data.ts` after `import:mensaje`, before `import:tsk`
- [x] 2.9 Add `ntv: 'NTV'` to `VERSION_ABBREVIATURES` in `src/db/queries.ts`
- [x] 2.10 Create `sources/ntv/` directory (gitignored, matching existing `sources/` pattern)

## PR 3: Verification Extensions (Quality Gate) — COMPLETE

- [x] 3.1 Add `'ntv'` to `CANONICAL_VERSION_SLUGS` array in `scripts/verify-selector-manifest.ts`
- [x] 3.2 Add NTV Genesis 1:1 path assertion to `scripts/verify-bible-queries.ts` (expected NTV text)
- [x] 3.3 Add NTV library assertion: 66 books with correct chapter counts in `scripts/verify-bible-queries.ts`
- [x] 3.4 Add NTV Juan 3:16 text content check in `scripts/verify-bible-queries.ts`
- [x] 3.5 Add assertion: zero `*` characters in any stored NTV `texto` field
- [x] 3.6 Add assertion: total NTV verse count equals 31,080
- [x] 3.7 Run `pnpm verify` end-to-end and confirm exit 0

## Files Changed (PR 1)

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modified | Added `better-sqlite3` + `@types/better-sqlite3` to devDeps, added `better-sqlite3` to `pnpm.onlyBuiltDependencies` |
| `pnpm-lock.yaml` | Modified | Lockfile updated with new dependencies |
| `src/importers/bblx.ts` | Created | Generic `.bblx` parser: `parseBblx(path)` → `{ verses, metadata }`. Uses `better-sqlite3` read-only. Strips `*` markers. Validates SQLite + Bible table. Warns on incomplete book coverage. |

## Files Changed (PR 2)

| File | Action | Description |
|------|--------|-------------|
| `src/importers/ntv-manifest.ts` | Created | NTV source metadata (`NTV_SOURCE`) + 66-book array (`NTV_BOOKS`) with canonical slugs matching SPAPDDPT positional order. License extracted from .bblx RTF Comments field. |
| `scripts/import-ntv.ts` | Created | CLI import script: reads `sources/ntv/NTV.bblx`, calls `parseBblx`, upserts recurso/libros, deletes existing data for idempotent re-import, chunk-inserts versiculos (350/batch). Guard clauses for missing source file and incomplete book count. |
| `package.json` | Modified | Added `"import:ntv": "tsx scripts/import-ntv.ts"` to scripts |
| `scripts/prepare-build-data.ts` | Modified | Added `runPnpmScript('import:ntv')` after `import:mensaje`, before `import:tsk` |
| `src/db/queries.ts` | Modified | Added `ntv: 'NTV'` to `VERSION_ABBREVIATURES` |
| `sources/ntv/` | Created | Directory for NTV.bblx source file (gitignored via existing `sources/` pattern) |

## Files Changed (PR 3)

| File | Action | Description |
|------|--------|-------------|
| `scripts/verify-selector-manifest.ts` | Modified | Added `'ntv'` to `CANONICAL_VERSION_SLUGS` array (now 5 versions total) |
| `scripts/verify-bible-queries.ts` | Modified | Added NTV assertions: Genesis 1:1 path, 66 books library check, Juan 3:16 text content (mentions Dios), zero asterisk characters in texto fields, total verse count equals 31,080 |

## Verification

### PR 1
- `pnpm astro check`: 0 errors, 0 warnings (1 pre-existing hint in TskPanel.astro)

### PR 2
- `pnpm astro check`: 0 errors, 0 warnings (1 pre-existing hint in TskPanel.astro)
- `pnpm run import:ntv`: Successfully imported 31,080 NTV verses from NTV.bblx

### PR 3
- `pnpm verify:bible-queries`: PASS — NTV: 66 books, 31080 total verses
- `pnpm verify:selector-manifest`: PASS — Selector manifest: 5 versions, 5945 total chapters
- `pnpm verify:search-fts`: PASS — 7 passed, 0 failed
- `pnpm verify:daily-readings`: PASS — 6 passed, 0 failed (listBibliaVersions returned 5 versions including ntv)
- `pnpm verify:usfm-parser`: PASS
- `pnpm verify:usfm-importer`: PASS
- `pnpm verify:usfm-interlinear`: PASS — Genesis 1:1 / 1:2 integration assertions OK, broad reconstruction invariant verified on 1938 verses
- `pnpm verify:tokens`: PASS — Total tokens in DB: 659174
- `pnpm verify:strong`: PASS
- `pnpm astro check`: 0 errors, 0 warnings (1 pre-existing hint in TskPanel.astro)
- `pnpm astro build`: Successfully generating NTV pages (/biblia/ntv/genesis/1/index.html, etc.)

## Branches

- PR 1: `feat/bblx-parser` (off main) — commit `bebd658`
- PR 2: `feat/ntv-import` (off `feat/bblx-parser`) — commit `e34b157`
- PR 3: `feat/ntv-verify` (off `feat/ntv-import`) — commit `910e25f`

## Summary

All 3 PRs complete. NTV Bible version fully integrated:
- Generic .bblx parser (reusable for future e-Sword imports)
- NTV manifest with 66 books and canonical slugs
- CLI import script with idempotent re-import and chunked insertion
- Full verification suite with NTV-specific assertions
- All CI gates pass (pnpm verify exit 0)
