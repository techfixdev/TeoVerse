# cross-references Specification

## Purpose

Treasury of Scripture Knowledge (TSK) cross-reference study tool. Displays inline verse markers with pre-rendered reference data in a side/bottom panel. Zero runtime network calls. Follows Strong panel island pattern.

## Requirements

### Functional

| ID | Requirement | Strength |
|----|-------------|----------|
| XR-01 | `tsk_referencias` table MUST store ~340K source→target verse pairs with canonical book/chapter/verse IDs | MUST |
| XR-02 | `listTskForChapter()` MUST return references grouped by verse, ordered by target canon + chapter + verse | MUST |
| XR-03 | Each verse with ≥1 reference MUST render a `<button class="tsk-marker">` superscript count badge after the verse text | MUST |
| XR-04 | Marker MUST embed reference list as `data-tsk-refs` JSON attribute — no fetch at runtime | MUST |
| XR-05 | `TskClickProxy` MUST delegate clicks on `[data-tsk-refs]` to set `$senalTsk` signal | MUST |
| XR-06 | `TskPanel` MUST render reference list from signal data as clickable `<a>` links to canonical verse URLs | MUST |
| XR-07 | Opening TSK panel MUST close Strong panel; opening Strong MUST close TSK (mutual exclusion) | MUST |
| XR-08 | Panel MUST render as bottom sheet (max 60vh) at < 1024px; side column (360px) at ≥ 1024px | MUST |
| XR-09 | References with verse ranges (e.g., Jn 1:1-3) MUST link to chapter anchor | SHOULD |
| XR-10 | TSK import script MUST complete in < 30s and validate row count ≥ 300K | MUST |

### Scenarios

**Verse with references (happy path)**: GIVEN Genesis 1:1 has 6+ TSK references → WHEN page renders → THEN superscript marker appears after verse text → WHEN clicked → THEN panel opens with clickable reference links.

**Verse with zero references**: GIVEN verse has no TSK entries → WHEN page renders → THEN no marker rendered, verse displays normally.

**Mutual exclusion — TSK closes Strong**: GIVEN Strong panel is open → WHEN user clicks TSK marker → THEN Strong panel closes, TSK panel opens in same slot.

**Reference navigation**: GIVEN TSK panel shows "Juan 1:1-3" → WHEN user clicks link → THEN browser navigates to `/biblia/{version}/juan/1/#v1`.

**Mobile bottom sheet**: GIVEN viewport is 375px → WHEN TSK panel opens → THEN bottom sheet appears (max 60vh), reading area remains scrollable above.

**Build-time prerender**: GIVEN SSG build runs → WHEN chapter page generates → THEN all TSK data embedded in HTML — zero client-side network calls.

### Non-Functional

| ID | Category | Requirement | Strength |
|----|----------|-------------|----------|
| NF-XR-01 | Perf | `listTskForChapter()` MUST complete in < 5ms per chapter; total build impact < 5s | MUST |
| NF-XR-02 | Payload | Embedded `data-tsk-refs` JSON per verse SHOULD be < 2KB; per chapter < 20KB | SHOULD |
| NF-XR-03 | A11y | `tsk-marker` buttons MUST have `aria-label="N referencias cruzadas para {libro} {cap}:{v}"` | MUST |
| NF-XR-04 | A11y | `TskPanel` MUST have `role="complementary"`, `aria-label="Referencias cruzadas"` | MUST |
| NF-XR-05 | A11y | Panel MUST close on Escape key; focus MUST return to triggering marker | MUST |
| NF-XR-06 | DB | TSK data SHOULD NOT increase `local.db` beyond 30MB | SHOULD |

### Edge Cases

| Case | Expected Behavior |
|------|-------------------|
| Verse with 50+ references | Panel shows first 30 with "Mostrar todas (N)" toggle; internal scroll |
| Missing verse (versification gap) | No marker rendered; no error logged |
| Different Bible version selected | TSK references canonical positions — version-agnostic |
| Empty chapter (e.g., Psalm 117) | Query returns empty array; no markers; zero overhead |
| Corrupted JSON in `data-tsk-refs` | `TskPanel` try/catch → fallback "Error al cargar referencias" |
| JavaScript disabled | `tsk-marker` buttons render but do nothing; no broken UI |
| Rapid click on multiple markers | `$senalTsk` overwrites; last clicked verse wins |
| Panel open + browser back/forward | Panel closes on full page navigation (SSG) |

### Build-Time Verification Gates

| Gate | Test | Threshold |
|------|------|-----------|
| Import | `import:tsk` exits 0 | Row count > 300,000 |
| Build | `astro build` exits 0 after TSK integration | < 5s increase vs baseline |
| Verify | `pnpm verify` exits 0 | All existing tests pass |
| Spot-check | Genesis 1:1 has ≥ 5 refs; Psalm 23:1 has ≥ 1 ref; Obadiah 1:1 has ≥ 0 refs | Manual + automated assertion |
| Lint | `pnpm lint` exits 0 | No new warnings |
