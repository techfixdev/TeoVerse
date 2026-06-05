# Tasks: search-version-selection

**Change**: search-version-selection
**Status**: ready-for-apply
**Delivery strategy**: auto-chain
**Artifact store**: hybrid (engram + openspec)

---

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Estimated changed lines | ~680 |
| 400-line budget risk | **High** |
| Chained PRs recommended | **Yes** |
| Suggested split | PR-1: FTS5 infra + search endpoint (tasks 1–10) / PR-2: UI pills + daily readings + cleanup (tasks 11–22) |
| Delivery strategy | auto-chain (no user prompt needed; apply first autonomous slice only) |
| Decision needed before apply | No — auto-chain resolves automatically |

**PR-1 scope** (~380 lines): FTS5 probe gate, migration file, `build-fts.ts` script, `searchVersiculos()` + `listBibliaVersions()` query functions, rewritten `/buscar.json`, `verify:search-fts` script, `package.json` additions. No UI changes.

**PR-2 scope** (~300 lines): DB-driven version pills in `index.astro` + client pre-check island, daily readings skeleton + `DailyReadingsIsland`, `getDailyReadings(version)` parameterization, `/datos/lectura-diaria.json` endpoint, `verify:daily-readings` script, cleanup of `listSearchDocuments`, `verify:search-index` removal/update.

---

## Phase 0 — Validation Gate (MUST run first; blocks all apply work)

- [ ] **T-0.1** Run `scripts/_fts5-probe.ts` via `npx tsx scripts/_fts5-probe.ts` and confirm output contains `RESULT: FTS5_EXTERNAL_CONTENT_SUPPORTED`. If it outputs `FTS5_EXTERNAL_CONTENT_FAILED`, apply the standalone-table fallback schema defined in the design before proceeding. Record the probe result — it governs which DDL variant is used in T-1.1.
  - **Spec**: FTS-6 (fallback on FTS index failure)
  - **Parallel**: No — result gates all subsequent FTS tasks

---

## Phase 1 — FTS5 Infrastructure (PR-1, sequential)

- [ ] **T-1.1** Create `drizzle/0003_versiculos_fts.sql` as a reference-only migration file (NOT applied by drizzle-kit push). It must contain the DDL for `versiculos_fts` matching the probe result: external-content variant if probe passed, standalone variant otherwise. Include a header comment: "Reference only — applied by scripts/build-fts.ts".
  - **Spec**: FTS-1, FTS-2 (tokenize unicode61 remove_diacritics 2), FTS-3 (bm25)
  - **Parallel**: Can run after T-0.1

- [ ] **T-1.2** Create `scripts/build-fts.ts`. Requirements:
  - Import `src/db/client.ts` (auto-targets Turso via `TURSO_CONNECTION_URL` env var or `file:local.db`).
  - Run DDL idempotently: `DROP TABLE IF EXISTS versiculos_fts` then CREATE.
  - Apply the FTS5 DDL from T-1.1 (external-content or standalone per probe result).
  - Populate: for external-content, run `INSERT INTO versiculos_fts(versiculos_fts) VALUES('rebuild')` as the LAST step after all data is fully loaded.
  - For standalone fallback: run `INSERT INTO versiculos_fts SELECT id AS versiculo_id, recurso_id, texto FROM versiculos`.
  - Exit with code 0 on success, code 1 on error.
  - **Spec**: FTS-6 (graceful), design ADR-2 (DB-target-agnostic)
  - **Parallel**: Can run in parallel with T-1.1 once T-0.1 is done

- [ ] **T-1.3** Add `"build:fts": "tsx scripts/build-fts.ts"` to `package.json` scripts.
  - **Spec**: design pipeline section
  - **Parallel**: Can run in parallel with T-1.1 and T-1.2

- [ ] **T-1.4** Append `runPnpmScript('build:fts')` as the LAST step in the local (non-Turso) branch of `scripts/prepare-build-data.ts` (after `db:seed-plan`). Do NOT add it inside the `if (hasTursoConnection)` block.
  - **Spec**: design pipeline, design CRITICAL Turso/prod parity
  - **Parallel**: No — must follow T-1.3

---

## Phase 2 — Query Layer (PR-1, can run in parallel with Phase 1 after T-0.1)

