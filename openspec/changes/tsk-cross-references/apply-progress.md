# Apply Progress: tsk-cross-references

**Status**: success
**Mode**: Standard (strict TDD disabled)
**Tasks**: 22/22 completed (Phase 1-4 done + Phase 5 automated gates)

## Slice 1: DB + Import Pipeline

| Commit | Message |
|--------|---------|
| `ee03f80` | feat(tsk): add tsk_referencias table, schema, import script, and build pipeline |
| `149874a` | chore(tsk): add sources/tsk directory for cached cross-references zip |
| `2409707` | fix(tsk): correct TSV format parsing with 3-field lines and OpenBible abbreviations |

**Files**: `drizzle/0003_tsk_referencias.sql`, `src/db/schema.ts`, `scripts/import-tsk.ts`, `package.json`, `scripts/prepare-build-data.ts`, `.gitignore`, `sources/tsk/.gitkeep`, `drizzle/meta/_journal.json`

**Results**: 344,799 cross-references imported, table created with index `tsk_ref_source_idx`

## Slice 2: Query + Chapter Page Prerender

| Commit | Message |
|--------|---------|
| `bf812b5` | feat(tsk): add listTskForChapter query and inline verse markers |

**Files**: `src/db/queries.ts`, `src/pages/biblia/[version]/[libro]/[capitulo].astro`

**Results**: `listTskForChapter()` query with JOIN + verse grouping; tsk-marker buttons with `data-tsk-refs` rendered per verse

## Slice 3: UI Components

| Commit | Message |
|--------|---------|
| `1aa97fa` | feat(tsk): add TskClickProxy, TskPanel, and CSS styles |

**Files**: `src/components/workspace/TskClickProxy.astro`, `src/components/modules/TskPanel.astro`, `src/styles/global.css`

**Results**: Event delegation island, panel with reference links + "Mostrar todas" toggle, Escape key handling, mobile/desktop CSS styles

## Slice 4: Workspace Wiring

| Commit | Message |
|--------|---------|
| `73b1add` | feat(tsk): wire $senalTsk store, types, layout mounts, and mutual exclusion |

**Files**: `src/stores/referencia.ts`, `src/modules/contrato.ts`, `src/layouts/WorkspaceLayout.astro`, `src/components/workspace/StrongClickProxy.astro`

**Results**: `$senalTsk` atom, `ModuloTipo` union extended with `'tsk'`, layout mounts, mutual exclusion (TSK ↔ Strong)

## Key Discoveries

1. **TSV format**: OpenBible.info dataset uses dot-separated verse format (`Gen.1.1`) in a 3-field TSV, not a 5-field tab-separated format with `:` notation. The `fields.length` check needed to be `>= 3` not `>= 5`.

2. **Abbreviation mapping**: The dataset uses OpenBible-specific abbreviations (`Exod`, `Deut`, `Josh`, `Judg`, `Ruth`, `Ps`, `Eccl`, `Song`, `Joel`, `Amos`, `Obad`, `Jonah`, `Zech`, `Zeph`, `Matt`, `Mark`, `Luke`, `John`, `Acts`, `1Cor`, `Phil`, `1Thess`, `Titus`, `Phlm`, `1Pet`, `Jude`) — different from standard OSIS. The mapping had to be completely rewritten.

3. **Bootstrap generic**: The workspace bootstrap script handles new module IDs generically by iterating `Object.keys(modulos)` — no changes needed for the `'tsk'` module to get `ws-tsk-open`/`ws-tsk-closed` CSS classes.

## Verification

| Gate | Result |
|------|--------|
| `pnpm astro check` | 0 errors, 0 warnings |
| `pnpm astro build` | 4759 pages in 222s (success) |
| Genesis 1:1 tsk-marker | Present with `data-tsk-refs` |
| Import row count | 344,799 (>300K gate XR-10) |
| Mobile bottom sheet | Deferred to manual QA (task 5.2) |
