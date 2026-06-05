# Proposal: responsive-a11y-font

## Intent

TeoVerse serves Bible study to older church members who need adjustable text. All font sizes are fixed Tailwind utilities — no scaling, persistence, or user control. Browser zoom breaks the workspace grid, sticky headers, and Strong panel. This change gives users font size control that persists and applies before first paint, plus low-effort a11y quick wins.

## Scope

### In Scope
- Font size control: 3 scales (sm 1.15x, md 1.35x, lg 1.6x) + default via CSS custom properties
- Pre-paint bootstrap: inline script reads localStorage, applies `<html>` class (no FOUC)
- `$fontScale` nanostore (`persistentJSON`, key `rv:font-scale`)
- FontSizeControl.astro toggle component in header
- Skip-to-content link on all pages
- `prefers-reduced-motion` media query
- `id="main-content"` on all `<main>` elements

### Out of Scope
- Dark mode toggle (CSS infra ready; separate change)
- Fluid typography (`clamp()`) — defer as future enhancement
- New breakpoints or container queries

## Capabilities

### New Capabilities
- `font-scaling`: User-controlled font size, CSS-custom-property driven, localStorage-persisted, applied pre-paint
- `skip-to-content`: Keyboard-accessible skip link on all pages
- `reduced-motion`: Respect `prefers-reduced-motion` by disabling transitions/animations

### Modified Capabilities
None — no existing specs.

## Approach

Follow the established workspace bootstrap pattern (CSS custom properties + inline script + nanostores):

1. `:root { --font-scale: 1; }` + `<html>` scale classes (1.15, 1.35, 1.6)
2. `html { font-size: calc(100% * var(--font-scale)) }` — scales all `rem` units globally
3. Inline bootstrap in both layouts' `<head>` reads `localStorage['rv:font-scale']`, applies class before paint
4. `$fontScale` persistentJSON store for reactive components
5. FontSizeControl.astro: +/–/reset buttons with ARIA `role="group"`, `aria-label="Control de tamaño de texto"`

## Affected Areas

| Area | Impact | Lines |
|------|--------|-------|
| `src/styles/global.css` | Modify — `--font-scale`, scale classes, `html { font-size }`, `prefers-reduced-motion` | ~30 |
| `src/layouts/MainLayout.astro` | Modify — inline bootstrap, skip-to-content, `id="main-content"` | ~15 |
| `src/layouts/WorkspaceLayout.astro` | Modify — inline bootstrap (after workspace bootstrap), skip-to-content, `id="main-content"` | ~15 |
| `src/stores/fontScale.ts` | Create — `$fontScale` persistentJSON store | ~35 |
| `src/components/brand/FontSizeControl.astro` | Create — toggle UI | ~50 |
| `src/pages/*.astro` (5 pages) | Modify — `id="main-content"` on `<main>` | ~5 |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Verse anchor `scroll-margin-top` breaks | Low | `--header-h` is `rem`-based — scales proportionally. Correct behavior. |
| Overflow at 1.6x on narrow screens | Low | Test at 320px; add `overflow-x-auto` guards where needed |
| Two inline scripts conflict | Low | Font scale only touches `<html>` classList; runs after workspace bootstrap |
| Corrupted localStorage | Low | try/catch wrapper (same as workspace bootstrap) |

## Rollback Plan

1. Remove `--font-scale` rules and `html { font-size }` from `global.css`
2. Remove inline bootstrap snippets from both layouts
3. Delete `src/stores/fontScale.ts` and `src/components/brand/FontSizeControl.astro`
4. Revert `prefers-reduced-motion`, skip-to-content links, `id="main-content"`
5. Run `pnpm verify` — must pass

## Dependencies

None. Self-contained — no schema changes, no API, no prerequisite PRs.

## Success Criteria

- [ ] Font scales at all 3 levels without breakage at 320px–1920px
- [ ] Preference persists across navigation and browser restart
- [ ] No FOUC — text at correct size on first paint
- [ ] Skip-to-content works on all pages (Tab → visible → Enter → `<main>`)
- [ ] `prefers-reduced-motion` disables all animations
- [ ] `pnpm verify` passes
- [ ] `pnpm build` succeeds with SSG constraints

## Delivery Strategy

**auto-chain | stacked-to-main** — 2 slices (under 150 lines total):

1. **Slice 1: CSS infra + bootstrap** (~60 lines): `global.css` rules, inline bootstrap in both layouts, `$fontScale` store
2. **Slice 2: FontSizeControl + a11y wins** (~90 lines): FontSizeControl.astro, skip-to-content links, `id="main-content"`, `prefers-reduced-motion`