- [ ] **T-2.1** Add `searchVersiculos(q: string, versions: string[]): Promise<SearchResult[]>` to `src/db/queries.ts`. Requirements:
  - Input: raw query string (not yet sanitized) + validated version slug array.
  - Sanitize internally: lowercase → split whitespace → strip embedded `"` → wrap each term in `"..."` → join with space (implicit AND). Quoting neutralizes all FTS5 operators.
  - Short-query guard: if `q.trim().length < 3` return `[]` immediately (no DB call).
  - Execute raw SQL (NOT Drizzle ORM — FTS5 is outside Drizzle): `SELECT v.id, v.recurso_id, bm25(versiculos_fts) AS score, v.texto, v.capitulo, v.versiculo, l.nombre AS libro_nombre, l.slug AS libro_slug, r.slug AS version_slug, r.nombre AS version_nombre FROM versiculos_fts JOIN versiculos v ON v.id = versiculos_fts.rowid JOIN recursos r ON r.id = v.recurso_id JOIN libros l ON l.id = v.libro_id WHERE versiculos_fts MATCH ? AND versiculos_fts.recurso_id IN (...)  ORDER BY score ASC LIMIT 60` (bm25 lower = more relevant).
  - For standalone fallback schema: join via `versiculos_fts.versiculo_id = v.id`.
  - Wrap the entire DB call in try/catch; on error return `{ results: [], error: 'search_unavailable' }`.
  - Map rows to the existing SearchResult shape used in `buscar.json.ts` response (version, versionNombre, book, chapter, verse, text, href).
  - **Spec**: FTS-1, FTS-2, FTS-3 (bm25 ordering), FTS-4 (version filter), FTS-5 (limit 60, short-query guard), FTS-6 (try/catch)
  - **Parallel**: Can run in parallel with T-1.1 through T-1.3

- [ ] **T-2.2** Add `listBibliaVersions(): Promise<{ slug: string; nombre: string }[]>` to `src/db/queries.ts`. Query: `SELECT slug, nombre FROM recursos WHERE tipo = 'biblia' ORDER BY slug`. This replaces the hardcoded `VERSIONES_DISPONIBLES` array.
  - **Spec**: PILLS-1 (DB-driven, no hardcoded array), FTS-4 (version validation)
  - **Parallel**: Can run in parallel with T-2.1

---

## Phase 3 — Search Endpoint Rewrite (PR-1, sequential after Phase 2)

- [ ] **T-3.1** Rewrite `src/pages/buscar.json.ts`. Requirements:
  - Remove `VERSIONES_DISPONIBLES` hardcoded constant (line 8).
  - Remove all Drizzle imports (`versiculos`, `recursos`, `libros`, `recursoLibros`, `and`, `asc`, `eq`, `like`, `or`, `inArray`).
  - On each request: (1) extract `q` and `versiones` params; (2) if `q.length < 3` return `{ results: [], count: 0, query: q }` (spec: min 3 chars, not 2 as current — align with spec FTS-5); (3) call `listBibliaVersions()` to get valid slugs and validate the requested versions against it; (4) call `searchVersiculos(q, validatedSlugs)`; (5) if response contains `error` field, return HTTP 200 with `{ results: [], error: 'search_unavailable', query: q }`.
  - Keep `export const prerender = false`.
  - Keep response shape backward-compatible: `{ query, count, versiones, results }` plus optional `error` field.
  - Keep `href` construction unchanged.
  - Remove `libros.nombre LIKE` join (search is FTS-only now).
  - **Spec**: FTS-1 through FTS-6, PILLS-1 (no hardcoded versions in endpoint)
  - **Parallel**: No — must follow T-2.1 and T-2.2

- [ ] **T-3.2** Run `pnpm build:astro` (TypeScript check only, no data pipeline) to confirm `buscar.json.ts` compiles cleanly after the rewrite. Fix any TS errors before continuing.
  - **Spec**: cross-cutting constraint: `pnpm build` MUST succeed
  - **Parallel**: No — must follow T-3.1

---

## Phase 4 — Verification Script (PR-1, can run in parallel with Phase 3)

