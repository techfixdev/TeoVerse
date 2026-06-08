# Design: Interactive Verse Cards with Highlight & Strong Differentiation

## Technical Approach

Hybrid SSR-first approach extending existing patterns: server-rendered `<li>` verses gain card structure classes and data attributes at build time. A new `HighlightClickProxy` (following `StrongClickProxy` delegation pattern) handles tap-to-toggle. CSS `@keyframes` drives the marker-paint animation on `::before`. A `$highlight` persistentJSON store tracks `Record<verseKey, colorId>`. An inline bootstrap script reads localStorage pre-paint to prevent FOUC. Card mode activates on first interaction via `verso-modo-activo` class on `<html>`.

Maps to proposal approach: **Hybrid: Server-rendered cards + CSS animations + bootstrap script**. All 8 design decisions below implement capabilities defined in the `verse-highlight` spec.

## Architecture Decisions

### Decision 1: Verse Key Format (Universal Highlights)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `{version}:{libro}:{cap}:{verso}` | Per-version isolation, 4× storage | ❌ |
| `{libro}:{cap}:{verso}` | Universal, minimal key, ~20 chars | ✅ |
| Numeric ID from DB | Coupled to schema, not portable | ❌ |

**Choice**: `versoKey = "{libro}:{capitulo}:{verso}"` (e.g., `genesis:1:1`). No version prefix — highlighting Gen 1:1 in spapddpt highlights it in all versions. Multi-verse runs use `startVerse` as the key; the entire `<li>` run toggles as one unit.

### Decision 2: Store Schema

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Single blob `rv:highlights` | Simple, one read; grows with usage | ✅ |
| Per-chapter keys `rv:hl:{libro}:{cap}` | Many keys, complex management | ❌ |

**Choice**: Single `persistentJSON` store `$highlight` with key `rv:highlights`.

```typescript
type HighlightMap = Record<string, string>; // verseKey → colorId
// e.g., { "genesis:1:1": "amarillo", "genesis:1:3": "verde" }
```

Bootstrap script reads the full blob, filters entries matching current `{libro}:{capitulo}:*` prefix, applies `verso-resaltado--{colorId}` classes pre-paint. At ~30 bytes per entry, 1000 highlights = ~30KB — well within localStorage's 5MB.

Additional store: `$colorActivo` (persistentJSON, key `rv:active-color`, default `"amarillo"`) — the currently selected marker color for the picker.

### Decision 3: Color Palette

6 marker colors as CSS custom properties, dual-mode (light/dark):

| ID | Light (`--hl-{id}`) | Dark (`--hl-{id}`) | Rationale |
|----|---------------------|---------------------|-----------|
| `amarillo` | `#FEF3C7` | `#78350F` | Classic highlighter |
| `verde` | `#D1FAE5` | `#064E3B` | Nature/growth |
| `rosa` | `#FCE7F3` | `#831843` | Warm accent |
| `azul` | `#DBEAFE` | `#1E3A5F` | Complements brand cian |
| `naranja` | `#FED7AA` | `#7C2D12` | Energy/emphasis |
| `violeta` | `#EDE9FE` | `#4C1D95` | Royalty/wisdom |

Light mode: soft pastels (text remains legible). Dark mode: deep tones (text remains legible). Defined in `:root` and `.dark` blocks in `global.css`. Tailwind tokens added under `theme.extend.colors.highlight`.

### Decision 4: Paint Animation CSS Architecture

```css
@keyframes marker-paint {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}

.verso-card::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  transform-origin: left;
  transform: scaleX(0);
  background-color: var(--hl-active);
  opacity: 0.5;
}

.verso-resaltado::before {
  animation: marker-paint 0.3s ease-out forwards;
}
```

- GPU-composited: only `transform` animates (no layout/paint triggers)
- `::before` is the paint layer; card content sits above via `position: relative; z-index: 0`
- `prefers-reduced-motion`: existing global rule sets `animation-duration: 0.01ms` — paint appears instantly
- Removal: class removal resets `scaleX(0)` via CSS transition (0.15s)

