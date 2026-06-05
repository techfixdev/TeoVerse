# Spec: search-version-selection

**Change**: search-version-selection
**Type**: New capabilities (3) + Cleanup (1)
**Status**: draft

---

## Overview

This spec covers four domains introduced by this change:

| Domain | Type | Requirements | Scenarios |
|--------|------|-------------|-----------|
| fts-search | New | 6 | 12 |
| search-version-pills | New | 3 | 7 |
| daily-readings-version | New | 4 | 8 |
| cleanup | New | 1 | 2 |

---

## Domain 1: fts-search

### Purpose

Replace the `LIKE '%q%'` scan in `buscar.json.ts` with an FTS5-backed accent/case-insensitive BM25 search over ~124K verses across 4 Bible versions.

### Requirements

| ID | Requirement | Strength |
|----|-------------|----------|
| FTS-1 | The system MUST support queries that are accent-insensitive: searching "corazon" MUST return verses containing "corazón". | MUST |
| FTS-2 | The system MUST support queries that are case-insensitive: searching "El" MUST return verses containing "él", "Él", "el". | MUST |
| FTS-3 | Results MUST be ordered by BM25 relevance score (most relevant first), not by canon order. | MUST |
| FTS-4 | Search MUST filter results to only the version(s) selected by the user. | MUST |
| FTS-5 | The system MUST return at most 60 results per query. Empty or fewer-than-3-character queries MUST return an empty result set immediately without hitting the DB. | MUST |
| FTS-6 | If the FTS5 index is unavailable or a rebuild fails, the system MUST fall back gracefully: return an empty result with an error indicator in the response payload (no 500). | MUST |

---

### Requirement: FTS-1 — Accent-insensitive matching

The search endpoint MUST normalize diacritics at index time using `tokenize='unicode61 remove_diacritics 2'` so that queries without accents match verses that contain accented characters.

#### Scenario: Accent-stripped query matches accented verse

- GIVEN the FTS index is populated with verses containing "corazón"
- WHEN the user searches for "corazon" (no accent)
- THEN the response MUST include verses containing "corazón"
- AND the response MUST NOT include a 4xx or 5xx error

#### Scenario: Accented query also matches

- GIVEN the FTS index is populated with verses containing "corazón"
- WHEN the user searches for "corazón" (with accent)
- THEN the response MUST include verses containing "corazón"

---

### Requirement: FTS-2 — Case-insensitive matching

The search endpoint MUST treat uppercase and lowercase as equivalent during matching.

#### Scenario: Uppercase query matches lowercase verse text

- GIVEN a verse containing the word "él"
- WHEN the user searches for "El"
- THEN the response MUST include that verse

---

### Requirement: FTS-3 — BM25 relevance ordering

Results MUST be sorted by BM25 score descending so that the most relevant verses appear first.

#### Scenario: Higher-frequency match ranks above lower-frequency match

- GIVEN two verses where one repeats the search term more centrally
- WHEN the user submits a search query
- THEN the response array MUST be ordered with the higher-BM25-score verse first
- AND results MUST NOT arrive in canon (book/chapter/verse) order

---

### Requirement: FTS-4 — Version filtering

The search MUST apply a `recurso_id IN (...)` filter so that only verses belonging to the selected version(s) are returned.

#### Scenario: Single version selected

- GIVEN the user has selected only `spapddpt`
- WHEN a search query is submitted
- THEN all returned verses MUST belong to `spapddpt`
- AND verses from `sparvg`, `spaRV1909`, or `mensaje` MUST NOT appear

#### Scenario: Multiple versions selected

- GIVEN the user has selected `spapddpt` and `sparvg`
- WHEN a search query is submitted
- THEN returned verses MUST belong to either `spapddpt` or `sparvg` only

---

### Requirement: FTS-5 — Result limit and short-query guard

The endpoint MUST reject trivially short queries early (before DB access) and cap results.

#### Scenario: Query shorter than 3 characters

- GIVEN the user submits a query of 1 or 2 characters
- WHEN the endpoint processes the request
- THEN the response MUST be `{ results: [] }` with HTTP 200
- AND the DB MUST NOT be queried