- [ ] **T-4.1** Create `scripts/verify-search-fts.ts`. This script must:
  - Call `build-fts.ts` logic (or import a helper) to ensure the FTS table is populated in the local DB.
  - Execute a raw SQL MATCH query for `"corazon"` (no accent) against `versiculos_fts` and assert at least one row is returned (validates FTS-1 accent folding).
  - Execute a MATCH query for `"El"` (capital E) and assert at least one row (validates FTS-2 case folding).
  - Execute a MATCH query for `"amor"` with a version filter (`recurso_id IN (SELECT id FROM recursos WHERE slug = 'spapddpt')`) and assert all returned rows have that `recurso_id` (validates FTS-4).
  - Assert that `searchVersiculos('ab', ['spapddpt'])` returns `[]` without hitting the DB (validates FTS-5 short-query guard).
  - Assert that `searchVersiculos('amor', ['spapddpt'])` returns at most 60 results (validates FTS-5 limit).
  - Exit code 0 on pass, exit code 1 on failure.
  - **Spec**: FTS-1, FTS-2, FTS-4, FTS-5
  - **Parallel**: Can draft while T-3.1 is in progress; finalize after T-2.1 is done

- [ ] **T-4.2** Add `"verify:search-fts": "tsx scripts/verify-search-fts.ts"` to `package.json` scripts and insert it into the `verify` chain in `package.json` (after `verify:bible-queries`).
  - **Note**: The existing `verify:search-index` entry (if any) is dead (search-index.json approach eliminated). Remove it from the `verify` chain if present. If it doesn't exist, skip.
  - **Spec**: cross-cutting constraint: `pnpm verify` MUST pass
  - **Parallel**: No — must follow T-4.1

---

## Phase 5 — Turso Runbook (PR-1, must be documented before PR-1 merge)

- [ ] **T-5.1** Add a `## FTS5 / Turso Deployment Runbook` section to `openspec/changes/search-version-selection/tasks.md` (this file, append at bottom) OR create `docs/turso-fts-runbook.md` (preferred if a `docs/` directory exists). Content must include:
  - Step 1: Ensure `TURSO_CONNECTION_URL` and `TURSO_AUTH_TOKEN` are set in the shell.
  - Step 2: Run `pnpm build:fts` — this runs `build-fts.ts` which auto-targets Turso.
  - Step 3: Verify: run `tsx -e "import {client} from './src/db/client.ts'; client.execute('SELECT count(*) as n FROM versiculos_fts').then(r => console.log(r.rows))"` and confirm `n > 0`.
  - Step 4: Run a smoke MATCH query: `tsx -e "import {client} from './src/db/client.ts'; client.execute({sql:'SELECT count(*) FROM versiculos_fts WHERE versiculos_fts MATCH ?',args:['corazon']}).then(r=>console.log(r.rows))"` and confirm count > 0.
  - Step 5: Deploy (Vercel). The production `/buscar.json` will now use Turso's `versiculos_fts`.
  - Step 6: Verify prod: `curl "https://<domain>/buscar.json?q=corazon&versiones=spapddpt"` returns `results` array with at least one item and no `error` field.
  - **Spec**: design CRITICAL Turso/prod parity (highest-severity risk)
  - **Parallel**: Can run in parallel with T-4.1

---

## Phase 6 — Daily Readings Parameterization (PR-2, sequential)

- [ ] **T-6.1** Refactor `getDailyReadings` in `src/db/queries.ts` to accept `version: string = 'spapddpt'`. Replace the hardcoded `eq(recursos.slug, 'spapddpt')` at line ~250 with `eq(recursos.slug, version)`. The default keeps the existing build-time call in `index.astro` working unchanged (no-JS fallback).
  - **Spec**: DRV-1 (parameterized getDailyReadings), DRV-4 (spapddpt default for no-JS fallback)
  - **Parallel**: Start of PR-2; can run in parallel with T-7.1

- [ ] **T-6.2** Create `src/pages/datos/lectura-diaria.json.ts` with `export const prerender = false`. Requirements:
  - Extract `?version=X` param; if missing or empty, default to `'spapddpt'`.
  - Call `listBibliaVersions()` to get valid slugs. If the requested version is not in the list, return HTTP 400 with `{ error: 'invalid_version' }`.
  - Call `getDailyReadings(version)`.
  - Return HTTP 200 with `{ version, readings: [...] }`.
  - Set `Cache-Control: public, max-age=600` response header.
  - **Spec**: DRV-2 (version-aware endpoint, 400 on unknown, 200 on default)
  - **Parallel**: No — must follow T-6.1 and T-2.2 (needs `listBibliaVersions`)

