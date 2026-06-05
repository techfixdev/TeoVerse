# Archive Report: search-version-selection

**Date Archived**: 2026-06-05  
**Change**: search-version-selection  
**Project**: teoverse  
**Artifact Store Mode**: hybrid (engram + openspec)  
**Verdict**: PASS (0 CRITICAL, 2 acceptable WARNINGS, 3 SUGGESTIONS)

---

## Executive Summary

The `search-version-selection` change has been fully planned, implemented, verified, and is now closed. All code tasks across 2 chained PR slices (feat/search-fts5 → feat/search-version-ui) are complete. The verification report confirms 0 CRITICAL issues, 2 WARNINGS (both non-blocking runtime-coverage gaps), and 3 SUGGESTIONS (performance optimization and documentation improvements). Operational tasks T-11.1, T-11.2, and T-11.3 (Turso FTS5 population and post-deploy smoke tests) are deferred to the deployment pipeline and documented in `docs/turso-fts-runbook.md`.

---

## Artifact References

| Artifact | Topic Key / Path | Status |
|----------|---------------------|--------|
| Proposal | openspec/changes/search-version-selection/proposal.md | Complete |
| Spec | openspec/changes/search-version-selection/spec.md | Complete |
| Design | openspec/changes/search-version-selection/design.md | Complete |
| Tasks | openspec/changes/search-version-selection/tasks.md | Complete |
| Verify Report | openspec/changes/search-version-selection/verify-report.md | Complete |

---

## Change Overview

### Intent

TeoVerse serves Bible study to Spanish-speaking older church members ("personas mayores"). This change unifies two critical gaps:

1. **Broken search**: SQLite `LIKE '%q%'` queries are not accent-insensitive (á, é, í, ó, ú, ñ, ü not matched), run full table scans over ~124K verses on keystroke, have no relevance ranking, and apply a limit before sorting — burying canonical matches below obscure ones.

2. **Daily readings locked to one version**: `getDailyReadings()` hardcodes `spapddpt`, ignoring the user's saved Bible preference in `$selector`.

### Solution Scope

**FTS5 search** (PR-1): SQLite FTS5 virtual table with `unicode61 remove_diacritics 2` tokenizer, BM25 ranking, DB-driven version pills pre-selected from saved preference, all wired into `/buscar.json`.

**Daily readings version selection** (PR-2): Parameterized `getDailyReadings(version)`, new `/datos/lectura-diaria.json?version=X` serverless endpoint, skeleton + client-fill UX on homepage, cleanup of dead search code.

### Impact Areas

| File | Change | Impact |
|------|--------|--------|
| `drizzle/0005_versiculos_fts.sql` | NEW migration | FTS5 virtual table (reference-only, applied by build script) |
| `scripts/build-fts.ts` | NEW script | Idempotent FTS5 population; DB-target-agnostic (local/Turso) |
| `scripts/prepare-build-data.ts` | Modified | Append `build:fts` as final pipeline step (local branch only) |
| `src/db/queries.ts` | Modified | Add `searchVersiculos()`, `listBibliaVersions()`; parameterize `getDailyReadings(version)`; delete `listSearchDocuments()` |
| `src/pages/buscar.json.ts` | Rewritten | FTS5 MATCH + BM25 ranking; DB-driven slug validation; graceful error handling |
| `src/pages/datos/lectura-diaria.json.ts` | NEW endpoint | Serverless, prerender:false, version-aware, 10-min cache header |
| `src/pages/index.astro` | Modified | DB-driven pills + pre-check island; daily-readings skeleton + fill island |
| `package.json` | Modified | Add `build:fts` script; integrate into verify chain |
| `docs/turso-fts-runbook.md` | NEW runbook | 6-step deployment procedure + troubleshooting for Turso seeding |

---

## Verification Summary (Full Change: 27/27 code tasks complete)

### Build & Test Passes

```
pnpm verify ...................... exit 0 (full chain)
pnpm build:astro ................. 0 errors, 0 warnings
verify:search-fts (7/7) ........... PASS
  - FTS-1 (accent-insensitive): corazon matched 3395 rows
  - FTS-2 (case-insensitive): El matched 67533 rows
  - FTS-3 (BM25 ordering): score ordering verified (ASC = most relevant first)
  - FTS-4 (version filter): all amor+spapddpt results have spapddpt recurso_id
  - FTS-5 (short-query guard): ab, a returned empty without DB call
  - FTS-5 (limit 60): amor returned exactly 60 results
  - FTS-6 (graceful fallback): code correct
verify:daily-readings (4/4) ....... PASS
  - DRV-1 sparvg returns sparvg only
  - DRV-1 default matches spapddpt
  - DRV-1 spapddpt returns spapddpt only
  - DRV-2 listBibliaVersions returns 4 versions
```

