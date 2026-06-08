## Current State

TeoVerse imports Bibles from USFM sources (eBible.org) and one HTML source (El Mensaje). All 4 existing importers follow the same pattern: manifest file in `src/importers/`, CLI script in `scripts/`, registered in `prepare-build-data.ts` and `package.json`. The DB uses a unified `recursos` table (tipo='biblia') with per-resource book ordering via `recurso_libros`.

The NTV Bible exists as an e-Sword `.bblx` file (SQLite format) at `C:\Program Files (x86)\e-Sword\NTV Nueva Traducción Viviente.bblx` (~5.22 MB) with a companion `.cmtx` commentary file (~754 KB).

## .bblx Schema (Reverse-Engineered)

### Bible table (primary data)
```sql
CREATE TABLE Bible (Book INT, Chapter INT, Verse INT, Scripture TEXT)
```
- **31,080 rows** (OT: 23,121 | NT: 7,959)
- Book numbers 1-66 (standard Protestant canon, all present)
- Scripture text is **UTF-8** encoded (validated: 0 errors across all rows)
- Footnote markers: asterisk (`*`) appended to words — **4,305 verses** have at least one
- No HTML/RTF markup in Scripture text
- One verse (1 Sam 10:27) contains bracket-interpolated text from Septuagint/DSS

### Details table (metadata)
```sql
CREATE TABLE Details (Description NVARCHAR(255), Abbreviation NVARCHAR(50), Comments TEXT, Version INT, Font NVARCHAR(50), RightToLeft BOOL, OT BOOL, NT BOOL, Apocrypha BOOL, Strong BOOL)
```
- Single row: Description='Nueva Traducción Viviente', Abbreviation='NTV', Version=2
- OT/NT/Apocrypha/Strong all = 0 (boolean encoding quirk — the data itself has all 66 books)
- Comments field contains long RTF document with copyright/publishing info

### Companion .cmtx file (footnotes/commentary)
```sql
CREATE TABLE Books (Book INT, Comments TEXT)        -- 66 rows: book introductions
CREATE TABLE Chapters (Book INT, Chapter INT, Comments TEXT)  -- 0 rows (empty)
CREATE TABLE Details (Description, Abbreviation, Comments, Version)  -- 1 row
CREATE TABLE Verses (Book INT, ChapterBegin INT, ChapterEnd INT, VerseBegin INT, VerseEnd INT, Comments TEXT)  -- 4,308 rows
```
- Footnotes use **RTF markup** (`{\i ...}`, `{\cf2 ...}`, `{\b ...}`)
- **81 multi-verse footnotes** — mostly Hebrew vs. Spanish verse numbering notes
- Footnote types: alternative translations ("O ..."), Hebrew/Greek literal renderings, cultural/historical notes, name meanings

## Affected Areas

- `src/db/schema.ts` — no changes needed; existing `recursos`/`libros`/`versiculos` tables handle NTV
- `src/importers/` — new `bblx.ts` parser + `ntv-manifest.ts` needed
- `scripts/import-ntv.ts` — new CLI import script
- `scripts/prepare-build-data.ts` — add `import:ntv` step
- `package.json` — add `import:ntv` script
- `src/db/queries.ts` — add 'ntv' to `VERSION_ABBREVIATURES` map
- `sources/ntv/` — need to copy .bblx file here (gitignored)

## Approaches

### 1. Reusable bblx parser + NTV manifest (RECOMMENDED)
Create `src/importers/bblx.ts` (generic .bblx SQLite reader) + `src/importers/ntv-manifest.ts` (NTV-specific metadata) + `scripts/import-ntv.ts` (orchestrator).