- [ ] **T-6.3** Verify `index.astro` build-time call `await getDailyReadings()` (no argument) still works after T-6.1. The function must produce identical output to before when called without arguments. If the `index.astro` call signature needs updating (e.g., adding explicit `'spapddpt'` for clarity), do so.
  - **Spec**: DRV-4, cross-cutting: `pnpm build` MUST succeed
  - **Parallel**: No — must follow T-6.1

---

## Phase 7 — Daily Readings Skeleton + Client Island (PR-2, sequential after T-6.1)

- [ ] **T-7.1** In `src/pages/index.astro` frontmatter: keep `await getDailyReadings()` call (renders `spapddpt` baseline for no-JS / first paint). Do NOT remove this call.
  - **Spec**: DRV-4 (static HTML default for no-JS)
  - **Parallel**: Can start in parallel with T-6.1

- [ ] **T-7.2** Wrap the daily readings section in `index.astro` with a skeleton container. Requirements:
  - The existing server-rendered readings markup stays as-is (spapddpt baseline).
  - Add a `data-daily-readings` wrapper element with a fixed min-height matching the typical readings block height (to prevent CLS when the client swaps content).
  - Add a visually hidden or aria-live skeleton element (`data-daily-readings-skeleton`) that becomes visible while the client fetch is in-flight. Mirror the BibleSelector island approach for skeleton sizing.
  - **Spec**: DRV-3 (skeleton state, no layout shift), DRV-4 (baseline shown until swap)
  - **Parallel**: No — must follow T-7.1

- [ ] **T-7.3** Create a client island script (inline `<script>` in `index.astro` or extracted to `src/scripts/daily-readings-island.ts`). Requirements:
  - On DOMContentLoaded: read `$selector.version` from nanostores persistent storage (same pattern as `BibleSelector`).
  - If version equals `'spapddpt'` or is absent: do nothing (baseline already rendered — zero flash).
  - Else: show skeleton (`data-daily-readings-skeleton`), fetch `/datos/lectura-diaria.json?version=<version>`.
  - On success: hide skeleton, swap `data-daily-readings` innerHTML with rendered readings HTML built from the response (textContent updates, not a full re-render of the page).
  - On error: hide skeleton, leave the spapddpt baseline in place (graceful degradation).
  - The swap must occur without a full page reload.
  - **Spec**: DRV-3 (skeleton + client fill), DRV-4 (spapddpt fallback on error)
  - **Parallel**: No — must follow T-7.2

---

## Phase 8 — Version Pills (PR-2, can run in parallel with Phase 7)

- [ ] **T-8.1** In `src/pages/index.astro` frontmatter: call `listBibliaVersions()` (from T-2.2) to obtain the available versions at build time. Store in a variable (e.g., `const bibliaVersions = await listBibliaVersions()`).
  - **Spec**: PILLS-1 (DB-driven pill list, no hardcoded array)
  - **Parallel**: Can run alongside T-7.1

- [ ] **T-8.2** Replace the four hardcoded `<label><input ... /></label>` pill elements inside `<fieldset id="version-filters">` in `index.astro` with a dynamic loop over `bibliaVersions`. Each pill must render identically to the current markup (same Tailwind classes), with `value={version.slug}` and `{version.nombre}` as the visible label. The first pill must NOT be hardcoded `checked` in SSR — checked state is managed by the client island (T-8.3).
  - **Spec**: PILLS-1 (no hardcoded array), PILLS-2 (client handles pre-check)
  - **Parallel**: No — must follow T-8.1

- [ ] **T-8.3** Add a client-side pre-check island to `index.astro` (inline `<script>`). On DOMContentLoaded: read `$selector.version`; if present, find the matching checkbox by `value` and set `checked = true`; all others remain unchecked. If `$selector.version` is absent or null, set `spapddpt` checkbox to `checked = true` (never zero pills checked). This island MUST NOT write to `$selector.version`.
  - **Spec**: PILLS-2 (pre-selection from persisted selector), PILLS-3 (session-scoped, no global mutation)
  - **Parallel**: No — must follow T-8.2

