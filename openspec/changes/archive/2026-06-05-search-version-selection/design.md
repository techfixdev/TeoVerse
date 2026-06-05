# Design: search-version-selection

Architectural design for FTS5 accent-insensitive search, DB-driven version pills, and
selector-following daily readings. Reads from proposal `sdd/search-version-selection/proposal`
and exploration `sdd/search-version-selection/explore`.

## 1. Architecture Overview

Pattern: **thin serverless query endpoints over a build-populated SQLite/LibSQL store**, with
**progressive-enhancement islands** on a static page. No new runtime layers, no new stores.

```
                         build / seed pipeline (writes DB)
  USFM sources ─► import:* ─► versiculos ──┐
                                           ├─► build:fts (raw SQL) ─► versiculos_fts (FTS5)
                                           │      'rebuild' from external content
  plan_lectura ◄── db:seed-plan            │
                                           ▼
  ┌──────────────────────────── DB (local.db @build  |  Turso @prod) ────────────────────────────┐
  │  recursos · libros · recurso_libros · versiculos · versiculos_fts · plan_lectura · …          │
  └───────────────────────────────────────────────────────────────────────────────────────────────┘
        ▲                         ▲                              ▲
        │ prerender:true          │ prerender:false (serverless) │ prerender:false (serverless)
        │                         │                              │
  /datos/biblioteca.json    /buscar.json (FTS5 MATCH+bm25)   /datos/lectura-diaria.json?version=X
        │                         │                              │
        ▼                         ▼                              ▼
  index.astro (STATIC)  ── islands ──►  version pills        daily-readings skeleton+fill
        $selector (rv:last-selection, single source of truth — no new store)
```

Boundaries:
- **DB schema (raw SQL)** owns the FTS5 virtual table — `drizzle-kit push` cannot see it.
- **Query layer** (`src/db/queries.ts`) owns parameterized reads; endpoints stay thin.
- **Endpoints** own HTTP shape + input validation; no business logic beyond sanitization.
- **Islands** own hydration/UX; they read `$selector`, never write search-only state.

## 2. CRITICAL DECISION — FTS5 on LibSQL (validation gate from proposal)

### 2.1 Capability assessment
- Installed: `@libsql/client@0.17.3` over native `libsql@0.5.29`. LibSQL is a SQLite fork that
  ships FTS5 compiled in (same as Turso prod). `unicode61` tokenizer with `remove_diacritics 2`
  and `bm25()` are part of the FTS5 module, available on both `file:local.db` and Turso.
- Raw SQL path: drizzle-orm exposes `db.run(sql\`…\`)` and the underlying client exposes
  `client.execute({ sql, args })`. Both run arbitrary FTS5 DDL/DML. FTS5 is OUTSIDE Drizzle's
  typed schema API by design — that is expected and fine.

### 2.2 Why a runtime probe, not a blind assumption
A throwaway probe script (`scripts/_fts5-probe.ts`, can run via `tsx`) creates an in-memory
external-content FTS5 table, runs `'rebuild'`, and asserts that `MATCH 'corazon'` returns rows
containing "corazón" and `MATCH 'examinara'` returns "examínara". The apply phase MUST run this
probe FIRST as the validation gate. If it prints `FTS5_EXTERNAL_CONTENT_SUPPORTED`, use the
primary design (§2.3). If it fails, fall back to the standalone table (§2.4). This converts the
proposal's "Medium" risk into a deterministic, code-checked gate.

### 2.3 Primary design — external-content FTS5 (mirrors `versiculos`)

```sql
-- raw-SQL migration, NOT managed by drizzle-kit (reference file in drizzle/, applied by build:fts)
DROP TABLE IF EXISTS versiculos_fts;
CREATE VIRTUAL TABLE versiculos_fts USING fts5(
  texto,
  recurso_id UNINDEXED,          -- stored so we can filter without joining back for the filter
  content='versiculos',          -- external content: index points at versiculos rows
  content_rowid='id',            -- rowid alignment with versiculos.id
  tokenize='unicode61 remove_diacritics 2'
);
INSERT INTO versiculos_fts(versiculos_fts) VALUES('rebuild');
```

