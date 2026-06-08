# Tasks: Interactive Verse Cards with Highlight & Strong Differentiation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~550-600 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Foundation) → PR 2 (Interaction) → PR 3 (Polish) |
| Delivery strategy | force-chained |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Store + CSS tokens + verse markup | PR 1 | base = feature/verse-cards-highlight; types + palette + data attrs |
| 2 | Click proxy + bootstrap + animation | PR 2 | base = PR 1 branch; interaction + persistence + paint effect |
| 3 | Color picker + Strong pattern + card mode | PR 3 | base = PR 2 branch; UX polish + visual differentiation |

## Phase 1: Foundation (PR 1)

- [x] 1.1 Create `src/stores/highlight.ts` with `ColorId` type, `COLORS` array, `HighlightMap` type, `$highlight` persistentJSON store (key `rv:highlights`), `$colorActivo` persistentJSON store (key `rv:active-color`, default `"amarillo"`)
- [x] 1.2 Add highlight color palette to `tailwind.config.mjs` under `theme.extend.colors.highlight` — 6 colors: amarillo, verde, rosa, azul, naranja, violeta
- [x] 1.3 Add CSS custom properties to `src/styles/global.css` in `:root` and `.dark` blocks — `--hl-amarillo` through `--hl-violeta` with light/dark values from design Decision 3
- [x] 1.4 Modify `src/pages/biblia/[version]/[libro]/[capitulo].astro` verse `<li>` markup — add `verso-card` class, `data-verso="{libro}:{capitulo}:{verso}"` attribute, `data-has-strong="{run.tokens?.some(t => t.codigoStrong !== null)}"` attribute
- [x] 1.5 Add base `.verso-card` styles to `global.css` — `position: relative`, `z-index: 0`, `border-radius: var(--radius-brand)`, inactive by default (no padding/border/shadow until card mode)
- [x] 1.6 Write verify script `scripts/verify-pr1-foundation.ts` — assert store exports exist, tailwind config has highlight colors, CSS vars defined, verse markup has data attributes; run via `pnpm verify`

## Phase 2: Core Interaction (PR 2)

- [x] 2.1 Create `src/components/workspace/highlightBootstrap.ts` — export `highlightBootstrapScript` string that reads `rv:card-mode` (applies `verso-modo-activo` to `<html>`) and `rv:highlights` (filters current chapter prefix, applies `verso-resaltado--{colorId}` classes pre-paint)
- [x] 2.2 Create `src/components/workspace/HighlightClickProxy.astro` — delegated click listener on `main.module-lectura`, bails on `[data-strong]`/`[data-tsk-refs]`, matches `.verso-card`, reads `data-verso` key, toggles `$highlight` store entry with `$colorActivo` value, adds/removes `verso-resaltado--{colorId}` class
- [x] 2.3 Add `@keyframes marker-paint` to `global.css` — `from { transform: scaleX(0); }` to `{ transform: scaleX(1); }`, 0.3s ease-out, forwards
- [x] 2.4 Add `.verso-card::before` pseudo-element styles to `global.css` — `content: ''`, `position: absolute`, `inset: 0`, `z-index: -1`, `border-radius: inherit`, `transform-origin: left`, `transform: scaleX(0)`, `background-color: var(--hl-active)`, `opacity: 0.5`
- [x] 2.5 Add `.verso-resaltado::before` animation trigger — `animation: marker-paint 0.3s ease-out forwards`
- [x] 2.6 Add `.verso-resaltado--{colorId}` classes (6 total) to `global.css` — each sets `--hl-active: var(--hl-{colorId})`
- [x] 2.7 Add active card styles scoped under `html.verso-modo-activo .verso-card` — padding, border (2px solid cian), box-shadow, background
- [x] 2.8 Modify `src/layouts/WorkspaceLayout.astro` — mount `<HighlightClickProxy />` component and inject `highlightBootstrapScript` as inline `<script>` in `<head>`
- [x] 2.9 Write verify script `scripts/verify-pr2-interaction.ts` — assert bootstrap script exists, proxy component exports, keyframes defined, click toggles highlight class, persistence survives reload; run via `pnpm verify`

## Phase 3: Polish (PR 3)

- [x] 3.1 Create `src/components/brand/ColorPicker.astro` — Astro island with inline script, inline-flex row of 6 color circles (24px), active color has `ring-2 ring-offset-1`, reads/writes `$colorActivo` store on click, hidden when `verso-modo-activo` not set
- [x] 3.2 Add `.verso-card--has-strong` styles to `global.css` — `background-image: repeating-linear-gradient(45deg, transparent, transparent 4px, color-mix(in srgb, var(--brand-cian) 6%, transparent) 4px, color-mix(in srgb, var(--brand-cian) 6%, transparent) 8px)`
- [x] 3.3 Modify `src/pages/biblia/[version]/[libro]/[capitulo].astro` — add `verso-card--has-strong` class via `class:list` when `run.tokens?.some(t => t.codigoStrong !== null)` is true
- [x] 3.4 Update `HighlightClickProxy.astro` — on first verse tap, set `localStorage['rv:card-mode'] = '"activo"'` and add `verso-modo-activo` class to `<html>`
- [x] 3.5 Modify `src/layouts/WorkspaceLayout.astro` — mount `<ColorPicker />` in header after `<FontSizeControl />`
- [x] 3.6 Write verify script `scripts/verify-pr3-polish.ts` — assert ColorPicker island exists, Strong pattern visible on verses with `data-has-strong="true"`, card mode persists after first interaction, color selection updates active swatch; run via `pnpm verify`

## Implementation Order

**PR 1 (Foundation)** establishes the data layer and visual tokens — store, palette, markup. No interaction yet, just structure.

**PR 2 (Interaction)** adds the core UX — tap to highlight, animation, persistence. Depends on PR 1's store and markup.

**PR 3 (Polish)** adds the color picker, Strong differentiation, and card mode activation. Depends on PR 2's interaction layer.

Each PR is independently verifiable and under 400 lines. The feature-branch-chain strategy keeps each PR diff focused on its slice.

## Status: ALL 21 TASKS COMPLETE
