# Apply Progress: responsive-a11y-font

**Date**: 2026-06-04
**Mode**: Standard (no strict TDD)
**Status**: Complete — all 15 tasks implemented, `pnpm verify` passes

## Completed Tasks

### Phase 1: CSS Infrastructure
- [x] 1.1 `src/styles/global.css` — Added `:root { --font-scale: 1 }`, `.font-scale-sm/md/lg` classes, `html { font-size: calc(100% * var(--font-scale)) }`
- [x] 1.2 `src/styles/global.css` — Added `@media (prefers-reduced-motion: reduce)` with 0.01ms durations

### Phase 2: Bootstrap & Store
- [x] 2.1 `src/stores/fontScale.ts` — Created with `$fontScale` persistentJSON store (key `rv:font-scale`)
- [x] 2.2 `src/components/brand/fontBootstrap.ts` — Created inline script string
- [x] 2.3 `src/layouts/MainLayout.astro` — Added bootstrap script after viewport meta
- [x] 2.4 `src/layouts/WorkspaceLayout.astro` — Added bootstrap script AFTER workspace bootstrap

### Phase 3: FontSizeControl Component
- [x] 3.1 `src/components/brand/FontSizeControl.astro` — Created with +/reset/- buttons, `role="group"`, touch targets >=44px
- [x] 3.2-3.3 Both layouts import and render FontSizeControl in header

### Phase 4: A11y Quick Wins
- [x] 4.1-4.2 Skip-to-content link in both layouts
- [x] 4.3-4.4 `id="main-content"` on all `<main>` elements

### Phase 5: Verification
- [x] All gates pass: `astro check` 0 errors, `pnpm build` 4759 pages, `pnpm verify` exits 0

## Deviations

Skip-to-content uses `absolute -top-full ... focus:top-4` instead of `sr-only focus:not-sr-only` to avoid Tailwind class conflicts.