### Decision 5: Click Proxy Coexistence

| Proxy | Selector | Target |
|-------|----------|--------|
| StrongClickProxy | `[data-strong]` | Word buttons inside verse |
| TskClickProxy | `[data-tsk-refs]` | Superscript markers |
| **HighlightClickProxy** | `.verso-card` | The `<li>` itself |

**Conflict resolution**: HighlightClickProxy checks for Strong/TSK targets first and bails out:

```typescript
function handleClick(event: MouseEvent) {
  const el = event.target as HTMLElement;
  // Yield to Strong and TSK proxies — they handle their own targets
  if (el.closest('[data-strong]') || el.closest('[data-tsk-refs]')) return;
  const card = el.closest('.verso-card') as HTMLElement | null;
  if (!card) return;
  // Toggle highlight on the card
}
```

All three proxies register on `main.module-lectura` — same container, same event phase. The bail-out check ensures Strong/TSK clicks never trigger highlight toggling, even though the click bubbles through the `<li>`.

### Decision 6: Card Mode Activation

**Choice**: `verso-modo-activo` class on `<html>`, persisted in localStorage key `rv:card-mode`.

**Bootstrap**: New `highlightBootstrapScript` (following `fontBootstrapScript` pattern) reads `rv:card-mode` and applies `verso-modo-activo` class pre-paint. Also reads `rv:highlights`, filters current chapter entries, and applies `verso-resaltado--{colorId}` classes.

**Activation**: First verse tap in HighlightClickProxy sets `localStorage['rv:card-mode'] = '"activo"'` and adds `verso-modo-activo` to `<html>`. Persists permanently until user explicitly resets (future feature, out of scope).

**CSS scoping**: All card styles (padding, border, background, shadow) are scoped under `html.verso-modo-activo .verso-card`. Without the class, verses render as flat list items — zero visual change for users who never interact.

### Decision 7: Strong Background Pattern

**Choice**: CSS-only diagonal stripe pattern via `repeating-linear-gradient` on `.verso-card--has-strong`.

```css
html.verso-modo-activo .verso-card--has-strong {
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 4px,
    color-mix(in srgb, var(--brand-cian) 6%, transparent) 4px,
    color-mix(in srgb, var(--brand-cian) 6%, transparent) 8px
  );
}
```

- Light mode: 6% cian tint stripes — subtle, readable
- Dark mode: same gradient, `color-mix` adapts to dark `--brand-cian` value
- Clearly distinct from solid highlight colors (stripes vs. solid fill)
- No runtime cost — pure CSS, applied at build time via `data-has-strong` attribute
- When a Strong verse is also highlighted, the highlight `::before` layer renders on top of the stripe pattern (z-index layering)

### Decision 8: Color Picker Component

**Choice**: Fixed in WorkspaceLayout header, next to FontSizeControl. Astro island with `client:load`.

**Component**: `ColorPicker.astro` in `src/components/brand/` (alongside FontSizeControl — same header region).

**UI**: Inline-flex row of 6 color circles (24px diameter), active color has a 2px ring. Follows FontSizeControl's visual pattern (rounded border, bg-white/60, dark variant).

**Behavior**:
- Reads/writes `$colorActivo` store on click
- Highlights the active swatch with `ring-2 ring-offset-1`
- No tooltip/label needed — color is self-evident
- Hidden when `verso-modo-activo` is not set (appears after first interaction)

**Mounting**: Added to WorkspaceLayout header, after `<FontSizeControl />`.

## Data Flow

