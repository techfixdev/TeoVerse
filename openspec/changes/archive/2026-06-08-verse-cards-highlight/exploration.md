## Exploration: Interactive Verse Cards with Highlight & Strong Differentiation

### Current State

**Verse rendering** (`src/pages/biblia/[version]/[libro]/[capitulo].astro`):
- Verses render inside an `<ol class="mt-6 space-y-5 font-reading text-lg leading-8">` as `<li>` elements with `grid grid-cols-[auto_1fr] gap-3` (verse number left, text right).
- Two rendering paths per verse:
  1. **Tokenized** (only `spapddpt` version has Strong data): words with `codigoStrong` render as `<button class="palabra-strong" data-strong="..." data-palabra="...">`; untagged words as plain `<span>`.
  2. **Plain text** (other versions, or multi-verse runs): raw `run.text` string.
- Multi-verse runs (consecutive identical text, common in El Mensaje) collapse into one `<li>` with hidden `<span id="v{n}">` anchors.
- TSK markers: `<button class="tsk-marker" data-tsk-refs="...">` appended after verse text.
- No per-verse card styling — verses are flat list items with no border, background, or padding beyond the grid gap.

**State management** (4 nanostores in `src/stores/`):
- `$selector` — persisted last Bible selection via `persistentJSON` (localStorage key `rv:last-selection`)
- `$workspace` — persisted workspace module state via `persistentJSON` (key `teoverse.workspace.v1`)
- `$fontScale` — persisted font-size preference via `persistentJSON` (key `rv:font-scale`)
- `$referencia`, `$senalStrong`, `$senalTsk` — non-persisted atoms for runtime signals
- **Pattern**: `persistentJSON` from `@nanostores/persistent` for localStorage. Bootstrap inline scripts read localStorage directly before first paint to prevent FOUC.

**Brand tokens** (`tailwind.config.mjs` + `src/styles/global.css`):
- Colors: cian `#19ADD3`, cianDark `#0E7FA3` (AA text), cianClaro `#81D8EB`, gris `#767676` (AA text), grisSuave `#B7B7B7`, base `#FFFFFF`, text `#4A4A4A`
- Fonts: `reading` (Georgia serif — verse body), `brand` (Inter — UI chrome), `script` (Caveat — tagline only)
- Border radius: `brand` = 1.25rem
- Dark mode: class-based, cian-tinted (`--brand-base: #0E1A1F`, `--brand-text: #E6F4F8`)

**Animations**: Only CSS transitions (0.15s ease) on hover/focus states. No `@keyframes` defined. No JS animation libraries. Reduced-motion support via `@media (prefers-reduced-motion: reduce)` sets durations to 0.01ms.

**Strong integration**:
- `ChapterToken = { versiculo, posicion, palabra, codigoStrong: string | null }`
- `listTokensForChapter()` returns all tokens; page groups them by verse number into `tokensByVerse: Map<number, ChapterToken[]>`
- A verse has Strong data when `run.tokens?.length > 0` AND at least one token has `codigoStrong !== null`
- Only `spapddpt` version currently seeds Strong tokens
- Event delegation: `StrongClickProxy` listens on `main.module-lectura` for `[data-strong]` clicks

**Touch/mobile**: No explicit touch handlers. Relies on browser tap→click translation. Mobile-first responsive with `lg:` (1024px) breakpoint. Workspace panels: fixed bottom sheet on mobile, sticky aside on desktop.

**Event delegation pattern**: Both `StrongClickProxy` and `TskClickProxy` use a single delegated click listener on `main.module-lectura`, matching via `.closest('[data-strong]')` / `.closest('[data-tsk-refs]')`. Mutual exclusion: clicking Strong nulls TSK signal and vice versa.

### Affected Areas

- `src/pages/biblia/[version]/[libro]/[capitulo].astro` — verse `<li>` markup must gain card structure, data attributes for Strong presence, and click-target wiring
- `src/styles/global.css` — new CSS for verse cards, highlight animation (`@keyframes`), color swatches, Strong-differentiated styling, card-mode transitions
- `tailwind.config.mjs` — new highlight color palette tokens (user-selectable marker colors)
- `src/stores/` — new `$highlight` store (persistentJSON) for selected verses + colors
- `src/components/workspace/` — new `HighlightClickProxy.astro` (event delegation for verse tap) and possibly `HighlightBootstrap.ts` (pre-paint class application)
- `src/components/modules/` — new `ColorPicker.astro` island for marker color selection
- `src/layouts/WorkspaceLayout.astro` — may need to mount new islands and bootstrap script

### Approaches

1. **CSS-First Cards + Lightweight Proxy Script** — Server renders verse `<li>` with data attributes (`data-verso`, `data-has-strong`). A new proxy component (following `StrongClickProxy` pattern) handles tap-to-toggle via event delegation on `main.module-lectura`. A new `$highlight` persistentJSON store tracks `Map<verseKey, colorId>`. CSS `@keyframes` drives the "marker paint" animation on class addition. Color picker is a small island in the workspace header or a floating toolbar.

   - Pros: Follows existing patterns exactly (proxy + store + CSS). Minimal JS. SSR-safe. No new dependencies. Bootstrap script prevents FOUC for persistent highlights.
   - Cons: CSS-only animation limits the "painting" effect complexity. Color picker needs careful mobile UX.
   - Effort: Medium

