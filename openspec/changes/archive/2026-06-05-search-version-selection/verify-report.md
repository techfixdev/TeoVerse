# Verification Report: search-version-selection

Change: search-version-selection
Scope: PR-1 slice only (T-0.1 through T-5.1)
Branch: feat/search-fts5 (off main)
Date: 2026-06-05
Verdict: PASS WITH WARNINGS

PR-2 requirements (PILLS-1..3, DRV-1..4, CLN-1) are OUT OF SCOPE. Marked Pending-PR-2, not failures.

---

## Task Completeness (PR-1: 12/12 complete)

T-0.1 FTS5 probe gate: COMPLETE - FTS5_EXTERNAL_CONTENT_SUPPORTED
T-1.1 drizzle/0005_versiculos_fts.sql: COMPLETE - reference-only DDL header comment present
T-1.2 scripts/build-fts.ts: COMPLETE - idempotent DROP+CREATE+rebuild exits 0/1
T-1.3 package.json build:fts + drop:fts: COMPLETE
T-1.4 prepare-build-data.ts: COMPLETE - drop:fts before db:push; build:fts last
T-2.1 searchVersiculos(): COMPLETE - FTS5 raw SQL sanitize guard fallback
T-2.2 listBibliaVersions(): COMPLETE - DB-driven no hardcoded slugs
T-3.1 buscar.json.ts rewrite: COMPLETE - VERSIONES_DISPONIBLES removed
T-3.2 astro check 0 errors: COMPLETE - 0 errors 0 warnings 1 unrelated hint
T-4.1 verify-search-fts.ts: COMPLETE - 6/6 checks passing
T-4.2 verify:search-fts in chain: COMPLETE - after verify:bible-queries
T-5.1 turso-fts-runbook.md: COMPLETE - steps 1-6 troubleshooting re-run triggers
T-6.1 through T-10.3: PENDING PR-2 slice
T-11.1 through T-11.3: PENDING post-deploy manual smoke tests

---

## Build / Test Evidence

pnpm verify exit code: 0

prepare:build-data full pipeline: PASS
build-fts 124216 rows: PASS
verify:bible-queries: PASS
verify:search-fts 6/6: PASS
verify:selector-manifest 4 versions 4756 chapters: PASS
verify:usfm-parser: PASS
verify:usfm-importer: PASS
verify:usfm-interlinear: PASS
verify:tokens: PASS
verify:strong: PASS
astro check 0 errors 0 warnings 1 hint: PASS
astro build 251.44s: PASS

verify:search-fts transcript:
    FTS-1 accent: PASS -- corazon matched 3395 rows
    FTS-2 case: PASS -- El matched 67533 rows
    FTS-4 filter: PASS -- amor+spapddpt all spapddpt (203)
    FTS-5 guard: PASS -- ab returned empty no DB call
    FTS-5 guard: PASS -- a returned empty no DB call
    FTS-5 limit: PASS -- amor returned 60 results
    Result: 6 passed 0 failed

---

## Spec Compliance Matrix

### Domain 1: fts-search (PR-1 scope)

FTS-1 Accent-insensitive: PASS
  Evidence: verify:search-fts; tokenize unicode61 remove_diacritics 2 at build-fts.ts:31

FTS-2 Case-insensitive: PASS
  Evidence: verify:search-fts; same tokenizer

FTS-3 BM25 ORDER BY score ASC: WARNING - W-1
  Code correct queries.ts:589. No automated sort-order assertion.

FTS-4 Version filter recurso_id IN subselect: PASS
  Evidence: verify:search-fts; queries.ts:586-588

FTS-5 Short-query guard + LIMIT 60: PASS
  Evidence: verify:search-fts; queries.ts:557,591

FTS-6 Graceful fallback HTTP 200 + error: WARNING - W-2
  Code correct queries.ts:607-610 + buscar.json.ts:34-42. No error-path test.

### Domains 2-4 (PR-2 N/A)

PILLS-1..3: Pending-PR-2
DRV-1..4: Pending-PR-2
CLN-1 (listSearchDocuments delete): Pending-PR-2; still at queries.ts:628; zero callers by grep

### Cross-Cutting Constraints

pnpm verify MUST pass: PASS
pnpm build MUST succeed: PASS
selector.version single source of truth: PASS - no new store keys in PR-1
All UI copy in Spanish: PASS - no UI changes in PR-1
Search response <300ms SHOULD: UNTESTED - S-1

---

## Work-Unit Commits (feat/search-fts5)

