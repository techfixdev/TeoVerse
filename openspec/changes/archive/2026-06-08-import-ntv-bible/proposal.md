# Proposal: Import NTV Bible from e-Sword .bblx

## Intent

Add the Nueva Traducción Viviente (NTV) Bible to TeoVerse by building a reusable `.bblx` parser. The NTV exists as an e-Sword SQLite file (31,080 verses, 66 books, UTF-8). A generic parser enables importing any of the 22 other `.bblx` files the user owns (NVI, RV1960, DHH, etc.).

## Scope

### In Scope
- Generic `.bblx` parser (`src/importers/bblx.ts`) — reads SQLite `Bible` table, strips `*` footnote markers, returns typed verses
- NTV manifest (`src/importers/ntv-manifest.ts`) — book names, slugs, metadata, license
- CLI import script (`scripts/import-ntv.ts`) — orchestrates parse → DB insert
- Pipeline integration — register in `prepare-build-data.ts` + `package.json`
- VERSION_ABBREVIATURES registration — add `ntv: 'NTV'` to `queries.ts`
- Verification — existing `verify-bible-queries` and `verify-search-fts` cover NTV automatically

### Out of Scope
- Footnotes from `.cmtx` companion file (deferred to v2 — requires schema changes)
- Strong number tokens (N/A — NTV has no interlinear data)
- Schema changes (existing `recursos`/`libros`/`versiculos` tables handle NTV as-is)
- UI changes (version selector already data-driven)

## Capabilities

### New Capabilities
- `bblx-importer`: Generic e-Sword `.bblx` SQLite parser — reads `Bible` and `Details` tables, cleans footnote markers, returns structured verse data for any `.bblx` file

### Modified Capabilities
None. Existing `accessibility` and `cross-references` specs are unaffected.

## Approach

Follow the established importer pattern (USFM/SPAPDDPT/MSG):

1. **Parser** (`bblx.ts`): Open `.bblx` with `better-sqlite3`, query `Bible` table, strip inline `*` markers, return `ParsedBblxVerse[]`. Read `Details` for metadata.
2. **Manifest** (`ntv-manifest.ts`): Define `NTV_BOOKS[66]` with NTV-specific Spanish names + existing slugs (reuse `SPAPDDPT_BOOKS` slug order). Include license/source metadata.
3. **CLI script** (`import-ntv.ts`): Read `.bblx` from `sources/ntv/NTV.bblx`, call parser, insert into DB via existing `recursos`/`libros`/`versiculos` pattern.
4. **Pipeline**: Add `runPnpmScript('import:ntv')` after `import:mensaje`, before `import:tsk` in `prepare-build-data.ts`.

### Mapping

| .bblx Field | TeoVerse Target | Notes |
|---|---|---|
| `Bible.Book` (1-66) | `libros.id` via slug | Direct 1:1 with `SPAPDDPT_BOOKS` order |
| `Bible.Chapter` | `versiculos.capitulo` | Direct |
| `Bible.Verse` | `versiculos.versiculo` | Direct |
| `Bible.Scripture` | `versiculos.texto` | Strip `*` markers |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/importers/bblx.ts` | New | Generic .bblx parser |
| `src/importers/ntv-manifest.ts` | New | NTV book names + metadata |
| `scripts/import-ntv.ts` | New | CLI import orchestrator |
| `scripts/prepare-build-data.ts` | Modified | Add `import:ntv` step |
| `package.json` | Modified | Add `better-sqlite3` devDep + `import:ntv` script |
| `src/db/queries.ts` | Modified | Add `ntv: 'NTV'` to VERSION_ABBREVIATURES |
| `sources/ntv/` | New | Copy `.bblx` file (gitignored) |
| `src/db/schema.ts` | None | No changes needed |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `better-sqlite3` native build fails on Windows | Low | Well-maintained package; prebuilds available; devDep only |
| NTV book names differ from existing manifests | Med | Manifest defines NTV-specific names; slugs stay identical for URL compat |
| Source `.bblx` file not in repo | Low | Document manual copy step; gitignore like other sources |

## Rollback Plan

1. Remove `import:ntv` from `prepare-build-data.ts`
2. Delete `src/importers/bblx.ts`, `src/importers/ntv-manifest.ts`, `scripts/import-ntv.ts`
3. Remove `ntv` entry from `VERSION_ABBREVIATURES`
4. Run `DELETE FROM versiculos WHERE version = 'ntv'` + cascade on `recursos`/`libros`
5. Remove `better-sqlite3` from `package.json`

## Dependencies

- `better-sqlite3` (devDependency) — reads `.bblx` SQLite files at build time
- NTV `.bblx` source file — must be manually copied to `sources/ntv/NTV.bblx`

## Success Criteria

- [ ] `pnpm import:ntv` inserts 31,080 verses across 66 books into local DB
- [ ] `verify-bible-queries` passes with NTV included
- [ ] `verify-search-fts` passes (FTS index includes NTV verses)
- [ ] NTV appears in version selector with abbreviation "NTV"
- [ ] Zero `*` footnote markers in stored verse text
- [ ] `bblx.ts` parser is reusable — no NTV-specific logic in parser module
