# Proposal: Treasury of Scripture Knowledge Cross-References

## Intent

Add the TSK cross-reference tool — ~340K verse-to-verse references displayed inline per verse (e-Sword style), reusing the Strong panel island pattern. Zero runtime dependencies: all data embedded at build time.

## Scope

### In Scope
- TSK data import from OpenBible.info (~2MB zip, CC BY 4.0) → **SQLite** `tsk_referencias` table
- **Build-time query**: `listTskForChapter()` groups refs by verse, ordered by canon
- **Inline superscript marker** per verse (count badge: `ⁿ`) with `data-tsk-refs` JSON embed
- **TskClickProxy** + **TskPanel** islands (mirror StrongClickProxy + StrongPanel)
- **CSS**: `.tsk-marker`, `.tsk-panel`, `html.ws-tsk-open` classes (follow Strong panel styles)
- **Workspace module**: `'tsk'` module in `$workspace` store, bootstrap class toggling
- **Mutual exclusion**: opening TSK closes Strong, and vice versa

### Out of Scope
- Version-scoped TSK (references are version-agnostic)
- Original TSK theme grouping (a/b/c letter annotations)
- User notes/bookmarks on cross-references

## Capabilities

### New Capabilities
- `cross-references`: TSK cross-reference study tool — inline verse markers + side panel with clickable reference links

### Modified Capabilities
- None

## Approach

Follow the **Strong panel island pattern** exactly:

| Pattern | Strong | TSK |
|---------|--------|-----|
| Data | JSON fetch per code | Embedded `data-tsk-refs` JSON |
| Click proxy | `StrongClickProxy` → `$senalStrong` | `TskClickProxy` → `$senalTsk` |
| Panel island | `StrongPanel.astro` | `TskPanel.astro` |
| Store signal | `$senalStrong` atom | `$senalTsk` atom |
| CSS classes | `ws-strong-open` / `ws-strong-closed` | `ws-tsk-open` / `ws-tsk-closed` |

Key difference: TSK data is **prerendered** (no fetch) — embedded as `data-tsk-refs` in the HTML at build time.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `drizzle/` | New migration | `tsk_referencias` table + index |
| `src/db/schema.ts` | Modify | Add `tskReferencias` Drizzle definition |
| `src/db/queries.ts` | Modify | Add `listTskForChapter()` |
| `scripts/import-tsk.ts` | Create | Download, parse OSIS→slug, batch INSERT |
| `scripts/prepare-build-data.ts` | Modify | Add `import:tsk` step |
| `src/pages/biblia/[...capitulo].astro` | Modify | Query TSK, render markers |
| `src/components/workspace/TskClickProxy.astro` | Create | Event delegation |
| `src/components/modules/TskPanel.astro` | Create | Panel island |
| `src/stores/referencia.ts` | Modify | Add `$senalTsk` + `SenalTsk` type |
| `src/stores/workspace.ts` | Minimal | `'tsk'` module ID — works with existing `Record<string, EstadoModulo>` |
| `src/modules/contrato.ts` | Minimal | Add `'tsk'` to `ModuloTipo` union |
| `src/styles/global.css` | Modify | `.tsk-panel`, `.tsk-marker`, `.tsk-reference` |
| `src/layouts/WorkspaceLayout.astro` | Modify | Mount TskClickProxy + TskPanel in panels slot |
| `src/components/workspace/bootstrap.ts` | Modify | Handle `ws-tsk-open`/`ws-tsk-closed` classes |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| OSIS→slug mapping incomplete for rare books (3John, Jude) | Low | Static map covers all 66 books; validate with spot-check script |
| Versification mismatch (Spanish Bibles vs KJV) | Low | TSK references canonical positions; mismatched verses silently skip — no marker rendered |
| DB growth beyond acceptable (~23MB) | Low | Ephemeral build DB; ~15MB TSK data fits comfortably |
| Build time increase from 4759 extra queries | Low | Indexed query ~0.5ms each → ~2.4s total. Acceptable for SSG build |

## Rollback Plan

1. Remove `tsk_referencias` migration (drop table)
2. Delete `scripts/import-tsk.ts` + remove from `prepare-build-data.ts`
3. Delete `TskClickProxy.astro` + `TskPanel.astro`
4. Revert queries, stores, CSS, workspace wiring, layouts to pre-TSK state
5. DB is ephemeral (rebuilt on every `prepare-build-data`) — no persistent data to clean

## Dependencies

- Strong panel infrastructure (stores, workspace, bootstrap, CSS grid) — **already merged**
- OpenBible.info cross-references dataset (https://a.openbible.info/data/cross-references.zip)

## Success Criteria

- [ ] `pnpm verify` exits 0 after all changes
- [ ] Genesis 1:1 shows cross-reference marker with ≥5 references (spot-check vs BibleHub)
- [ ] Clicking a TSK marker opens panel; clicking a Strong word closes TSK and opens Strong
- [ ] Clicking a reference link navigates to the target verse
- [ ] Mobile bottom sheet renders correctly at 320–768px
- [ ] `import:tsk` runs in < 30s and produces ~340K rows
- [ ] Zero client-side network calls for TSK data (all prerendered)

## Delivery Strategy

**Strategy**: `stacked-to-main` (4 slices), `auto-chain`

| Slice | Scope | Est. lines |
|-------|-------|------------|
| **DB + import** | Migration, schema, import script, pipeline | ~120 |
| **Query + render** | `listTskForChapter()`, chapter page markers | ~80 |
| **UI components** | TskClickProxy, TskPanel, CSS | ~180 |
| **Workspace wiring** | Layout, stores, bootstrap, types | ~60 |