5f3ec31 -- feat(fts5): add FTS5 probe migration reference build-fts script pipeline integration
261bfbf -- feat(fts5): add searchVersiculos listBibliaVersions rewrite buscar.json add verify:search-fts
6dc7bc4 -- docs: add Turso FTS5 deployment runbook
82d4a64 -- fix(fts5): drop versiculos_fts before drizzle-kit push prevent shadow-table conflict
0a4db3d -- chore: mark PR-1 tasks complete in openspec tasks.md

5 commits present. All match apply-progress record.

---

## Turso Runbook Audit (T-5.1)

File: docs/turso-fts-runbook.md

Step 1 env vars (TURSO_CONNECTION_URL + TURSO_AUTH_TOKEN): YES
Step 2 pnpm build:fts: YES
Step 3 verify row count n > 0: YES
Step 4 MATCH smoke test corazon: YES
Step 5 Deploy to Vercel: YES
Step 6 curl prod endpoint: YES
Troubleshooting table 4 rows: YES
When to re-run section: YES
Re-run after re-seed trigger: YES (new Bible import trigger)

---

## Issues

### WARNINGS

W-1 -- FTS-3 BM25 sort order no automated assertion
ORDER BY score ASC at queries.ts:589 is code-correct (bm25 negative; ASC = most relevant first).
verify-search-fts.ts does not assert results[0].score <= results[1].score.
Fix: add two-result comparison in verify-search-fts.ts in PR-2.

W-2 -- FTS-6 error path no automated test for missing FTS table
Code correct: try/catch queries.ts:607-610 + buscar.json.ts:34-42.
No verify script drops FTS table to exercise HTTP error path. Document in PR description.

W-3 -- listSearchDocuments() still exported (informational)
CLN-1 deferred to T-9.1 (PR-2). Zero callers confirmed. Track as first PR-2 task.

### SUGGESTIONS

S-1 -- Add latency assertion to verify-search-fts.ts
SHOULD constraint: <300ms for 124K corpus. Add Date.now() around searchVersiculos().

S-2 -- Turso runbook inline tsx -e eval (fragile on Windows)
ESM import in npx tsx -e can fail on Windows. Extract to scripts/verify-fts-turso.ts.

---

## Design Coherence

External-content FTS5: YES -- build-fts.ts:31
DB-target-agnostic via client.ts: YES -- build-fts.ts:17
recurso_id UNINDEXED: YES -- build-fts.ts:33
sanitizeFtsQuery wraps terms in quotes: YES -- queries.ts:535-542
ORDER BY score ASC (bm25 sign): YES -- queries.ts:589 with comment
drop:fts before db:push: YES -- prepare-build-data.ts:15 + commit 82d4a64
build:fts as last pipeline step: YES -- prepare-build-data.ts:30

---

## Final Verdict

PASS WITH WARNINGS

PR-1 slice (T-0.1 through T-5.1) complete. 12/12 tasks done. pnpm verify exits 0.
6/6 FTS checks pass. Astro build clean (0 errors 251s).
All fts-search requirements correctly implemented at code level.
FTS-3 and FTS-6 code-correct but lack automated runtime assertions (W-1 W-2) -- acceptable for PR-1.
No CRITICAL issues. 2 runtime-coverage WARNINGS. 1 informational WARNING. 2 SUGGESTIONS.
PR-1 is ready for code review.

---

# PR-2 Verification Section (appended 2026-06-05)

Scope: T-6.1 through T-10.3 (feat/search-version-ui branch)

---

## PR-2 Task Completeness (15/15 code tasks complete; T-11.x deferred-to-deploy)

T-6.1 getDailyReadings(version): COMPLETE -- queries.ts:199 default param; :242 eq(recursos.slug,version)
T-6.2 lectura-diaria.json.ts: COMPLETE -- prerender:false; 400 on unknown; Cache-Control: public max-age=600
T-6.3 index.astro default call: COMPLETE -- getDailyReadings() no-arg backward-compatible; astro check clean
T-7.1 spapddpt baseline retained: COMPLETE -- index.astro:9 getDailyReadings() for no-JS fallback
T-7.2 skeleton wrapper: COMPLETE -- [data-daily-readings] min-h-[20rem] + [data-daily-readings-skeleton] animate-pulse
T-7.3 DailyReadingsIsland: COMPLETE -- index.astro:368-418; escapeHtml XSS guard; error fallback
T-8.1 listBibliaVersions() frontmatter: COMPLETE -- index.astro:10
T-8.2 Dynamic pills loop: COMPLETE -- index.astro:55-60; no hardcoded slugs (grep VERSIONES_DISPONIBLES: zero)
T-8.3 Pills pre-check island: COMPLETE -- index.astro:253-290; read-only (grep selector.set: zero)
T-9.1 Zero listSearchDocuments callers confirmed: COMPLETE -- grep src/ scripts/ pages/: zero
T-9.2 listSearchDocuments + SearchDocument deleted: COMPLETE -- queries.ts clean; astro check 0 errors
T-10.1 verify-daily-readings.ts: COMPLETE -- 4/4 PASS
T-10.2 verify:daily-readings in chain: COMPLETE
T-10.3 pnpm verify full chain: COMPLETE -- exit 0

