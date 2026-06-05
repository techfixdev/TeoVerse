# Proposal: search-version-selection

## Intent

TeoVerse serves Bible study to older church members ("personas mayores"). Two things are broken or missing for them today:

1. **Search is poor.** `buscar.json.ts` uses a `LIKE '%q%'` query that is NOT accent-insensitive in SQLite/LibSQL (á, é, í, ó, ú, ñ, ü are not folded), runs a full table scan over ~124K verses on every keystroke, and has NO relevance ranking — results are canon-ordered and `limit(60)` cuts them BEFORE relevance, so obscure matches can bury the canonical ones. The version filter pills are hardcoded strings duplicated in two files, disconnected from the user's persisted Bible preference.
2. **Daily readings are locked to one version.** `getDailyReadings()` hardcodes `spapddpt`. A user who reads in RVR1909 or "El Mensaje" still gets daily devotions in "Palabra de Dios para Ti" with no way to change it.

**Why now**: search is the primary discovery tool on the site and it is silently failing accented queries — a Spanish-language Bible app that can't find "Él" or "corazón" reliably is broken for its core audience. Fixing it alongside version selection unifies the "which Bible am I reading?" mental model across search, the chapter reader, and daily readings.

**Success looks like**: accented, case-insensitive, relevance-ranked search; version pills driven from the database and pre-selecting the user's saved Bible; and daily readings that honor the same single Bible preference — no extra knobs to confuse the audience.

## Scope

### In Scope
- **FTS5 search**: SQLite FTS5 virtual table `versiculos_fts` with `tokenize='unicode61 remove_diacritics 2'`, populated at seed/build time; raw-SQL migration (Drizzle has no native FTS5)
- **BM25 ranking**: rewrite `buscar.json.ts` to use `versiculos_fts MATCH ?` + `bm25()` ordering; remove the `or(like(libros.nombre, ...))` join
- **DB-driven version pills**: search pills generated from `/datos/biblioteca.json` (the same source `BibleSelector` uses), eliminating the hardcoded slug duplication in `index.astro` and `buscar.json.ts`
- **Pre-selection from saved preference**: on load, pre-check the version stored in `$selector` so the pills reflect the user's chosen Bible
- **Parameterized daily readings**: `getDailyReadings(version)` accepts a version slug
- **Daily-readings version follows the global preference** (see Open Decision below): the daily reading renders the user's `$selector` version client-side via a new `prerender: false` endpoint `/datos/lectura-diaria.json?version=X`, with a skeleton/loading state to absorb the hydration swap
- **Cleanup**: delete the dead, unused `listSearchDocuments()` in `queries.ts`

### Out of Scope
- A separate, independent "reading version" preference distinct from the navigation version (rejected — see Open Decision)
- Client-side full search index / MiniSearch (Approach C — reverses a prior architectural decision, re-introduces the multi-MB download problem)
- Strong-code or interlinear (`versiculos_tokens`) search — that table only covers spapddpt and is a different feature
- Phrase/proximity search operators surfaced in the UI (FTS5 enables them; not exposed this change)
- Multi-version pre-check beyond the one saved version (pills default to the saved version checked; user adds/removes the rest manually)

## Capabilities

### New Capabilities
- `fts-search`: Accent- and case-insensitive, BM25-ranked full-text search across all 4 Bibles via SQLite FTS5
- `search-version-pills`: Database-driven, multi-select version filter pre-selected from the user's saved Bible preference
- `daily-readings-version`: Daily homepage readings rendered in the user's chosen Bible version (follows the global selector preference)

### Modified Capabilities
- None with existing specs.

## Approach

### 1. Search — Approach B (FTS5)

Add a raw-SQL migration creating an external-content FTS5 table mirroring `versiculos`:

```sql
CREATE VIRTUAL TABLE versiculos_fts USING fts5(
  texto,
  content='versiculos',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);
```

`remove_diacritics 2` folds accents so "examinara" matches "examínara" and "corazon" matches "corazón"; `unicode61` handles case. Populate via `INSERT INTO versiculos_fts(rowid, texto) SELECT id, texto FROM versiculos` (rebuild) inside the seed/build pipeline. The endpoint queries with `db.run(sql\`... versiculos_fts MATCH ? ... ORDER BY bm25(versiculos_fts)\`)`, joins back to `versiculos` for display fields, and applies the version filter as a `WHERE recurso_id IN (...)`.

**Validation gate (Risk 1)**: confirm external-content `'rebuild'` works on LibSQL/Turso. If not, fall back to a standalone (non-content) FTS5 table that stores `texto`, `recurso_id`, `versiculo_id` directly. Both paths are accent-insensitive and BM25-ranked; only the population SQL differs. The design phase picks the concrete shape after this check.

### 2. Version pills — database-driven + pre-selected

Pills render from `/datos/biblioteca.json` (already fetched in the BibleSelector flow). On init, the search island reads `$selector.get().version` and pre-checks the matching pill. This kills the duplicated hardcoded slug list (`index.astro` + `buscar.json.ts`) — both derive from the DB. Multi-select stays: saved version checked by default, others toggleable.

### 3. Daily readings — follow the global selector

`getDailyReadings(version)` is parameterized. The homepage is static (`output: 'static'`), so it renders a **skeleton** for the reading text, then a client script reads `$selector.get().version` and fetches `/datos/lectura-diaria.json?version=X` (a new `prerender: false` serverless endpoint) to fill in verses. Changing the Bible anywhere (reader, search, or a small selector in the daily-reading section) updates `$selector` and the reading re-fetches. One preference, one mental model.

## Open Decision (RESOLVED)