Rationale: external content keeps the FTS index storage-lean (no duplicated `texto`) and `'rebuild'`
re-derives the entire index from `versiculos` in one statement — ideal for an ephemeral, fully
re-seeded DB. `recurso_id` is duplicated UNINDEXED into the FTS table so the version filter
(`WHERE versiculos_fts.recurso_id IN (...)`) can be applied during the MATCH scan; final display
fields are joined from `versiculos`/`recursos`/`libros` after ranking.

CRITICAL rowid-alignment note: the importers DELETE+re-INSERT all verses per resource on every
run (`import-sparvg.ts:48`), so `versiculos.id` (AUTOINCREMENT rowid) is NOT stable across
imports. External content tracks `content_rowid`, so the FTS index MUST be (re)built AFTER all
imports complete — never incrementally during import. We achieve this by running `'rebuild'`
once at the end of the data pipeline (§4). We do NOT add FTS5 triggers (the standard external-content
sync triggers), because the bulk delete/re-insert pattern would generate millions of trigger
firings; a single `'rebuild'` after the bulk load is correct and far cheaper.

### 2.4 Fallback design — standalone FTS5 (no external content)
If the probe fails on `'rebuild'` or external content:

```sql
DROP TABLE IF EXISTS versiculos_fts;
CREATE VIRTUAL TABLE versiculos_fts USING fts5(
  versiculo_id UNINDEXED,
  recurso_id UNINDEXED,
  texto,
  tokenize='unicode61 remove_diacritics 2'
);
-- populate by streaming rows in chunks:
INSERT INTO versiculos_fts(versiculo_id, recurso_id, texto)
  SELECT id, recurso_id, texto FROM versiculos;
```

Here the FTS table stores `texto` + `versiculo_id` + `recurso_id` directly; the search query uses
`versiculos_fts.versiculo_id` to join back for `capitulo/versiculo/libro`. Slightly more storage,
identical query ergonomics, zero dependence on rowid alignment. This is the safe default if any
doubt remains.

### 2.5 Tokenizer config
`unicode61 remove_diacritics 2` — `remove_diacritics 2` is the Unicode-correct mode (folds
combining marks across the full BMP, unlike legacy `1`). This satisfies the success criteria:
"corazon"→"corazón", "El"→"Él", "examinara"→"examínara". Case folding is inherent to `unicode61`.

### 2.6 Migration + pipeline placement
- Reference SQL lives at `drizzle/0003_versiculos_fts.sql` (reference-only, like
  `0002_versiculos_tokens.sql` — NOT applied by `drizzle-kit push`).
- A NEW script `scripts/build-fts.ts` applies the DDL + population idempotently
  (`DROP TABLE IF EXISTS` → `CREATE VIRTUAL TABLE` → `'rebuild'`/bulk insert). Idempotency comes
  from the unconditional drop+recreate, so re-running is always safe and always reflects current
  `versiculos`.
- Add `pnpm` script `"build:fts": "tsx scripts/build-fts.ts"`.

## 3. CRITICAL DECISION — Turso / prod parity (correctness gate from exploration risk #1)

### 3.1 The trap (verified in code)
`scripts/prepare-build-data.ts:3-9` EXITS EARLY when `TURSO_CONNECTION_URL` is set:
```
if (hasTursoConnection) { …skipping local build DB preparation…; process.exit(0); }
```
So in production the build does NOT seed/import/populate anything — it assumes Turso is already
populated out-of-band. Meanwhile `src/db/client.ts:6-8` makes `/buscar.json` (a `prerender:false`
serverless function) query **Turso in production** (it uses `TURSO_CONNECTION_URL` when present,
else `file:local.db`). 

Consequence: if FTS5 population were wired ONLY into the local-only branch of
`prepare-build-data.ts`, the static pages would build fine but the production `/buscar.json`
endpoint would query a Turso DB where `versiculos_fts` DOES NOT EXIST → every prod search throws
"no such table: versiculos_fts". This is the single highest-severity correctness risk.

### 3.2 Resolution — FTS population must run against BOTH DB targets
`scripts/build-fts.ts` MUST be DB-target-agnostic: it imports `client` from `src/db/client.ts`,
which already resolves to Turso when `TURSO_CONNECTION_URL` is set and `file:local.db` otherwise.
Therefore the SAME script populates whichever DB the env points at.

