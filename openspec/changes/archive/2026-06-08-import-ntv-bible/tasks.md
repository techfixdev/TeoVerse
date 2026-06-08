# Tasks: Import NTV Bible from e-Sword .bblx

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 380–470 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | force-chained |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Generic .bblx parser + better-sqlite3 dep | PR 1 | base: main; reusable foundation |
| 2 | NTV manifest + CLI import + pipeline wiring | PR 2 | base: main (after PR 1); first consumer |
| 3 | Verification extensions for NTV | PR 3 | base: main (after PR 2); quality gate |

## PR 1: Generic BBLX Parser (Foundation)

- [x] 1.1 Add `better-sqlite3` and `@types/better-sqlite3` to `devDependencies` in `package.json`; add `better-sqlite3` to `pnpm.onlyBuiltDependencies`
- [x] 1.2 Create `src/importers/bblx.ts` with types `ParsedBblxVerse`, `BblxMetadata`, `ParsedBblx` and function `parseBblx(filePath: string): ParsedBblx`
- [x] 1.3 Implement SQLite read via `better-sqlite3` (read-only): `SELECT Book, Chapter, Verse, Scripture FROM Bible`
- [x] 1.4 Implement `*` footnote marker stripping with regex replacement on `Scripture` field
- [x] 1.5 Implement `Details` table metadata extraction (description, abbreviation, hasOT, hasNT)
- [x] 1.6 Add validation: throw descriptive error if file is not valid SQLite or lacks `Bible` table
- [x] 1.7 Add validation: warn if book count does not cover 1–66

## PR 2: NTV Import Pipeline (Consumer)

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

## PR 3: Verification Extensions (Quality Gate)

- [x] 3.1 Add `'ntv'` to `CANONICAL_VERSION_SLUGS` array in `scripts/verify-selector-manifest.ts`
- [x] 3.2 Add NTV Genesis 1:1 path assertion to `scripts/verify-bible-queries.ts` (expected NTV text)
- [x] 3.3 Add NTV library assertion: 66 books with correct chapter counts in `scripts/verify-bible-queries.ts`
- [x] 3.4 Add NTV Juan 3:16 text content check in `scripts/verify-bible-queries.ts`
- [x] 3.5 Add assertion: zero `*` characters in any stored NTV `texto` field
- [x] 3.6 Add assertion: total NTV verse count equals 31,080
- [x] 3.7 Run `pnpm verify` end-to-end and confirm exit 0
