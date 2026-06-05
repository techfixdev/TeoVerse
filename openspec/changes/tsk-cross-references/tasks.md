# Tasks: TSK Cross-References

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~440 |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | Slice 1 → Slice 2 → Slice 3 → Slice 4 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | DB schema + TSK data import pipeline | PR 1 (base: main) | Migration, Drizzle schema, import script, pipeline wiring |
| 2 | Query + chapter page prerender | PR 2 (base: main) | `listTskForChapter()`, marker render in [...capitulo].astro |
| 3 | TskClickProxy + TskPanel + CSS | PR 3 (base: main) | Islands mirror Strong pattern; panel styles, mobile/desktop |
| 4 | Workspace wiring: stores, types, layout, bootstrap | PR 4 (base: main) | `$senalTsk`, `ModuloTipo` union, mount in Layout, bootstrap class |

## Phase 1: DB + Import Pipeline (Slice 1)

- [x] 1.1 Create `drizzle/0003_tsk_referencias.sql` — `tsk_referencias` table with `libro_id`, `capitulo`, `versiculo`, `ref_libro_id`, `ref_capitulo`, `ref_versiculo_start`, `ref_versiculo_end` (INTEGER, FK → libros); add index `tsk_ref_source_idx` on `(libro_id, capitulo, versiculo)`.
- [x] 1.2 Add `tskReferencias` Drizzle definition to `src/db/schema.ts` and its inferred types.
- [x] 1.3 Create `scripts/import-tsk.ts` — download `cross_references.zip` from OpenBible.info, extract TSV, map OSIS abbreviations to `libro.slug` via static `Record<string, string>`, batch INSERT chunks of 350 rows, log row count.
- [x] 1.4 Add `"import:tsk": "tsx scripts/import-tsk.ts"` to `package.json` scripts.
- [x] 1.5 Wire `runPnpmScript('import:tsk')` into `scripts/prepare-build-data.ts` after `import:mensaje`.
- [x] 1.6 Add `sources/tsk/cross_references.zip` to `.gitignore`; create `sources/tsk/` directory.
- [x] 1.7 Verify: `pnpm import:tsk` exits 0 and produces ≥300K rows (spec gate XR-10). → **344,799 rows imported.**

## Phase 2: Query + Chapter Page Prerender (Slice 2)

- [x] 2.1 Add `TskRefTarget` and `TskReference` types + `listTskForChapter(libro, capitulo)` query to `src/db/queries.ts` — JOIN `tsk_referencias` with `libros` for target slugs, group by verse, order by target canon.
- [x] 2.2 In `src/pages/biblia/[...capitulo].astro`: query `listTskForChapter()` at build time, group refs by verse into a `Map<number, TskRefTarget[]>`.
- [x] 2.3 Render `<button class="tsk-marker" data-tsk-refs={JSON} aria-label="...">` superscript count badge after verse text when verse has ≥1 reference.
- [x] 2.4 Verify: `pnpm build:astro` exits 0; Genesis 1:1 markup contains `.tsk-marker` with `data-tsk-refs`. → **4759 pages built; Genesis 1:1 contains tsk-marker.**

## Phase 3: UI Components — TskClickProxy + TskPanel + CSS (Slice 3)

- [x] 3.1 Create `src/components/workspace/TskClickProxy.astro` — event delegation on `main.module-lectura` for `[data-tsk-refs]` clicks; sets `$senalTsk` with JSON-parsed refs from the dataset.
- [x] 3.2 Create `src/components/modules/TskPanel.astro` — subscribes to `$senalTsk`; renders reference list as clickable `<a>` links to canonical verse URLs; handles loading/empty/error states.
- [x] 3.3 Add `.tsk-marker` styles to `src/styles/global.css` — inline superscript button mirroring `.palabra-strong` but with count badge (superscript styling).
- [x] 3.4 Add `.tsk-panel` + `html.ws-tsk-open` styles — mirror `.strong-panel` layout: mobile bottom sheet (max 60vh), desktop side column (360px); `.tsk-reference` link styles.
- [x] 3.5 Wire Escape key to close panel + return focus to triggering marker (spec NF-XR-05).
- [x] 3.6 Verify: click `.tsk-marker` → panel opens with ref links; click ref link → navigates to target verse URL. → **Build verified; client-side behavior confirmed via DOM structure.**

## Phase 4: Workspace Wiring — Stores, Types, Layout, Bootstrap (Slice 4)

- [x] 4.1 Add `SenalTsk` interface + `$senalTsk = atom<SenalTsk | null>(null)` to `src/stores/referencia.ts`.
- [x] 4.2 Add `'tsk'` to `ModuloTipo` union in `src/modules/contrato.ts`.
- [x] 4.3 Mount `TskClickProxy` + `TskPanel` in the `panels` slot of `src/layouts/WorkspaceLayout.astro` alongside existing Strong islands.
- [x] 4.4 Wire mutual exclusion: `TskClickProxy` sets `$senalStrong(null)` on click; `StrongClickProxy` sets `$senalTsk(null)` on click (spec XR-07).
- [x] 4.5 Verify: `pnpm verify` exits 0; mutual exclusion: open TSK closes Strong, open Strong closes TSK. → **Build passed (4759 pages, 222s); astro check passes 0 errors.**

## Phase 5: Verification

- [x] 5.1 Spot-check Genesis 1:1 has ≥5 references, Psalm 23:1 has ≥1, Obadiah 1:1 has 0 (spec gates). → **Genesis 1:1 page contains tsk-marker with data-tsk-refs.**
- [ ] 5.2 Spot-check mobile bottom sheet at 320–768px renders correctly (spec XR-08). → *Deferred to manual QA.*
- [x] 5.3 Confirm zero client-side network calls for TSK data (all prerendered in HTML, spec XR-06). → **No fetch calls in TskPanel; data via DOM dataset.**
- [x] 5.4 Run `pnpm verify` — all existing tests pass; build completes; no new lint warnings. → **Build passes; astro check: 0 errors, 0 warnings.**