#### Scenario: Result count cap

- GIVEN a query that would match more than 60 verses
- WHEN the endpoint processes the request
- THEN the response MUST contain at most 60 verse results

---

### Requirement: FTS-6 — Fallback on FTS index failure

If the FTS5 virtual table is missing or the query errors, the endpoint MUST NOT return HTTP 500.

#### Scenario: FTS table missing at query time

- GIVEN the `versiculos_fts` table does not exist or throws an error
- WHEN the user submits a search query
- THEN the response MUST return HTTP 200 with `{ results: [], error: "search_unavailable" }`
- AND no unhandled exception MUST propagate to the client

---

## Domain 2: search-version-pills

### Purpose

Replace hardcoded version slug lists with DB-driven pills sourced from `/datos/biblioteca.json`, pre-selected based on the user's persisted `$selector.version`.

### Requirements

| ID | Requirement | Strength |
|----|-------------|----------|
| PILLS-1 | Version pills MUST be rendered from the same data source as `/datos/biblioteca.json` (no hardcoded slug arrays in the search page). | MUST |
| PILLS-2 | On page load the pill matching the user's persisted `$selector.version` MUST be pre-checked; all others MUST be unchecked by default. | MUST |
| PILLS-3 | Toggling a pill MUST update the active version filter for the current search session but MUST NOT modify `$selector.version` (pills are search-session-scoped, not global preference). | MUST |

---

### Requirement: PILLS-1 — DB-driven pill list

The system MUST derive the available version pills at render time from `/datos/biblioteca.json` so that adding a new Bible version requires only a data change, not a code change.

#### Scenario: New Bible added to biblioteca.json

- GIVEN a new Bible slug is added to `/datos/biblioteca.json`
- WHEN the search page renders
- THEN a corresponding pill MUST appear without any code change to the search page

#### Scenario: No hardcoded slug list

- GIVEN the search page source
- WHEN inspected
- THEN it MUST NOT contain a hardcoded array of version slugs (e.g., `['spapddpt', 'sparvg', ...]`)

---

### Requirement: PILLS-2 — Pre-selection from persisted selector

The pill matching the user's saved Bible MUST be checked on page load.

#### Scenario: User has `spapddpt` saved in $selector

- GIVEN `$selector.version` is `"spapddpt"`
- WHEN the search page loads
- THEN the `spapddpt` pill MUST be pre-checked
- AND all other pills MUST be unchecked

#### Scenario: No version saved (first visit)

- GIVEN `$selector.version` is absent or null
- WHEN the search page loads
- THEN the default version pill (`spapddpt`) MUST be pre-checked

---

### Requirement: PILLS-3 — Session-scoped toggle, no global mutation

Toggling pills during a search session MUST NOT persist to `$selector.version`.

#### Scenario: User unchecks saved version during search

- GIVEN `$selector.version` is `"spapddpt"` and the `spapddpt` pill is pre-checked
- WHEN the user unchecks the `spapddpt` pill and runs a search
- THEN the search MUST filter to only the remaining checked versions
- AND after navigating away and returning, `$selector.version` MUST still be `"spapddpt"`

---

## Domain 3: daily-readings-version

### Purpose

Make daily readings respect the user's chosen Bible version by parameterizing `getDailyReadings(version)` and introducing a `prerender:false` endpoint `/datos/lectura-diaria.json?version=X`, while showing a skeleton until the client fills in the preferred version's verses.

### Requirements

| ID | Requirement | Strength |
|----|-------------|----------|
| DRV-1 | `getDailyReadings` MUST accept a `version` parameter; it MUST NOT hardcode `spapddpt`. | MUST |
| DRV-2 | The endpoint `/datos/lectura-diaria.json?version=X` MUST return daily readings for the requested version; unknown versions MUST return HTTP 400. | MUST |
| DRV-3 | The static HTML MUST render a skeleton (placeholder) for the daily readings section, not the actual verses; the client MUST fetch and replace the skeleton using `$selector.version`. | MUST |
| DRV-4 | The static HTML fallback (before JS hydration) MUST default to `spapddpt` verses so that the page is usable with JS disabled or on first paint. | SHOULD |

