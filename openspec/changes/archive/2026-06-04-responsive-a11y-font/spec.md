# Delta Spec: responsive-a11y-font

## font-scaling

| ID | Requirement | Strength |
|----|-------------|----------|
| FS-01 | Font size MUST scale via `--font-scale` (1.0, 1.15, 1.35, 1.6) applied to `html { font-size }` | MUST |
| FS-02 | Scale preference MUST persist in `localStorage['rv:font-scale']` across navigation and restarts | MUST |
| FS-03 | Inline bootstrap MUST apply stored scale class to `<html>` before first paint — no FOUC | MUST |
| FS-04 | `$fontScale` nanostore (persistentJSON) MUST sync with localStorage | MUST |
| FS-05 | FontSizeControl.astro MUST provide +/–/reset with `role="group"`, `aria-label="Control de tamaño de texto"` | MUST |
| FS-06 | Layout MUST not break at any scale on 320px–1920px | MUST |
| FS-07 | Corrupted localStorage MUST silently default to 1.0 (try/catch) | MUST |

### Scenarios

**User increases font size**: GIVEN default scale → WHEN pressing "+" → THEN text scales, `<html>` class and localStorage update.

**Preference persists**: GIVEN `font-scale-lg` was set → WHEN revisiting after close → THEN renders 1.6x on first paint.

**Corrupted localStorage**: GIVEN invalid JSON → WHEN bootstrap parses → THEN try/catch catches, defaults to 1.0.

**Two bootstrap scripts**: GIVEN workspace + font-scale inline in `<head>` → WHEN page loads → THEN workspace first, font-scale second, no errors.

## skip-to-content

| ID | Requirement | Strength |
|----|-------------|----------|
| SC-01 | Every page MUST have skip-to-content link as first focusable element | MUST |
| SC-02 | Link MUST be `sr-only` until focused, then visible top-left with ≥3:1 contrast | MUST |
| SC-03 | Target MUST be `id="main-content"` on `<main>` | MUST |

### Scenarios

**Keyboard skip**: GIVEN any page → WHEN Tab pressed → THEN link appears, Enter moves focus to `<main id="main-content">`.

**Screen reader**: GIVEN screen reader loads page → WHEN structure announced → THEN "Saltar al contenido" is first landmark option.

## reduced-motion

| ID | Requirement | Strength |
|----|-------------|----------|
| RM-01 | All transitions/animations MUST disable when `prefers-reduced-motion: reduce` | MUST |
| RM-02 | Media query MUST apply globally in `global.css` | MUST |

### Scenario

**System preference active**: GIVEN OS reduced motion → WHEN page loads → THEN `transition-duration` and `animation-duration` forced to 0.01ms.

## Non-Functional Requirements

| ID | Category | Requirement | Strength |
|----|----------|-------------|----------|
| NF-01 | Perf | Bootstrap script MUST execute < 5ms | MUST |
| NF-02 | Size | CSS SHOULD add < 500 bytes | SHOULD |
| NF-03 | A11y | FontSizeControl touch targets MUST be ≥44px (WCAG AA) | MUST |
| NF-04 | A11y | Skip link focus ring MUST meet WCAG 2.4.11 contrast | MUST |
| NF-05 | Build | `pnpm verify` MUST exit 0 | MUST |
| NF-06 | Build | `pnpm build` MUST succeed with `output: 'static'` | MUST |

## Edge Cases

| Case | Resolution |
|------|------------|
| localStorage disabled | `$fontScale` returns `'default'`; degrades gracefully |
| First visit (empty key) | No class → default 1.0 |
| Spam click toggle | Last value wins (nanostore overwrite) |
| `scroll-margin-top` at max scale | `--header-h` rem-based → scales correctly |
| Two inline `<head>` scripts | Font-scale only touches classList; after workspace bootstrap |

## Build Verification Gates

| Gate | Check |
|------|-------|
| G1 | `:root { --font-scale: 1 }` and scale classes in `global.css` |
| G2 | `html { font-size: calc(100% * var(--font-scale)) }` in `global.css` |
| G3 | Inline bootstrap in both layouts reads `rv:font-scale` with try/catch |
| G4 | `<a href="#main-content">` skip link in both layouts |
| G5 | `id="main-content"` on all `<main>` across pages |
| G6 | `@media (prefers-reduced-motion: reduce)` in `global.css` |
| G7 | `src/stores/fontScale.ts` with `persistentJSON` (key `rv:font-scale`) |
| G8 | `src/components/brand/FontSizeControl.astro` with `role="group"` + `aria-label` |
| G9 | `pnpm build` exits 0 |
| G10 | `pnpm verify` exits 0 |