Wiring:
1. **Local build**: append `runPnpmScript('build:fts')` as the LAST step of the local branch in
   `prepare-build-data.ts` (after all imports + `db:seed-plan`). This populates `local.db`.
2. **Prod / Turso seeding**: whatever process currently seeds Turso (the out-of-band import that
   makes prod work today) MUST also run `pnpm build:fts` against Turso as its final step. Document
   this explicitly in the migration SQL header AND in the script. If Turso seeding is a manual
   runbook, add `build:fts` to that runbook; if it is a CI/script, append the call there.
3. **Endpoint self-defense**: `/buscar.json` wraps the FTS query in try/catch; on a "no such
   table" / FTS error it returns a graceful `{ results: [], count: 0, query, degraded: true }`
   (HTTP 200) and logs, instead of a 500. This prevents a missing/un-rebuilt FTS table from taking
   down the home page search box. It is a safety net, NOT a substitute for §3.2.1-2.

### 3.3 Acceptance for parity
Prod parity is "done" only when, against the Turso URL, `SELECT count(*) FROM versiculos_fts` > 0
and a `MATCH` smoke query returns rows. The apply/verify phase must assert this against the prod
DB path (or a Turso staging branch), not only against `local.db`.

## 4. Build / Seed pipeline integration

```
prepare-build-data.ts (local branch only):
  db:push  ─►  db:seed  ─►  import:spapddpt … import:mensaje  ─►  import:tsk  ─►  db:seed-plan
     │                                                                                  │
     └──────────────────────────────────────────────────────────────────────────────► build:fts  (NEW, LAST)
```

- `build:fts` runs LAST because external-content `'rebuild'` requires `versiculos` fully loaded and
  rowids settled (importers delete+reinsert, so any earlier rebuild would be stale).
- Re-seed idempotency: `build-fts.ts` does `DROP TABLE IF EXISTS versiculos_fts` then recreate +
  rebuild every run. There is no partial/incremental state to corrupt. Matches the existing
  "ephemeral DB, re-seeded each build" model documented in `0002_versiculos_tokens.sql`.
- `pnpm verify` chain: add `build:fts` to the verify pipeline too (after `prepare:build-data`
  already runs it for local; ensure the FTS table exists before `verify:*` and `build:astro`). A
  new `verify:search` smoke test (asserts accent-insensitive MATCH returns expected rows) is
  recommended but optional for this change.

## 5. Query design — `/buscar.json` rewrite

### 5.1 Sanitization (FTS5 syntax safety — REQUIRED)
FTS5 `MATCH` interprets `"`, `*`, `(`, `)`, `:`, `^`, `-`, `AND/OR/NOT/NEAR` as operators. Raw user
input would either error or behave surprisingly. Strategy: **tokenize then quote each term as a
phrase**.
```
function toFtsQuery(q: string): string {
  const terms = q
    .toLowerCase()
    .split(/\s+/)
    .map(t => t.replace(/"/g, ''))        // strip embedded double-quotes
    .filter(t => t.length > 0)
    .map(t => `"${t}"`);                   // each term as a quoted phrase → operators neutralized
  return terms.join(' ');                  // implicit AND across terms (all words must appear)
}
```
- Quoting each term as a `"phrase"` neutralizes every FTS5 operator character → no syntax errors,
  no injection of boolean logic by the user. Implicit AND between quoted terms gives intuitive
  "all words" matching for the older audience (no surprise OR-noise).
- Phrase operators are intentionally NOT exposed (proposal OUT scope). Minimum query length stays
  at 2 (existing guard at `buscar.json.ts:15`). If `toFtsQuery` yields empty (all punctuation),
  return the empty-result shape.
- Args are bound as SQL parameters (`?`), so this is parameterized — sanitization is for FTS5
  grammar, the `?` binding handles SQL injection.