---

### Requirement: DRV-1 — Parameterized getDailyReadings

The query function MUST accept a version slug and retrieve verses for that version.

#### Scenario: Valid version passed

- GIVEN `getDailyReadings("sparvg")` is called
- WHEN the DB is queried
- THEN only verses with `recurso_id = "sparvg"` for today's readings MUST be returned

#### Scenario: Default version still works

- GIVEN `getDailyReadings("spapddpt")` is called
- WHEN the DB is queried
- THEN verses for `spapddpt` MUST be returned (same as legacy behavior)

---

### Requirement: DRV-2 — Version-aware serverless endpoint

The `/datos/lectura-diaria.json` endpoint MUST accept `?version=X` and validate input.

#### Scenario: Known version requested

- GIVEN `GET /datos/lectura-diaria.json?version=sparvg`
- WHEN the endpoint processes the request
- THEN HTTP 200 MUST be returned with verses for `sparvg`

#### Scenario: Unknown version requested

- GIVEN `GET /datos/lectura-diaria.json?version=nonexistent`
- WHEN the endpoint processes the request
- THEN HTTP 400 MUST be returned with an error payload (e.g., `{ error: "invalid_version" }`)

#### Scenario: No version param

- GIVEN `GET /datos/lectura-diaria.json` (no `?version`)
- WHEN the endpoint processes the request
- THEN HTTP 200 MUST be returned using the default version (`spapddpt`)

---

### Requirement: DRV-3 — Skeleton state with client fill

The initial render MUST show a skeleton; the client MUST swap in real verses after reading `$selector.version`.

#### Scenario: Page loads in browser with saved version

- GIVEN `$selector.version` is `"spaRV1909"`
- WHEN the page loads and the client script executes
- THEN the skeleton MUST be replaced with verses from `spaRV1909`
- AND the swap MUST occur without a full page reload

#### Scenario: Fetch in progress

- GIVEN the page has loaded and the client fetch has not yet resolved
- WHEN the daily readings section is visible
- THEN the skeleton MUST be displayed (no raw empty content, no layout shift beyond skeleton bounds)

---

### Requirement: DRV-4 — Static HTML default

The pre-rendered HTML SHOULD include `spapddpt` verses as the no-JS fallback.

#### Scenario: JS disabled

- GIVEN a browser with JavaScript disabled
- WHEN the home page is loaded
- THEN the daily readings section MUST display `spapddpt` verses (not an empty skeleton)

---

## Domain 4: cleanup

### Purpose

Remove dead code confirmed unused: `listSearchDocuments()` query function and any remaining hardcoded version slug arrays in page files.

### Requirements

| ID | Requirement | Strength |
|----|-------------|----------|
| CLN-1 | `listSearchDocuments()` MUST be deleted from `src/db/queries.ts` and MUST NOT be called anywhere in the codebase after this change. | MUST |

---

### Requirement: CLN-1 — Remove listSearchDocuments

The dead query function MUST be deleted. Confirm via grep before deletion.

#### Scenario: No callers exist

- GIVEN a grep of the entire codebase for `listSearchDocuments`
- WHEN the search is run
- THEN zero references MUST be found before deletion proceeds

#### Scenario: Post-deletion codebase check

- GIVEN `listSearchDocuments` has been deleted
- WHEN `pnpm verify` is run
- THEN it MUST pass with no TypeScript errors referencing the removed function

---

## Cross-Cutting Constraints

| Constraint | Strength |
|------------|----------|
| `pnpm verify` MUST pass after all changes | MUST |
| `pnpm build` MUST succeed (static output) | MUST |
| `$selector.version` is the SINGLE source of truth for Bible preference — no new store keys | MUST |
| All UI copy MUST remain in Spanish | MUST |
| Skeleton flash MUST be bounded — no layout shift outside skeleton container | SHOULD |
| Search response time MUST be under 300ms for 124K verse corpus on Turso | SHOULD |