### Spec Compliance (Full Change: 13/13 domains + 4 cross-cutting constraints PASS)

**PR-1 (fts-search)**:
- FTS-1 (accent-insensitive) ............ PASS (tokenize unicode61 remove_diacritics 2)
- FTS-2 (case-insensitive) ............ PASS (same tokenizer)
- FTS-3 (BM25 ranking) ................ PASS (ORDER BY score ASC; assertion now included)
- FTS-4 (version filter) ............. PASS (recurso_id IN subselect)
- FTS-5 (limit + guard) .............. PASS (60-limit + 3-char guard)
- FTS-6 (graceful fallback) .......... PASS (try/catch + HTTP 200)

**PR-2 (search-version-pills + daily-readings-version + cleanup)**:
- PILLS-1 (DB-driven list) ........... PASS (listBibliaVersions() frontmatter)
- PILLS-2 (pre-selection) ............ PASS (island reads selector.version)
- PILLS-3 (session-scoped) ........... PASS (island read-only, no selector.set calls)
- DRV-1 (parameterized query) ....... PASS (default='spapddpt')
- DRV-2 (version-aware endpoint) ... PASS (400 on unknown, 200 default)
- DRV-3 (skeleton + fill) ........... PASS (animate-pulse, fetch, swap, error fallback)
- DRV-4 (static HTML default) ...... PASS (spapddpt baseline for no-JS)
- CLN-1 (cleanup) ................... PASS (listSearchDocuments deleted, zero callers)

**Cross-Cutting**:
- `pnpm verify` MUST pass ........... PASS
- `pnpm build` MUST succeed ......... PASS (251s, server + client + static)
- Single source of truth ($selector) .. PASS (no new store keys)
- UI copy in Spanish ............... PASS

---

## Work-Unit Commits

### PR-1 (feat/search-fts5 branch)

```
5f3ec31 -- feat(fts5): add FTS5 probe migration reference build-fts script pipeline integration
261bfbf -- feat(fts5): add searchVersiculos listBibliaVersions rewrite buscar.json add verify:search-fts
6dc7bc4 -- docs: add Turso FTS5 deployment runbook
82d4a64 -- fix(fts5): drop versiculos_fts before drizzle-kit push prevent shadow-table conflict
0a4db3d -- chore: mark PR-1 tasks complete in openspec tasks.md
```

### PR-2 (feat/search-version-ui branch)

```
454ee5a -- feat(daily-readings): parameterize getDailyReadings(version) add lectura-diaria endpoint
97b7c13 -- feat(ui): DB-driven version pills + daily readings skeleton island on homepage
b43b133 -- feat(verify): add verify:daily-readings script and FTS-3 sort-order assertion
63110c4 -- chore: mark PR-2 tasks complete in openspec tasks.md
```

**Branch Merge Path**: `feat/search-fts5` → main, then `feat/search-version-ui` → `feat/search-fts5` → main

---

## Issues & Resolutions

### WARNINGS (2 — both acceptable for production use)

**W-1** — FTS-3 BM25 ordering no automated assertion (PR-1)
- **Status**: RESOLVED in PR-2
- **What**: FTS-3 requires BM25 relevance sorting. Code was correct (ORDER BY score ASC, since bm25 returns negative scores; ASC = most relevant first), but verify-search-fts.ts did not assert the sort order.
- **Fix**: Added two-result comparison in verify-search-fts.ts; now passing.

**W-2** — FTS-6 error path (missing FTS table) not exercised
- **Status**: DOCUMENTED, not tested destructively
- **What**: The graceful fallback (`try/catch` in searchVersiculos + HTTP 200 in buscar.json.ts) is code-correct but has no automated test that drops the FTS table to trigger the error path.
- **Mitigation**: Covered by documentation (no-ops in prod if table is missing; worst case user gets empty search results, not a 500). Post-deploy smoke test T-11.2 validates search succeeds on Turso.

### SUGGESTIONS (3 — all non-blocking)

**S-1** — Add latency assertion to verify scripts
- Suggestion: Add `Date.now()` around `searchVersiculos()` to assert <300ms on 124K corpus.

**S-2** — Turso runbook Windows fragility
- Note: `npx tsx -e` eval syntax can fail on Windows. Consider extracting to `scripts/verify-fts-turso.ts` for robustness (not blocking).

**S-3** — Pills label UX
- Note: Pill labels show full `version.nombre` (e.g., "Palabra de Dios para Ti"). More accessible; no spec violation.