### 5.2 Query (MATCH + bm25 + version filter)
```sql
SELECT
  r.slug   AS version,  r.nombre AS versionNombre,
  l.nombre AS book,     l.slug   AS bookSlug,
  v.capitulo AS chapter, v.versiculo AS verse, v.texto AS text,
  bm25(versiculos_fts) AS score
FROM versiculos_fts
JOIN versiculos v ON v.id = versiculos_fts.rowid        -- standalone fallback: v.id = versiculos_fts.versiculo_id
JOIN recursos   r ON r.id = v.recurso_id
JOIN libros     l ON l.id = v.libro_id
WHERE versiculos_fts MATCH ?
  AND versiculos_fts.recurso_id IN (/* placeholders for selected version ids */)
ORDER BY score ASC          -- bm25 returns LOWER = more relevant
LIMIT 60;
```
- **Ranking fix**: `ORDER BY bm25()` then `LIMIT 60` means the 60 returned rows are the 60 MOST
  RELEVANT, not the first 60 canon-ordered — this directly fixes exploration finding #2 (limit
  applied before relevance).
- **Version filter**: `recursos.slug` values map to ids; filter on `versiculos_fts.recurso_id IN
  (ids)` (resolved via a small `recursos` lookup, or join `recursos` and filter on `r.slug IN
  (...)`). Either works; filtering on the FTS-stored `recurso_id` keeps the scan narrow.
- **Slug validation**: the endpoint validates requested version slugs against the live `recursos`
  table (tipo='biblia'), NOT a hardcoded array. This DELETES `VERSIONES_DISPONIBLES`
  (`buscar.json.ts:8`) — single source of truth is the DB.
- **Drop the `libros.nombre` LIKE join** (`buscar.json.ts:34`) — book-name matching is removed;
  FTS5 is verse-text only. Book lookup by name is out of scope.
- **Limit strategy**: keep `LIMIT 60` but now relevance-ordered. Optionally expose a follow-up
  "ver más" later (out of scope). bm25 over an FTS index across 124K verses returns well under the
  300ms target.

### 5.3 Implement in the query layer
Add `searchVersiculos({ query, versionSlugs }): Promise<SearchResult[]>` to `src/db/queries.ts`
using `db.run(sql\`…\`)` / `client.execute`. The endpoint becomes a thin validate→call→shape
wrapper. Response shape stays backward-compatible with the existing client
(`{ query, count, versiones, results:[{version,versionNombre,book,chapter,verse,text,href}] }`),
plus optional `degraded` flag (§3.2.3). `href` format unchanged:
`/biblia/{version}/{bookSlug}/{chapter}/#v{verse}`.

