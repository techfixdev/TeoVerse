# Design: Responsive A11y Font

## Technical Approach

Mirrors the workspace bootstrap pattern (CSS custom properties + inline script + nanostores).
Font scale controlled via `--font-scale` on `:root`, scaled levels applied as `<html>` classes.
Inline script reads localStorage pre-paint, eliminating FOUC. `$fontScale` persistentJSON store
feeds the FontSizeControl island. A11y quick wins (skip-to-content, reduced-motion) are CSS-only.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|----------|---------|--------|-----------|
| Font scaling mechanism | `clamp()` fluid | `--font-scale` × `html { font-size }` | Scales ALL `rem` units uniformly, SSG-compatible, zero JS for actual scaling |
| Bootstrap injection method | Island hydration | `<script is:inline set:html={...}>` | Must run before paint; follows existing workspace bootstrap pattern exactly |
| Bootstrap integration | Merge into workspace bootstrap | Separate `<script>` tag, runs AFTER | Keeps concerns isolated; font bootstrap only touches `<html>` classList |
| Store key | `rv:font-scale` | Chosen | Matches existing `rv:last-selection` namespace convention |
| FontSizeControl location | Page-level component | Layout header alongside BrandLogo | Visible on every page without per-page imports; follows header nav pattern |
| Scale levels | 1.15 / 1.35 / 1.6 | Chosen from proposal | 15% increments provide meaningful steps for aging eyes without breaking layout at 320px |

## Data Flow

```
localStorage['rv:font-scale']
        │
        ▼
[fontBootstrap inline script] ──► <html class="font-scale-{level}">
        │                              │
        ▼                              ▼
 $fontScale (nanostore)          CSS: --font-scale applied
        │                              │
        ▼                              ▼
 FontSizeControl.astro           All rem units scale uniformly
 (reads/writes store on click)
```

## CSS Custom Properties Design

Added to `global.css` `@layer base`, after existing `:root` block:

```css
:root { --font-scale: 1; }

.font-scale-sm  { --font-scale: 1.15; }
.font-scale-md  { --font-scale: 1.35; }
.font-scale-lg  { --font-scale: 1.6;  }

html { font-size: calc(100% * var(--font-scale)); }
```

`calc(100% * var(--font-scale))` multiplies browser default (16px) by scale factor.
All elements using `rem` inherit proportionally — no per-element changes needed.

`prefers-reduced-motion` uses the standard "almost zero" pattern (0.01ms) to keep
`animationend` events firing while visually disabling motion.

## Inline Bootstrap Script

New file: `src/components/brand/fontBootstrap.ts`. Same pattern as
`src/components/workspace/bootstrap.ts`: exports a string injected via
`<script is:inline set:html={fontBootstrapScript} />`.

Script logic: read `localStorage['rv:font-scale']`, parse JSON, apply
`font-scale-{key}` class to `document.documentElement.classList`.
Wrapped in try/catch. No external dependencies.

## Layout Changes

**MainLayout.astro** — 3 additions in `<head>`:
1. Skip-to-content link (hidden until focused): `<a href="#main-content" class="sr-only focus:not-sr-only ...">Saltar al contenido</a>`
2. `<script is:inline set:html={fontBootstrapScript} />` after viewport meta
3. `<FontSizeControl />` in header bar alongside BrandLogo

**WorkspaceLayout.astro** — same 3 additions, plus:
4. `id="main-content"` on existing `<main class="module-lectura min-w-0">`
5. Font bootstrap runs AFTER workspace bootstrap (separate `<script>` tag, order preserved)

## Page Changes

Each page using MainLayout gets `id="main-content"` on its `<main>`:
- `index.astro`, `buscar.astro`, `atribuciones.astro`, `biblia/index.astro`
- `[capitulo].astro` uses WorkspaceLayout (layout already handles `id`)

## Accessibility Additions

| Addition | Implementation | Location |
|----------|---------------|----------|
| Skip-to-content | `<a href="#main-content">` with `sr-only focus:not-sr-only` | Both layouts, before header |
| `prefers-reduced-motion` | Media query disables all transitions/animations | `global.css` |
| Focus indicators | Existing `focus-visible:ring-2 ring-brand-cianDark` — unchanged | Already in place |
| FontSizeControl ARIA | `role="group" aria-label="Control de tamaño de texto"` | Component |

## File Changes

| File | Action | Lines |
|------|--------|-------|
| `src/styles/global.css` | Modify | +25 |
| `src/components/brand/fontBootstrap.ts` | Create | +30 |
| `src/components/brand/FontSizeControl.astro` | Create | +45 |
| `src/stores/fontScale.ts` | Create | +20 |
| `src/layouts/MainLayout.astro` | Modify | +10 |
| `src/layouts/WorkspaceLayout.astro` | Modify | +12 |
| `src/pages/index.astro` | Modify | +1 |
| `src/pages/buscar.astro` | Modify | +1 |
| `src/pages/atribuciones.astro` | Modify | +1 |
| `src/pages/biblia/index.astro` | Modify | +1 |

**Total**: ~146 lines. Well within 400-line PR budget. No new dependencies.

## Testing Strategy

Manual verification against proposal success criteria — no unit/integration test infra exists.
1. Visual: 3 scale levels at 320px/768px/1920px — no overflow, no broken layout
2. Persistence: toggle scale → navigate → refresh → scale preserved, no FOUC
3. Keyboard: Tab → skip link visible → Enter → focus lands on `<main>`
4. Reduced motion: enable OS setting → all transitions disabled
5. Build: `pnpm verify` and `pnpm build` pass

## Open Questions

None — design follows established patterns, no blocking unknowns.
