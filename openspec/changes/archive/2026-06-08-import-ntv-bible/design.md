# Design: Import NTV Bible from e-Sword .bblx

## Technical Approach

Add NTV to TeoVerse by building a reusable `.bblx` parser (`src/importers/bblx.ts`) that reads e-Sword SQLite files via `better-sqlite3`, strips inline `*` footnote markers, and returns typed verse arrays. An NTV manifest provides book metadata. A CLI script orchestrates parse → DB insert following the established pattern (spapddpt/mensaje). No schema changes required — existing `recursos`/`libros`/`versiculos` tables handle NTV as-is.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| SQLite reader | `better-sqlite3` (devDep) | `sql.js` (WASM), `libsql` client | Synchronous API, zero-config, prebuilds for Windows. Dev-only — never ships to browser. `sql.js` adds WASM overhead for no benefit. |
| Parser scope | Generic `.bblx` parser + NTV manifest | NTV-only script | User owns 22 `.bblx` files; generic parser enables future imports (NVI, RV1960, DHH) at zero marginal cost. Matches existing pattern (USFM parser + per-version manifests). |
| Footnote handling | Strip `*` markers, defer `.cmtx` | Parse `.cmtx` now | `.cmtx` uses RTF markup requiring a full RTF parser; schema has no footnote table. Stripping `*` is a single regex. Clean separation: v1 = text, v2 = footnotes. |
| Token insertion | Skip `versiculosTokens` | Insert empty tokens | NTV has no Strong data. Mensaje importer already demonstrates the no-tokens path. UI handles missing tokens gracefully (no Strong links). |
| Book mapping | Reuse canonical slugs from `SPAPDDPT_BOOKS` | Define new slugs | URL compatibility — all versions share `/biblia/{version}/genesis/1/` structure. NTV manifest defines NTV-specific _names_ (e.g. "Cantares" vs "Cantar de los Cantares") but identical slugs and order. |

## Data Flow

```
sources/ntv/NTV.bblx
        │
        ▼
  bblx.ts: parseBblx(filePath)
    ├── better-sqlite3 opens .bblx (read-only)
    ├── SELECT Book, Chapter, Verse, Scripture FROM Bible
    ├── Strip '*' from Scripture text
    └── Returns ParsedBblxVerse[] + BblxMetadata
        │
        ▼
  import-ntv.ts: importNtv()
    ├── Upsert recurso (slug='ntv', tipo='biblia')
    ├── Delete existing versiculos + recursoLibros (idempotent re-import)
    ├── For each of 66 books:
    │     ├── Upsert libro (reuse canonical slug)
    │     ├── Insert recursoLibros (orden = book.order)
    │     └── Chunk-insert versiculos (350 per batch)
    └── Log total verse count
        │
        ▼
  local.db (versiculos table)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/importers/bblx.ts` | Create | Generic `.bblx` parser: `parseBblx(path)` → `{ verses, metadata }`. Uses `better-sqlite3` read-only. Strips `*` markers. Validates 66 books present. |
| `src/importers/ntv-manifest.ts` | Create | NTV source metadata + 66-book array with NTV-specific Spanish names, canonical slugs, order. |
| `scripts/import-ntv.ts` | Create | CLI import script: reads `sources/ntv/NTV.bblx`, calls `parseBblx`, inserts into DB. Follows `import-mensaje.ts` structure exactly. |
| `scripts/prepare-build-data.ts` | Modify | Add `runPnpmScript('import:ntv')` after `import:mensaje`, before `import:tsk`. |
| `package.json` | Modify | Add `better-sqlite3` + `@types/better-sqlite3` to devDeps. Add `"import:ntv": "tsx scripts/import-ntv.ts"`. Add `better-sqlite3` to `pnpm.onlyBuiltDependencies`. |
| `src/db/queries.ts` | Modify | Add `ntv: 'NTV'` to `VERSION_ABBREVIATURES` map. |
| `scripts/verify-selector-manifest.ts` | Modify | Add `'ntv'` to `CANONICAL_VERSION_SLUGS` array. |
| `scripts/verify-bible-queries.ts` | Modify | Add NTV-specific assertions (Genesis 1 path, 66 books in library, Juan 3:16 text check). |
| `sources/ntv/` | Create | Directory for `.bblx` file (gitignored, like other `sources/` dirs). |

## Interfaces / Contracts

```typescript
// src/importers/bblx.ts
export type ParsedBblxVerse = {
  book: number;      // 1-66
  chapter: number;
  verse: number;
  text: string;      // '*' markers stripped
};

export type BblxMetadata = {
  description: string;
  abbreviation: string;
  hasOT: boolean;
  hasNT: boolean;
};

export type ParsedBblx = {
  verses: ParsedBblxVerse[];
  metadata: BblxMetadata;
};

export function parseBblx(filePath: string): ParsedBblx;
```

```typescript
// src/importers/ntv-manifest.ts
export const NTV_SOURCE = {
  slug: 'ntv',
  name: 'Nueva Traducción Viviente',
  language: 'es',
  license: string,
  source: string,
  bblxFile: 'NTV.bblx',
} as const;

export type NtvBook = {
  id: string;
  testament: 'AT' | 'NT';
  name: string;
  slug: string;
  abbreviation: string;
  order: number;
};

export const NTV_BOOKS: NtvBook[]; // 66 entries
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Parser unit | `parseBblx` strips `*`, returns 31,080 verses, validates book count | Inline assertions in `import-ntv.ts` (guard clauses, like `import-mensaje.ts` checks `booksFound.length`) |
| Integration | NTV appears in DB with correct verse counts | `verify-bible-queries.ts` — add NTV assertions (Genesis 1 path, 66 books, Juan 3:16 text) |
| Selector | NTV in version selector with correct abbreviation | `verify-selector-manifest.ts` — add `'ntv'` to `CANONICAL_VERSION_SLUGS` |
| FTS | NTV verses searchable | `verify-search-fts.ts` — already covers all versions in DB automatically |
| Build gate | `pnpm verify` exits 0 | Full pipeline: prepare → import → verify → build |

### Verification Invariants
- Total verse count: exactly 31,080
- All 66 books present (Book 1-66)
- Zero `*` characters in any stored `texto`
- Genesis 1:1 text matches expected NTV rendering
- NTV library entry has 66 books with correct chapter counts

## Migration / Rollout

No migration required. NTV is additive — no existing data is modified. Rollback: remove `import:ntv` from pipeline, delete NTV rows from DB, remove files.

## Open Questions

- [ ] NTV license text for `NTV_SOURCE.license` — extract from `.cmtx` Details.Comments or use the known copyright string from the explore phase
- [ ] Exact NTV Spanish book names — need to verify against the `.bblx` data or a reference (e.g. does NTV use "Cantares" or "Cantar de los Cantares"?)