**Question**: Should the daily-readings version be an independent preference (`$lecturaVersion`, exploration's D3) or follow the global `$selector` version?

**Decision**: **Follow the global `$selector` version.** Do NOT introduce `$lecturaVersion`.

**Rationale**:
- **Audience first.** The product serves "personas mayores." Two separate "which Bible?" settings — one for navigation, one for daily readings — is exactly the kind of hidden, surprising state that confuses non-technical older users ("I changed my Bible but the devotion is still in the old one — why?"). A single Bible preference is predictable: *the app shows my Bible, everywhere.*
- **Exploration's D3 optimizes for a power-user scenario** ("always read devotions in MSG but navigate in PDPT") that is unlikely for this audience and not in the stated user intent. The intent says "let the user choose which version the daily readings display" — it does NOT ask for a *separate* preference.
- **Less surface area, same architecture.** Following `$selector` reuses the existing persisted store (no new `rv:lectura-version` key, no second pill set to keep in sync), and the endpoint/skeleton/parameterized-query mechanics (D2) are identical. We get the feature with strictly less state.
- **Reversible.** If real usage later shows a need for an independent reading version, adding `$lecturaVersion` is an additive change — the parameterized endpoint and skeleton already exist. Starting unified is the cheaper, safer default.

**Consequence for spec/design**: the daily-readings section reads/writes `$selector.version` (optionally exposing a compact single-select version control there that simply sets the same store). No new store key.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `drizzle/` | New migration | Raw-SQL FTS5 virtual table `versiculos_fts` (`unicode61 remove_diacritics 2`) |
| `scripts/prepare-build-data.ts` | Modify | Populate `versiculos_fts` after seeding all 4 Bibles (verify scripts dir — see Risk 2) |
| `src/pages/buscar.json.ts` | Rewrite query | FTS5 `MATCH` + `bm25()` ranking; drop `LIKE` + `libros.nombre` join; remove hardcoded `VERSIONES_DISPONIBLES` |
| `src/pages/datos/lectura-diaria.json.ts` | Create | `prerender: false` endpoint, `?version=X`, returns today's verses |
| `src/pages/index.astro` | Modify | DB-driven pills pre-checked from `$selector`; daily-reading skeleton + client fetch/fill |
| `src/db/queries.ts` | Modify | Parameterize `getDailyReadings(version)`; **delete** dead `listSearchDocuments()` |
| `src/stores/selector.ts` | Read | Source of the single Bible preference (search pre-check + daily readings); no new key |
| `src/components/modules/BibleSelector.astro` | Reference | `/datos/biblioteca.json` shape reused to drive pills |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| FTS5 external-content `'rebuild'` unsupported on LibSQL/Turso | Medium | Validate in design phase; fall back to standalone FTS5 table storing `texto`+`recurso_id`+`versiculo_id`. Both are accent-insensitive + BM25 |
| `scripts/` dir absent from git tree while `pnpm` references `tsx scripts/...` | Medium | Verify the build pipeline location BEFORE wiring FTS5 population; design phase confirms where seed runs |
| Flash of skeleton before preferred-version verses load (daily readings) | Medium | Skeleton/loading state sized to final content; fetch fires immediately on hydration; cache the endpoint response |
| FTS5 table not rebuilt on re-seed → stale/empty search | Low | Population is part of the same ephemeral seed step; `'rebuild'` (or full re-insert) runs every build |
| Multi-select pills pre-checking one saved version misreads user intent | Low | Saved version checked + others toggleable; clear "podés elegir varias versiones" affordance |
| Removing `listSearchDocuments()` breaks a hidden caller | Low | Confirmed unused in exploration; grep before delete |

## Rollback Plan

1. Drop the `versiculos_fts` migration (DB is ephemeral — rebuilt every `prepare-build-data`)
2. Revert `buscar.json.ts` to the prior `LIKE` query and hardcoded versions list
3. Remove the `/datos/lectura-diaria.json` endpoint and revert `getDailyReadings()` to the hardcoded `spapddpt` signature
4. Revert `index.astro` pills + daily-reading skeleton to hardcoded state
5. Restore `listSearchDocuments()` if needed (or leave deleted — it was dead)
6. `pnpm verify` must pass

## Dependencies

- `/datos/biblioteca.json` endpoint (already exists, used by `BibleSelector`)
- `$selector` persisted store (already exists, key `rv:last-selection`)
- LibSQL/Turso FTS5 support (validate external-content mode in design)
- The seed/build pipeline (`prepare-build-data`) — location must be confirmed (Risk 2)

## Success Criteria

- [ ] Search for "corazon" returns verses containing "corazón"; "El" matches "Él" — accent/case-insensitive
- [ ] Results are BM25-ranked (canonical/dense matches surface before obscure ones)
- [ ] No full table scan — search stays responsive at 300ms debounce over ~124K verses
- [ ] Version pills are generated from the DB (no hardcoded slug list) and pre-check the saved `$selector` version
- [ ] Daily readings render in the user's saved Bible version; changing the Bible updates the reading
- [ ] No FOUC of empty reading area — skeleton shows until verses load
- [ ] `listSearchDocuments()` removed; nothing references it
- [ ] `pnpm verify` passes; `pnpm build` succeeds under SSG constraints

## Delivery Strategy

Forecast: 3 slices. Search rewrite is the bulk; version selection is additive. Recommend `stacked-to-main`; final strategy confirmed at `sdd-tasks`.

| Slice | Scope | Est. lines |
|-------|-------|------------|
| **FTS5 search** | Migration, seed population, `buscar.json.ts` rewrite, delete dead code | ~140 |
| **Version pills** | DB-driven pills in `index.astro`, `$selector` pre-check | ~80 |
| **Daily-readings version** | Parameterized query, `/datos/lectura-diaria.json` endpoint, skeleton + client fill | ~110 |
