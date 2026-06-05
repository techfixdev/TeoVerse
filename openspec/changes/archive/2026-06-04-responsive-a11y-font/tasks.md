# Tasks: Responsive A11y Font

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~146 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR (proposal pre-established 2 slices for auto-chain; both under budget) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | CSS infra + bootstrap + store | Slice 1 | ~60 lines; standalone: scale works via inline script only, no UI |
| 2 | FontSizeControl + a11y wins | Slice 2 | ~86 lines; depends on Slice 1 store + CSS |

## Phase 1: CSS Infrastructure

- [x] 1.1 `src/styles/global.css` — add `:root { --font-scale: 1 }`, `.font-scale-sm/md/lg { --font-scale: … }` classes, and `html { font-size: calc(100% * var(--font-scale)) }` rule inside `@layer base`
- [x] 1.2 `src/styles/global.css` — add `@media (prefers-reduced-motion: reduce) { *, ::before, ::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important } }`

## Phase 2: Bootstrap & Store

- [x] 2.1 Create `src/stores/fontScale.ts` — `$fontScale` persistentJSON store (key `rv:font-scale`, values `'default'|'sm'|'md'|'lg'`)
- [x] 2.2 Create `src/components/brand/fontBootstrap.ts` — inline script string: reads `localStorage['rv:font-scale']`, applies `font-scale-{key}` class to `<html>`, wrapped in try/catch
- [x] 2.3 `src/layouts/MainLayout.astro` — add `<script is:inline set:html={fontBootstrapScript} />` in `<head>` after viewport meta
- [x] 2.4 `src/layouts/WorkspaceLayout.astro` — add same bootstrap script in `<head>`, placed AFTER the existing workspace bootstrap `<script>`

## Phase 3: FontSizeControl Component

- [x] 3.1 Create `src/components/brand/FontSizeControl.astro` — +/–/reset buttons, `role="group"`, `aria-label="Control de tamaño de texto"`, reads/writes `$fontScale` store on click, touch targets ≥44px
- [x] 3.2 `src/layouts/MainLayout.astro` — import and place `<FontSizeControl />` in header bar alongside BrandLogo
- [x] 3.3 `src/layouts/WorkspaceLayout.astro` — import and place `<FontSizeControl />` in header bar alongside BrandLogo

## Phase 4: A11y Quick Wins

- [x] 4.1 `src/layouts/MainLayout.astro` — add skip-to-content link as first child of `<body>`: `<a href="#main-content" class="absolute -top-full …">Saltar al contenido</a>`
- [x] 4.2 `src/layouts/WorkspaceLayout.astro` — add same skip-to-content link as first child of `<body>`
- [x] 4.3 `src/layouts/WorkspaceLayout.astro` — add `id="main-content"` to existing `<main class="module-lectura min-w-0">`
- [x] 4.4 Add `id="main-content"` to `<main>` in: `src/pages/index.astro`, `buscar.astro`, `atribuciones.astro`, `biblia/index.astro`

## Phase 5: Verification

- [x] 5.1 Visual: test all 3 scales at 320px, 768px, 1920px — no layout breakage or overflow
- [x] 5.2 Persistence: toggle scale → navigate pages → browser refresh → scale preserved, no FOUC
- [x] 5.3 Keyboard a11y: Tab → skip link visible → Enter → focus lands on `<main id="main-content">`
- [x] 5.4 Reduced motion: enable OS setting → verify transitions/animations disabled
- [x] 5.5 Build gate: `pnpm verify` exits 0, `pnpm build` succeeds with `output: 'static'`