### 5.4 Delete dead code
Remove `listSearchDocuments()` (`queries.ts:508-533`) and its `SearchDocument` type if unused.
Grep-confirm no importers before deletion (exploration #8 says it is dead). Do this in the search
slice.

## 6. Endpoint changes

### 6.1 `/buscar.json` (`src/pages/buscar.json.ts`)
- Keep `prerender = false` (serverless, hits Turso in prod — confirmed correct).
- Validate `q` (length ≥ 2), sanitize via `toFtsQuery`, validate `versiones` against live DB
  slugs, call `searchVersiculos`, wrap in try/catch for graceful degradation.

### 6.2 `/datos/lectura-diaria.json` (NEW — `src/pages/datos/lectura-diaria.json.ts`)
- `export const prerender = false;` (serverless — must read live version param at request time).
- Accepts `?version=X`. Input validation: trim; if missing/invalid (not in live biblia slugs),
  FALL BACK to `spapddpt` (never 400 to a user for a bad pill — degrade gracefully).
- Calls parameterized `getDailyReadings(version)` and returns the same `DailyReading[]` shape the
  page already renders.
- Add caching headers: `Cache-Control: public, max-age=600` (10 min) — daily readings are stable
  within a day; reduces serverless invocations and skeleton flash on repeat visits.

### 6.3 `getDailyReadings(version)` parameterization (`src/db/queries.ts:207,250`)
- Signature: `getDailyReadings(version: string = 'spapddpt')`. Replace the hardcoded
  `eq(recursos.slug, 'spapddpt')` (`queries.ts:250`) with `eq(recursos.slug, version)`.
- Default keeps existing build-time `index.astro` call working unchanged during the static render
  (it renders the spapddpt skeleton baseline). Backward compatible.

## 7. UI design

### 7.1 Version pills — DB-driven, build-time SSR + client pre-check (chosen)
Decision: **render the four pills at build time from the DB (SSR), then client-side pre-check the
saved version** — do NOT switch pills to a client-fetch from `/datos/biblioteca.json`.

Justification:
- The pill SET is stable (the four installed Bibles change only at deploy time), so SSR-rendering
  them is correct and avoids a fetch + layout shift. This is the OPPOSITE tradeoff from
  BibleSelector (whose book/chapter lists are large and version-dependent, justifying its fetch).
- To kill the hardcoded duplication (exploration #3), the pills are generated in `index.astro`
  frontmatter from a DB call (`listBibliaVersions()` returning `{slug, abreviatura, nombre}`),
  NOT from a literal array. Source of truth = DB, rendered at build, zero runtime fetch.
- Only the CHECKED state is dynamic per-user, and that is inherently client-side (localStorage).
  A tiny island reads `$selector.get().version` on hydration and checks the matching pill,
  unchecking the static default. This is a cheap, FOUC-free DOM tweak (pills already visible;
  only the active ring moves).
- Pre-check semantics (resolves exploration risk #5): saved version starts CHECKED, the other
  three start UNCHECKED but remain freely toggleable. A visible helper line ("Podés elegir más de
  una versión") communicates multi-select. If `$selector` is empty/unhydratable, fall back to the
  SSR default (spapddpt checked) — never zero checked.

### 7.2 Daily readings — skeleton + client fill (mirrors island pattern, follows `$selector`)
Per the RESOLVED proposal decision, daily readings FOLLOW the global `$selector.version` — no new
store. Flow:
1. **Build time**: `index.astro` renders the daily-readings section as a SIZED skeleton (same grid
   dimensions / verse-row count as real content) plus the spapddpt baseline already fetched by
   `getDailyReadings()`. The baseline doubles as the no-JS fallback (progressive enhancement: if
   JS is off, the user still sees spapddpt readings).
2. **Hydration island**: reads `$selector.get().version`. If it equals `spapddpt`, do nothing
   (baseline already correct → zero flash). If it differs, show the skeleton state and
   `fetch('/datos/lectura-diaria.json?version=' + version)`, then swap verse text in place.
3. **FOUC avoidance**: the skeleton is the same height as the rendered content (no layout shift);
   the baseline spapddpt content is shown until the swap resolves so there is never an empty flash;
   the swap is a textContent replacement, not a re-mount. Response is cacheable (§6.2) so repeat
   visits resolve instantly.
4. **Reuse**: mirror BibleSelector's island conventions — `import { $selector }`, `DOMContentLoaded`
   guard, try/catch around fetch, silent fallback to baseline on any error.

### 7.3 What stays untouched
The search client script (`index.astro:113-222`) keeps its debounce (300ms, exploration #7 OK),
its `versiones` param wiring, and its result rendering. Only the pill INIT (pre-check) and the new
daily-readings island are added.

## 8. ADR-style decisions

### ADR-1: External-content FTS5 with one-shot `'rebuild'` (no triggers)
- Decision: external-content `versiculos_fts(content='versiculos', content_rowid='id')`, populated
  via a single `'rebuild'` after all imports; standalone-table fallback gated by a runtime probe.
- Rationale: storage-lean, single-statement population fits the ephemeral re-seeded DB; triggers
  would fire millions of times under the bulk delete/re-insert importers.
- Rejected: FTS5 sync triggers (catastrophic under bulk re-import); incremental rebuild during
  import (rowids unstable until all imports done); LIKE+NOCASE+normalized column (Approach A — no
  ranking, leading-wildcard kills index); client-side MiniSearch (Approach C — reverses prior
  25MB-download decision).
- Risk: external content unsupported on LibSQL → mitigated by the probe gate + standalone fallback.

### ADR-2: FTS population is DB-target-agnostic and MUST run against Turso too
- Decision: a standalone `scripts/build-fts.ts` using `src/db/client.ts` (auto-targets Turso/local);
  wired as the last local pipeline step AND appended to the Turso seeding runbook/CI.
- Rationale: `prepare-build-data.ts` exits early under Turso, and `/buscar.json` queries Turso in
  prod; populating only local.db would leave prod searching a non-existent table.
- Rejected: embedding rebuild inside the local-only branch (breaks prod); FTS triggers to "self-
  maintain" on Turso (still needs initial build + bulk-import cost); endpoint building the FTS
  table lazily on first request (cold-start latency, race conditions, write-from-serverless smell).
- Safety net: `/buscar.json` degrades to empty results (HTTP 200) on FTS errors, never 500.

### ADR-3: Per-term quoted-phrase sanitization, implicit AND, no exposed operators
- Decision: lowercase → split on whitespace → strip `"` → wrap each term in `"…"` → join.
- Rationale: neutralizes every FTS5 operator, gives intuitive "all words" matching for non-technical
  older users, prevents syntax errors on inputs like `Juan 3:16` or `amor (eterno)`.
- Rejected: passing raw input (errors/surprising boolean logic); exposing phrase/NEAR operators
  (out of scope, audience confusion); escaping individual operator chars (fragile vs. blanket
  quoting).

### ADR-4: Version pills SSR from DB + client pre-check; NOT client-fetched
- Decision: render pills at build from a DB version list; an island only flips the checked state
  from `$selector`.
- Rationale: stable small set → SSR avoids fetch + layout shift; still DB-sourced (kills hardcoded
  duplication); only per-user checked-state is client-side.
- Rejected: client-fetch pills from biblioteca.json (needless fetch/FOUC for a 4-item stable set);
  keeping the hardcoded array (the very duplication being removed).

### ADR-5: Daily readings follow `$selector` via skeleton + client fill (no `$lecturaVersion`)
- Decision: baseline spapddpt SSR + sized skeleton + island that fetches the selector's version.
- Rationale: proposal RESOLVED — one "which Bible?" preference for the older audience; reuses the
  existing store with strictly less state; reversible (endpoint+skeleton already support adding a
  separate key later).
- Rejected: `$lecturaVersion` separate store (D3 — extra "which Bible?" decision, off-intent);
  multiple pre-rendered versions of the page (impractical for daily readings); pure client verse
  fetch without skeleton (FOUC/layout shift).

## 9. Component / data-flow map

| Layer | Component | Change |
|-------|-----------|--------|
| Schema (raw SQL) | `drizzle/0003_versiculos_fts.sql` | NEW reference DDL (external-content FTS5) |
| Pipeline | `scripts/build-fts.ts` | NEW — DDL + `'rebuild'`, idempotent, DB-agnostic |
| Pipeline | `scripts/prepare-build-data.ts` | append `build:fts` as LAST local step |
| Pipeline | `package.json` | add `build:fts` script; add to `verify` chain |
| Query | `src/db/queries.ts` | add `searchVersiculos()`, `listBibliaVersions()`; param `getDailyReadings(version)`; DELETE `listSearchDocuments()` |
| Endpoint | `src/pages/buscar.json.ts` | FTS5 MATCH+bm25 rewrite; sanitize; DB-driven slug validation; drop `VERSIONES_DISPONIBLES`; try/catch degrade |
| Endpoint | `src/pages/datos/lectura-diaria.json.ts` | NEW `prerender:false` `?version=X` + validation + cache header |
| UI | `src/pages/index.astro` | pills SSR from DB + pre-check island; daily-readings skeleton + fill island |
| Store | `src/stores/selector.ts` | unchanged (single source of truth) |

## 10. Risks carried into tasks/apply

- **FTS5 external content on LibSQL unconfirmed at design time** — apply MUST run the probe gate
  first; standalone fallback (§2.4) is ready.
- **Turso parity is process, not just code** — appending `build:fts` to the out-of-band Turso
  seeding path is REQUIRED; if that path is undocumented, locate/establish it before declaring done
  (§3.3). Highest-severity item.
- **Skeleton sizing mismatch** → layout shift; size skeleton to the rendered content footprint.
- **bm25 ordering direction** — bm25 returns lower=better; `ORDER BY score ASC`. Verify in the
  smoke test (a known query should surface canonical verses first).
- **Removing `listSearchDocuments` / `VERSIONES_DISPONIBLES`** — grep for callers/imports before
  deleting.