- **Pros**: Reusable for any e-Sword Bible (22 .bblx files in user's e-Sword dir); follows existing pattern; clean separation of concerns; enables future imports (NVI, RV1960, DHH, etc.)
- **Cons**: Slightly more upfront work; requires `better-sqlite3` dependency to read .bblx
- **Effort**: Medium

### 2. One-off NTV script only
Single `scripts/import-ntv.ts` with hardcoded SQL reads and book mapping.

- **Pros**: Fastest to implement; minimal new code
- **Cons**: Not reusable; duplicates logic for future .bblx imports; breaks existing pattern
- **Effort**: Low

### 3. Convert .bblx to USFM first, then use existing importer
Write a one-time converter that outputs USFM files from .bblx, then use `import-usfm.ts`.

- **Pros**: Reuses existing USFM pipeline; no new runtime dependency
- **Cons**: Lossy conversion (footnotes, formatting); extra build step; fragile; doesn't solve the general .bblx problem
- **Effort**: Medium-High

## Mapping Strategy (.bblx → TeoVerse)

| .bblx Field | TeoVerse Target | Notes |
|---|---|---|
| `Bible.Book` (1-66) | `libros.id` via slug lookup | Direct 1:1 with existing `SPAPDDPT_BOOKS` manifest order |
| `Bible.Chapter` | `versiculos.capitulo` | Direct mapping |
| `Bible.Verse` | `versiculos.versiculo` | Direct mapping |
| `Bible.Scripture` | `versiculos.texto` | Strip trailing `*` footnote markers |
| `Details.Description` | `recursos.nombre` | 'Nueva Traducción Viviente' |
| `Details.Abbreviation` | `VERSION_ABBREVIATURES['ntv']` | 'NTV' |
| CMTX footnotes | **NOT imported** (v1) | No footnote table in schema; future enhancement |
| Strong numbers | **N/A** | NTV has no Strong data |

### Book number → slug mapping (reuse existing manifest)
e-Sword Book 1-39 = AT (Génesis→Malaquías), Book 40-66 = NT (Mateo→Apocalipsis). The numbering is identical to the existing `SPAPDDPT_BOOKS` array order. The importer should define its own `NTV_BOOKS` array with NTV-specific Spanish book names but reuse the same slugs and order.

### Text cleanup required
1. Strip trailing `*` from Scripture text (footnote markers)
2. Preserve bracket passages (1 Sam 10:27 — intentional NTV interpolation)
3. No other markup to strip (confirmed: no HTML, no RTF in Scripture field)

## NTV-Specific Quirks

1. **Footnote markers**: 4,305 verses have `*` appended to words (not at end of verse — inline). Must strip these before storing.
2. **Divine name rendering**: "SEÑOR" (6,092 verses) represents YHWH in small caps; "Señor" (889 verses) represents Adonai. Text stores both as plain uppercase/lowercase — no special markup.
3. **Hebrew verse numbering**: 81 multi-verse footnotes in .cmtx document differences between Hebrew and Spanish verse numbering. The .bblx uses the **Spanish numbering** (which is what TeoVerse should display).
4. **Interpolated passage**: 1 Samuel 10:27 contains bracketed text from the Septuagint/DSS — this is part of the NTV translation, not a data error.
5. **Verse count differences**: OT has 24 fewer verses than KJV; NT has 2 more. Total: 31,080 vs KJV's 31,102. This is normal for translation-level verse numbering decisions.

## Integration with Build Pipeline

1. Copy `.bblx` file to `sources/ntv/NTV.bblx` (gitignored, like other source files)
2. Add `import:ntv` script to `package.json`
3. Add `runPnpmScript('import:ntv')` to `prepare-build-data.ts` (after `import:mensaje`, before `import:tsk`)
4. Add `'ntv': 'NTV'` to `VERSION_ABBREVIATURES` in `queries.ts`
5. No verify script needed initially — existing `verify:bible-queries` and `verify:search-fts` will cover NTV automatically once it's in the DB
6. FTS index rebuild (`build:fts`) already runs last and will pick up NTV verses

## Risks

1. **Copyright**: NTV is © 2009 Tyndale House Publishers, Inc. The .cmtx metadata states "Este módulo no está asociado a los propietarios del Copyright. Solo para uso personal. Prohibida su venta." — need to verify this use case is within fair use / personal study. The NTV license allows quoting up to 500 verses without written permission.
2. **Runtime dependency**: Reading .bblx requires `better-sqlite3` (or similar SQLite reader for Node.js). Currently TeoVerse only uses `@libsql/client` for its own DB. Adding `better-sqlite3` as a devDependency is low-risk since it's only used during build.
3. **Source file availability**: The .bblx file is on the local filesystem, not downloadable. The importer should read from `sources/ntv/` and document how to obtain the file.
4. **Encoding is safe**: UTF-8 validated with 0 errors across all 31,080 verses and 4,308 footnotes. No encoding conversion needed.
5. **No Strong tokens**: NTV has no interlinear data, so `versiculos_tokens` will have no entries for NTV. The UI must handle this gracefully (no Strong links for NTV verses).
6. **Book name differences**: NTV may use slightly different Spanish book names than the existing manifests (e.g., "Cantares" vs "Cantar de los Cantares"). The manifest should use NTV-specific names but reuse existing slugs for URL compatibility.

## Ready for Proposal

**Yes.** The .bblx format is simple (flat table, UTF-8, standard book numbering), the mapping to TeoVerse schema is straightforward, and the existing importer pattern provides a clear template. The main decision points for the user are:

1. **Copyright**: Is importing NTV for personal study acceptable given the license terms?
2. **Footnotes (v1 vs v2)**: Import footnotes now (requires schema changes) or defer to a future iteration?
3. **Reusable parser**: Build a generic .bblx parser (enables importing other e-Sword Bibles later) or keep it NTV-specific?

Recommended: Approach 1 (reusable parser), defer footnotes to v2, copy .bblx to sources/.
