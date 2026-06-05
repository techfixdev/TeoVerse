# Archive Report: responsive-a11y-font

**Date**: 2026-06-04
**Status**: Archived — PASS WITH WARNINGS
**Mode**: hybrid (engram + openspec)

## Summary

Implemented responsive font scaling, skip-to-content navigation, and reduced-motion support for TeoVerse. All 18 spec requirements compliant, all 17 tasks complete, `pnpm verify` exits 0, `pnpm build` produces 4759 static pages.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `accessibility` | Created | 3 capabilities: font-scaling (FS-01–FS-07), skip-to-content (SC-01–SC-03), reduced-motion (RM-01–RM-02), + 2 permanent NFRs (NF-03, NF-04) |

Delta requirements merged into `openspec/specs/accessibility/spec.md`. No existing main specs were present — this is the first accessibility spec.

4 change-specific NFRs (NF-01, NF-02, NF-05, NF-06) and 10 build verification gates (G1–G10) were not carried into the permanent spec — they belong to the change's delivery contract, not the enduring accessibility requirements.

## Verification Result

**PASS WITH WARNINGS** — all 18 spec requirements compliant.

One documented deviation: skip-to-content link uses `absolute -top-full ... focus:top-4` instead of `sr-only focus:not-sr-only` to avoid Tailwind class conflicts. Functionally equivalent, no WCAG violation.

## Artifacts

| Artifact | Engram ID | Filesystem Path |
|----------|-----------|----------------|
| Proposal | #1104 | `archive/2026-06-04-responsive-a11y-font/proposal.md` |
| Delta Spec | #1106 | `archive/2026-06-04-responsive-a11y-font/spec.md` |
| Design | #1105 | `archive/2026-06-04-responsive-a11y-font/design.md` |
| Tasks | #1107 | `archive/2026-06-04-responsive-a11y-font/tasks.md` |
| Apply Progress | #1108 | `archive/2026-06-04-responsive-a11y-font/apply-progress.md` |
| Verify Report | #1109 | `archive/2026-06-04-responsive-a11y-font/verify-report.md` |
| Exploration | N/A | `archive/2026-06-04-responsive-a11y-font/explore.md` |

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `src/styles/global.css` | Modified | +25 |
| `src/components/brand/fontBootstrap.ts` | Created | +30 |
| `src/components/brand/FontSizeControl.astro` | Created | +45 |
| `src/stores/fontScale.ts` | Created | +20 |
| `src/layouts/MainLayout.astro` | Modified | +10 |
| `src/layouts/WorkspaceLayout.astro` | Modified | +12 |
| `src/pages/index.astro` | Modified | +1 |
| `src/pages/buscar.astro` | Modified | +1 |
| `src/pages/atribuciones.astro` | Modified | +1 |
| `src/pages/biblia/index.astro` | Modified | +1 |

**Total**: ~146 lines

## Key Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Font scaling via `--font-scale` CSS custom property × `html { font-size }` | Scales ALL `rem` units uniformly, SSG-compatible, zero JS for scaling |
| 2 | Inline `<script is:inline set:html={...}>` bootstrap pattern | Must run before paint to prevent FOUC; follows workspace bootstrap pattern |
| 3 | Separate `<script>` tag after workspace bootstrap | Isolated concerns; font bootstrap only touches `<html>` classList |
| 4 | Store key `rv:font-scale` in persistentJSON nanostore | Matches existing `rv:last-selection` naming convention |
| 5 | FontSizeControl in header alongside BrandLogo | Visible on every page without per-page imports |
| 6 | Scale levels 1.15 / 1.35 / 1.6 | 15% increments for aging eyes without breaking 320px layout |

## Known Gotchas

- Skip-to-content: Tailwind's `sr-only` + `focus:not-sr-only` creates specificity conflicts between `position: absolute` and `position: fixed`. Using `absolute -top-full ... focus:top-4` is functionally equivalent and avoids the conflict.
- `html { font-size: calc(100% * var(--font-scale)) }` scales ALL `rem` units — this is correct behavior but means `--header-h` (also rem-based) scales proportionally with text, preserving scroll-margin-top geometry.

## Source of Truth Updated

- `openspec/specs/accessibility/spec.md` — new main spec covering font-scaling, skip-to-content, reduced-motion

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. Ready for the next change.
