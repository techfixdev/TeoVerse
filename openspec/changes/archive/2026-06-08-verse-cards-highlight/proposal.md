# Proposal: Interactive Verse Cards with Highlight & Strong Differentiation

## Intent

Transform the Bible reading experience from flat list items into interactive, touch-friendly verse cards with marker-like highlighting. Users tap verses to "paint" them with a chosen color (like using a highlighter on a paper Bible), with persistent multi-select and visual differentiation for verses containing Strong concordance data.

## Scope

### In Scope
- Verse card styling — each verse as a visually distinct card with brand-consistent borders
- Marker-paint CSS animation — horizontal sweep effect on highlight toggle
- Persistent multi-select — tap to highlight, tap again to remove; survives page reloads
- Color picker — user-selectable marker colors (5-6 palette)
- Strong differentiation — distinct visual treatment for verses with Strong tokens
- Normal → card mode transition — flat text on first load, card mode after first interaction
- Touch-friendly — works via tap on mobile/tablet

### Out of Scope
- Changing the reading layout or grid structure
- Adding new Bible versions or modifying Strong data
- Note-taking, bookmarks, or sharing highlights
- Cross-device sync of highlights
- Complex paint effects (canvas/SVG overlays)

## Capabilities

### New Capabilities
- `verse-highlight`: Verse card styling, marker-paint animation, persistent multi-select with color picker, and Strong-differentiated visual treatment

### Modified Capabilities
None — this is a new capability that layers on top of existing verse rendering without changing spec-level behavior.

## Approach

**Hybrid: Server-rendered cards + CSS animations + bootstrap script**

1. **Server**: Enhanced `<li>` markup with `data-verso`, `data-has-strong` attributes and `verso-card` / `verso-card--has-strong` classes. Build-time Strong detection via `run.tokens`.
2. **CSS**: `@keyframes` marker-paint animation on `::before` pseudo-element (horizontal sweep `scaleX(0→1)`). Card mode activated by `verso-modo-activo` class on `<html>`. Highlight colors as CSS custom properties.
3. **State**: New `$highlight` nanostore (`persistentJSON`) — `Record<verseKey, colorId>`. Bootstrap inline script reads localStorage pre-paint to prevent FOUC.
4. **Events**: New `HighlightClickProxy` — delegated click listener on `main.module-lectura` (coexists with Strong/TSK proxies via `.closest()` targeting).
5. **Color picker**: Small island component in workspace header or floating toolbar.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/pages/biblia/[version]/[libro]/[capitulo].astro` | Modified | Verse `<li>` gains card structure, data attributes |
| `src/styles/global.css` | Modified | Card styles, `@keyframes`, highlight colors, Strong differentiation |
| `tailwind.config.mjs` | Modified | Highlight color palette tokens |
| `src/stores/` | New | `$highlight` persistent store |
| `src/components/workspace/` | New | `HighlightClickProxy.astro`, `HighlightBootstrap.ts` |
| `src/components/modules/` | New | `ColorPicker.astro` island |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Multi-verse runs (El Mensaje) complicate per-verse selection | High | Selection targets the entire `<li>` run, not individual verse anchors |
| localStorage size from accumulated highlights | Medium | Per-chapter key partitioning + size cap with LRU eviction |
| Strong differentiation invisible for non-spapddpt versions | Certain | Graceful degradation — no indicator, not a broken one |
| Click proxy conflicts with Strong/TSK proxies | Medium | Non-overlapping `.closest()` selectors; highlight targets `verso-card`, Strong targets `[data-strong]` |
| Paint animation jank on low-end devices | Low | GPU-composited CSS transforms; `prefers-reduced-motion` respected |

## Rollback Plan

Feature-flag via CSS class on `<html>`. Removing the bootstrap script and proxy component reverts to flat list rendering. All changes are additive — no existing markup is removed, only classes and data attributes added. CSS card styles scope to `.verso-card` and activate only when `verso-modo-activo` is present.

## Dependencies

None external. Uses existing nanostores, Tailwind, and Astro patterns.

## Success Criteria

- [ ] Verses render as distinct cards with brand-consistent styling after first interaction
- [ ] Tap/click toggles highlight with marker-paint animation (< 300ms)
- [ ] Highlights persist across page reloads and navigation
- [ ] User can select from 5+ marker colors
- [ ] Verses with Strong tokens show distinct visual treatment (not highlight color)
- [ ] Works on mobile/tablet via tap (no hover-dependent interactions)
- [ ] `pnpm verify` passes with no regressions
- [ ] `prefers-reduced-motion` disables paint animation