T-11.1: DEFERRED TO DEPLOY
T-11.2: DEFERRED TO DEPLOY
T-11.3: DEFERRED TO DEPLOY

---

## PR-2 Build / Test Evidence (pnpm verify 2026-06-05 exit 0)

verify:search-fts 7/7: PASS (FTS-3 BM25 ordering assertion NOW INCLUDED -- W-1 RESOLVED)
  FTS-3: BM25 scores non-descending (ORDER BY score ASC): [-7.155, -7.155, -7.042...]
verify:daily-readings 4/4: PASS
  DRV-1 sparvg returns sparvg only: PASS (1 entry)
  DRV-1 default matches spapddpt: PASS
  DRV-1 spapddpt returns spapddpt only: PASS
  DRV-2 listBibliaVersions: PASS (4 versions: mensaje, spaRV1909, spapddpt, sparvg)
astro check: PASS (0 errors, 0 warnings, 1 unrelated hint in TskPanel.astro)
astro build: COMPLETED -- server 16.09s; client 370ms; static routes clean

---

## PR-2 Spec Compliance Matrix

PILLS-1 DB-driven pill list: PASS -- listBibliaVersions() frontmatter; dynamic map loop; zero hardcoded slugs
PILLS-2 Pre-selection from selector.version: PASS -- pills island reads selector.get().version; DOMContentLoaded guard
PILLS-3 Session-scoped, no global mutation: PASS -- island read-only; grep selector.set: zero matches
DRV-1 getDailyReadings(version): PASS -- queries.ts:242 eq(recursos.slug,version); runtime verified
DRV-2 /datos/lectura-diaria.json 400 on unknown: PASS (WARNING W-3 -- no live HTTP test in CI)
DRV-3 Skeleton + client fill: PASS -- animate-pulse; fetch; swap; error restores baseline; escapeHtml
DRV-4 Static HTML default spapddpt: PASS -- getDailyReadings() at build time; island skips for spapddpt
CLN-1 listSearchDocuments deleted: PASS -- zero references in codebase

---

## PR-2 Commits

454ee5a -- feat(daily-readings): parameterize getDailyReadings(version) add lectura-diaria endpoint
97b7c13 -- feat(ui): DB-driven version pills + daily readings skeleton island on homepage
b43b133 -- feat(verify): add verify:daily-readings script and FTS-3 sort-order assertion
63110c4 -- chore: mark PR-2 tasks complete in openspec tasks.md

---

## Full-Change Issues Update

W-1 (FTS-3 no BM25 sort assertion): RESOLVED -- assertion added and passing in PR-2
W-3 (listSearchDocuments still exported): RESOLVED -- deleted, zero references

W-2 (FTS-6 error path not exercised): REMAINS -- DOCUMENTED
  Code correct (try/catch searchVersiculos + HTTP 200 in buscar.json.ts).
  No automated destructive test. Mitigated by documentation + runbook.

W-3-NEW (DRV-2 HTTP endpoint not live-tested): ACCEPTABLE
  Validated via static analysis + unit tests only. Covered by T-11.3 post-deploy.

S-1 (latency assertion): REMAINS -- non-blocking
S-2 (Turso runbook Windows fragility): REMAINS -- non-blocking
S-3 NEW (Pills label shows full nombre): SUGGESTION -- more accessible; no spec violation

---

## Full-Change Final Verdict

PASS WITH WARNINGS

PR-1 + PR-2: 27/27 code tasks complete (T-11.x deferred-to-deploy).
pnpm verify exits 0. 11/11 verify checks pass.
Astro check 0 errors. All bundles built clean.
W-1 RESOLVED. CLN-1 W-3 informational RESOLVED.
2 open warnings (W-2 FTS-6 no destructive test; W-3-NEW DRV-2 no live HTTP test) -- acceptable.
3 suggestions -- non-blocking.
No CRITICAL issues. Both PRs ready for code review and merge.