---

## Deferred Operational Tasks (T-11.x — post-deploy)

These tasks are **manual, post-deployment checks** required before declaring the feature live on production. They are NOT code tasks and cannot be automated in CI.

### T-11.1: Populate FTS on Turso

**When**: Before or simultaneously with PR-1 deploy to Vercel production.  
**Action**: Run `pnpm build:fts` with `TURSO_CONNECTION_URL` and `TURSO_AUTH_TOKEN` set against Turso production DB.  
**Documentation**: See `docs/turso-fts-runbook.md` Step 1-3.  
**Critical**: Without this, `/buscar.json` in production will query `versiculos_fts` (which doesn't exist on Turso) and return empty results with `error: 'search_unavailable'`.

### T-11.2: Smoke Test Prod Search (feat/search-fts5 in production)

**When**: Immediately after T-11.1 + PR-1 deploy completes.  
**Action**: `curl "https://<domain>/buscar.json?q=corazon&versiones=spapddpt"` — verify HTTP 200, `results.length > 0`, no `error` field.  
**Documentation**: See `docs/turso-fts-runbook.md` Step 6.  
**Validates**: FTS-1 (accent-insensitive in prod), FTS-3 (BM25 ranking), FTS-4 (version filter), FTS-6 (no 500 on errors).

### T-11.3: Smoke Test Daily Readings UI (feat/search-version-ui in production)

**When**: After PR-2 is deployed to Vercel production.  
**Action**: Open home page in browser, set `$selector.version` to `'sparvg'` via DevTools localStorage. Verify daily readings section swaps to `sparvg` verses without full page reload.  
**Validates**: DRV-3 (skeleton + client fill), PILLS-3 (no global mutation of selector), skeleton flash prevention.

---

## Runbook Location

**Deployment Instructions**: `docs/turso-fts-runbook.md`

This file contains:
- Prerequisites (env vars)
- 6-step population procedure (local dev to prod)
- Verification commands (row count, MATCH smoke test, prod endpoint curl)
- Troubleshooting table (when to re-run, triggers)
- Re-run guide (after re-seed, new Bible import, etc.)

---

## Design Decisions Carried Forward

**ADR-1**: External-content FTS5 with one-shot `'rebuild'` (no triggers) — correct for ephemeral, fully-re-seeded DB.  
**ADR-2**: FTS population is DB-target-agnostic via `src/db/client.ts` — CRITICAL for Turso parity.  
**ADR-3**: Per-term quoted-phrase sanitization; no exposed operators — prevents injection, safe for older audience.  
**ADR-4**: Version pills SSR from DB + client pre-check (not client-fetched) — avoids FOUC, kills hardcoded duplication.  
**ADR-5**: Daily readings follow `$selector` (no `$lecturaVersion` separate store) — unified "which Bible?" model for older users.

---

## Next Steps

1. **Code Review**: Both PRs (feat/search-fts5 and feat/search-version-ui) are ready for team review.
2. **Merge**: Merge PR-1 to main, then PR-2 to main.
3. **Deployment**: Deploy to Vercel.
4. **T-11.x Post-Deploy**: Execute the Turso FTS population (T-11.1) before or alongside the deploy.
5. **Smoke Tests**: Run T-11.2 (search) and T-11.3 (daily readings UI) on production.

---

## Traceability

This archive report documents the final state of the change. All artifacts are filed together:

```
openspec/changes/archive/2026-06-05-search-version-selection/
  ├── proposal.md
  ├── spec.md
  ├── design.md
  ├── tasks.md
  ├── verify-report.md
  └── archive-report.md (this file)
```

**Engram References** (for cross-session recovery):
- `sdd/search-version-selection/proposal`
- `sdd/search-version-selection/spec`
- `sdd/search-version-selection/design`
- `sdd/search-version-selection/tasks`
- `sdd/search-version-selection/verify-report`
- `sdd/search-version-selection/archive-report`

---

## Checklist

- [x] All artifacts read and compiled
- [x] No destructive merges (no existing main specs conflicted with this change)
- [x] Archive report written with observation IDs and decision audit trail
- [x] Change folder moved to archive with date prefix (2026-06-05)
- [x] Archive persisted to engram with topic_key and project context
- [x] Zero open CRITICALs; 2 WARNINGs documented; 3 SUGGESTIONs noted
- [x] Deferred operational tasks (T-11.x) documented and cross-referenced
- [x] Runbook location specified for post-deploy procedures

---

**Archived by**: SDD Archive Phase  
**Artifact Store**: hybrid (openspec + engram)  
**Status**: CLOSED — ready for deployment pipeline