---

## Phase 9 — Cleanup (PR-2, can run in parallel with Phases 7–8)

- [ ] **T-9.1** Grep the entire codebase for `listSearchDocuments` (including `src/`, `scripts/`, `pages/`). Confirm zero callers exist before deletion.
  - **Spec**: CLN-1 (confirm no callers before deletion)
  - **Parallel**: Can run early — read-only step

- [ ] **T-9.2** Delete `listSearchDocuments()` function (lines 508–533 in `src/db/queries.ts`) and its associated `SearchDocument` type (if defined inline or nearby). Confirm the file still compiles after deletion.
  - **Spec**: CLN-1 (remove dead function)
  - **Parallel**: No — must follow T-9.1

---

## Phase 10 — Verification Scripts for PR-2 (PR-2, sequential)

- [ ] **T-10.1** Create `scripts/verify-daily-readings.ts`. Requirements:
  - Call `getDailyReadings('sparvg')` and assert the returned readings (if any — plan entries may be 0) contain only verses with `recurso_id` matching `sparvg` (validates DRV-1).
  - Call `getDailyReadings('spapddpt')` and assert it returns the same output as `getDailyReadings()` with no argument (validates DRV-1 default).
  - Make an HTTP GET to `http://localhost:<port>/datos/lectura-diaria.json?version=sparvg` if a dev server is running, OR mock the endpoint call by directly calling the handler function — assert HTTP 200 + `version === 'sparvg'` (validates DRV-2).
  - Assert `GET /datos/lectura-diaria.json?version=invalid_slug` returns HTTP 400 (validates DRV-2 unknown version).
  - Exit code 0 on pass, exit code 1 on failure.
  - **Spec**: DRV-1, DRV-2
  - **Parallel**: Can run alongside T-9.1

- [ ] **T-10.2** Add `"verify:daily-readings": "tsx scripts/verify-daily-readings.ts"` to `package.json` scripts and insert it into the `verify` chain.
  - **Spec**: cross-cutting: `pnpm verify` MUST pass
  - **Parallel**: No — must follow T-10.1

- [ ] **T-10.3** Run `pnpm verify` locally (full chain). Confirm all existing verify scripts still pass. Confirm `verify:search-fts` and `verify:daily-readings` pass. Fix any TypeScript errors from the full `pnpm build:astro` check.
  - **Spec**: cross-cutting: `pnpm verify` MUST pass, `pnpm build` MUST succeed
  - **Parallel**: No — final gate before PR submission

---

## Phase 11 — Turso Post-Deploy Verification (after each PR deploy, not in CI)

- [ ] **T-11.1** After PR-1 is deployed to Vercel production: run `pnpm build:fts` with `TURSO_CONNECTION_URL` and `TURSO_AUTH_TOKEN` set in your local shell (targeting Turso prod). Follow the runbook from T-5.1.
  - **Spec**: design CRITICAL Turso/prod parity
  - **Parallel**: No — must follow PR-1 deploy

- [ ] **T-11.2** After Turso FTS is populated (T-11.1): smoke test prod search. `curl "https://<domain>/buscar.json?q=corazon&versiones=spapddpt"` — assert: HTTP 200, `results.length > 0`, no `error` field in response body, all returned verses contain the substring expected from BM25 relevance.
  - **Spec**: FTS-1 (accent-insensitive in prod), FTS-3 (BM25 ordering), FTS-4 (version filter in prod), FTS-6 (no 500)
  - **Parallel**: No — must follow T-11.1

- [ ] **T-11.3** After PR-2 is deployed: smoke test daily readings. Open the home page in a browser with `$selector.version` set to `'sparvg'` (set via DevTools → Application → localStorage). Assert the daily readings section swaps to `sparvg` verses without a full page reload. Assert that after navigating away and back, `$selector.version` is still `'sparvg'` (not mutated by pills).
  - **Spec**: DRV-3 (skeleton + client fill in prod), PILLS-3 (no global mutation)
  - **Parallel**: No — must follow PR-2 deploy