2. **Full Client Island Wrapper** — Wrap the entire verse list in a `client:load` Astro island that manages all interactivity internally. Uses nanostores for state, JS-driven animations, and a built-in color picker component.

   - Pros: Full control over rendering and animation. Can do complex paint effects (canvas, SVG overlay). Self-contained.
   - Cons: Breaks the existing SSR pattern — verses would hydrate client-side, losing the zero-JS reading experience. Much larger JS bundle. Diverges from the established proxy+CSS architecture. FOUC risk.
   - Effort: High

3. **Hybrid: Server Cards + CSS Animations + Minimal JS Orchestrator** — Server renders enhanced `<li>` cards with structural classes (`verso-card`, `verso-card--strong`). A single orchestrator script (similar to `bootstrap.ts`) handles: (a) reading persisted highlights from localStorage pre-paint, (b) delegated click/tap for toggle, (c) color picker state. CSS handles all visual states and the marker animation via `@keyframes` + `animation` on a pseudo-element. Strong differentiation is a build-time class (`verso-card--has-strong`).

   - Pros: Best of both worlds — SSR-first with progressive enhancement. Follows bootstrap pattern for zero-FOUC. CSS animations are GPU-accelerated and respect `prefers-reduced-motion`. Build-time Strong detection (already available via `run.tokens`). Single script, minimal surface area.
   - Cons: Requires careful CSS architecture for the paint animation (pseudo-element sweep). Color picker UX needs design thought.
   - Effort: Medium

### Recommendation

**Approach 3 (Hybrid)** is the strongest fit for TeoVerse's architecture. Reasons:

1. **Pattern alignment**: The codebase already uses bootstrap scripts + CSS classes + event delegation proxies. This approach extends that pattern naturally.
2. **SSR-first**: Verses render server-side with full content — no hydration delay. The reading experience works without JS.
3. **Strong differentiation at build time**: `run.tokens` already tells us if a verse has Strong tokens. We can emit `data-has-strong` and `verso-card--has-strong` at build time — zero runtime cost.
4. **Performance**: CSS `@keyframes` for the marker-paint animation is GPU-composited. No JS animation loop. Respects `prefers-reduced-motion` automatically.
5. **Persistence**: Follows the `$fontScale` / `$workspace` pattern — `persistentJSON` store + bootstrap script that reads localStorage pre-paint.

**Key design decisions for the proposal phase**:
- Highlight store shape: `Record<verseKey, colorId>` where `verseKey = "{version}:{libro}:{capitulo}:{verso}"` and `colorId` is a string from a fixed palette
- Color palette: 5-6 marker colors (yellow, green, pink, blue, orange, purple) defined as CSS custom properties + Tailwind tokens
- Paint animation: `@keyframes` on `::before` pseudo-element — a horizontal sweep from `scaleX(0)` to `scaleX(1)` with `transform-origin: left`, using `background-color` with opacity
- Card mode activation: First interaction adds `verso-modo-activo` class to `<html>` (persisted in localStorage), switching verses from flat text to card layout with blue gradient border
- Strong differentiation: `verso-card--has-strong` gets a distinct left-border color or subtle background pattern (NOT the same as highlight — visually distinct treatment)
- Touch: Tap = toggle (click event works on touch). No long-press or swipe needed. Color picker accessible via a floating action button or workspace header control

### Risks

- **Multi-verse runs**: Collapsed verse runs (e.g., El Mensaje paragraphs spanning 5+ verses) complicate per-verse selection. The `<li>` represents multiple verses — selection should target the entire run, not individual verses within it.
- **Highlight persistence size**: A user who highlights many chapters across 4 Bible versions could accumulate significant localStorage data. Consider per-chapter keys or a size cap.
- **Strong token availability**: Only `spapddpt` has Strong tokens. The "Strong differentiation" feature is invisible for other versions — needs graceful degradation (no indicator, not a broken one).
- **Color picker mobile UX**: A color picker in a Bible reading context must be dead-simple. A floating toolbar that appears on first selection is likely the best pattern, but needs design validation.
- **Animation performance on low-end devices**: The paint sweep animation on many verses simultaneously could cause jank on older tablets. Should limit concurrent animations.
- **Interaction with existing click handlers**: The Strong click proxy and TSK click proxy both listen on `main.module-lectura`. The new highlight proxy must coexist — verse tap should NOT interfere with word-level Strong clicks or TSK marker clicks. Event propagation order matters.

### Ready for Proposal

**Yes** — the exploration provides sufficient architectural understanding for a proposal. The orchestrator should tell the user:

- The feature is architecturally feasible within the existing patterns (no new frameworks, no breaking changes).
- The main design fork is the color picker UX (floating toolbar vs. workspace header vs. long-press menu) — this should be decided during the proposal/spec phase.
- Multi-verse runs and Strong-only-in-spapddpt are known constraints that the spec should address explicitly.
- Estimated scope: ~4-6 implementation tasks (store, bootstrap, CSS, proxy, color picker, Strong differentiation).