```
User taps verse
    │
    ▼
HighlightClickProxy (delegated click on main.module-lectura)
    │
    ├─ Is [data-strong] or [data-tsk-refs]? → bail (let other proxy handle)
    │
    ▼
.closest('.verso-card') → read data-verso key
    │
    ▼
$highlight store → toggle verseKey ↔ colorId (from $colorActivo)
    │
    ├─ persistentJSON → writes to localStorage['rv:highlights']
    │
    ▼
CSS class toggle: add/remove 'verso-resaltado--{colorId}'
    │
    ▼
::before pseudo-element → marker-paint animation (scaleX 0→1)

Page load (bootstrap):
    localStorage['rv:highlights'] → parse → filter current chapter
    → apply 'verso-resaltado--{colorId}' classes pre-paint
    localStorage['rv:card-mode'] → apply 'verso-modo-activo' pre-paint
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/stores/highlight.ts` | Create | `$highlight` persistentJSON store + `$colorActivo` store + types |
| `src/components/workspace/HighlightClickProxy.astro` | Create | Delegated click proxy for verse tap-to-highlight |
| `src/components/workspace/highlightBootstrap.ts` | Create | Inline bootstrap script string (card-mode + current chapter highlights) |
| `src/components/brand/ColorPicker.astro` | Create | Color swatch picker island (client:load) |
| `src/pages/biblia/[version]/[libro]/[capitulo].astro` | Modify | Add `verso-card` class, `data-verso`, `data-has-strong` attributes to `<li>` |
| `src/layouts/WorkspaceLayout.astro` | Modify | Mount HighlightClickProxy, ColorPicker, highlight bootstrap script |
| `src/styles/global.css` | Modify | Card styles, `@keyframes marker-paint`, highlight color vars, Strong pattern |
| `tailwind.config.mjs` | Modify | Add `highlight` color palette tokens |

## Interfaces / Contracts

```typescript
// src/stores/highlight.ts
export type ColorId = 'amarillo' | 'verde' | 'rosa' | 'azul' | 'naranja' | 'violeta';
export const COLORS: readonly ColorId[] = ['amarillo','verde','rosa','azul','naranja','violeta'];
export type HighlightMap = Record<string, ColorId>; // verseKey → colorId
export const HIGHLIGHT_KEY = 'rv:highlights';
export const ACTIVE_COLOR_KEY = 'rv:active-color';
export const CARD_MODE_KEY = 'rv:card-mode';
export const $highlight = persistentJSON<HighlightMap>(HIGHLIGHT_KEY, {});
export const $colorActivo = persistentJSON<ColorId>(ACTIVE_COLOR_KEY, 'amarillo');
```

**Verse markup contract** (server-rendered):
```html
<li class="verso-card grid grid-cols-[auto_1fr] gap-3"
    data-verso="genesis:1:1"
    data-has-strong="true">
```

**CSS class contract**:
- `.verso-card` — base card (inactive until `verso-modo-activo`)
- `html.verso-modo-activo .verso-card` — active card styling (padding, border, shadow)
- `.verso-resaltado--{colorId}` — highlight state (sets `--hl-active` var)
- `.verso-card--has-strong` — Strong differentiation (diagonal stripe pattern)

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `$highlight` store toggle/merge logic | Vitest — store.set/get, localStorage mock |
| Unit | Bootstrap script output | Vitest — snapshot test of generated JS string |
| Unit | `verseKey` generation | Vitest — pure function, edge cases (multi-verse runs) |
| Integration | Click proxy coexistence | Playwright — click Strong word, verify highlight NOT toggled |
| Integration | Highlight persistence | Playwright — toggle, reload, verify class present |
| E2E | Full highlight flow | Playwright — select color, tap verse, verify animation + persistence |
| Visual | Color palette light/dark | Playwright screenshot — verify all 6 colors in both modes |

## Migration / Rollout

No migration required. Feature is purely additive:
- CSS scoped under `html.verso-modo-activo` — inactive by default
- No existing markup removed — only classes and data attributes added
- Removing `HighlightClickProxy` + bootstrap script + `ColorPicker` reverts to flat rendering
- localStorage keys are new (`rv:highlights`, `rv:active-color`, `rv:card-mode`) — no collision with existing keys