---

## Dependency Graph

```
T-0.1 (FTS5 probe gate)
  └── T-1.1 (migration reference DDL)
  └── T-1.2 (build-fts.ts)       ─── parallel ───┐
  └── T-1.3 (package.json build:fts)               │
       └── T-1.4 (prepare-build-data.ts)            │
  └── T-2.1 (searchVersiculos)   ─── parallel ─────┤
  └── T-2.2 (listBibliaVersions) ─── parallel ─────┤
       └── T-3.1 (buscar.json rewrite) ─────────────┘
            └── T-3.2 (TS check)
  └── T-4.1 (verify-search-fts) ─ parallel with T-3.1
       └── T-4.2 (add to verify chain)
  └── T-5.1 (runbook) ─── parallel
                                    ▼ PR-1 merged
T-6.1 (getDailyReadings param)
T-2.2 needed by T-6.2
  └── T-6.2 (lectura-diaria endpoint)
  └── T-6.3 (index.astro default call check)
T-7.1 → T-7.2 → T-7.3 (skeleton island) ─── parallel with T-8.x
T-8.1 → T-8.2 → T-8.3 (pills island) ─── parallel with T-7.x
T-9.1 → T-9.2 (cleanup) ─── parallel
T-10.1 → T-10.2 → T-10.3 (verify full chain)
                                    ▼ PR-2 merged + deployed
T-11.1 → T-11.2 (Turso prod verification PR-1)
T-11.3 (prod smoke PR-2)
```

---

## Spec Requirement Coverage Matrix

| Spec ID | Task(s) |
|---------|---------|
| FTS-1 | T-1.1, T-1.2, T-2.1, T-3.1, T-4.1, T-11.2 |
| FTS-2 | T-1.1, T-1.2, T-2.1, T-4.1 |
| FTS-3 | T-2.1 (ORDER BY score ASC), T-4.1 |
| FTS-4 | T-2.1, T-2.2, T-3.1, T-4.1 |
| FTS-5 | T-2.1 (short-query guard + LIMIT 60), T-3.1, T-4.1 |
| FTS-6 | T-2.1 (try/catch), T-3.1, T-11.2 |
| PILLS-1 | T-2.2, T-8.1, T-8.2, T-3.1 |
| PILLS-2 | T-8.3 |
| PILLS-3 | T-8.3, T-11.3 |
| DRV-1 | T-6.1, T-10.1 |
| DRV-2 | T-6.2, T-10.1 |
| DRV-3 | T-7.2, T-7.3, T-11.3 |
| DRV-4 | T-6.1 (default param), T-7.1, T-6.3 |
| CLN-1 | T-9.1, T-9.2 |

---

## FTS5 / Turso Deployment Runbook

> Run this BEFORE or SIMULTANEOUSLY with each Vercel production deploy for PR-1.
> Failing to run this leaves `versiculos_fts` absent from Turso → every prod search returns `{ results: [], error: 'search_unavailable' }`.

**Prerequisites**: `TURSO_CONNECTION_URL` and `TURSO_AUTH_TOKEN` must be set in your shell.

```bash
# Step 1: Confirm env vars
echo $TURSO_CONNECTION_URL
echo $TURSO_AUTH_TOKEN   # should not be empty

# Step 2: Populate FTS index on Turso
pnpm build:fts

# Step 3: Verify row count
npx tsx -e "
import { client } from './src/db/client.ts';
const r = await client.execute('SELECT count(*) AS n FROM versiculos_fts');
console.log('FTS row count:', r.rows[0]);
client.close();
"
# Expect: n > 0 (should be ~124000)

# Step 4: MATCH smoke test
npx tsx -e "
import { client } from './src/db/client.ts';
const r = await client.execute({ sql: 'SELECT count(*) AS n FROM versiculos_fts WHERE versiculos_fts MATCH ?', args: ['corazon'] });
console.log('MATCH corazon:', r.rows[0]);
client.close();
"
# Expect: n > 0

# Step 5: Deploy to Vercel (normal deploy process)

# Step 6: Verify prod endpoint
curl "https://<your-domain>/buscar.json?q=corazon&versiones=spapddpt"
# Expect: HTTP 200, results.length > 0, no "error" field
```
