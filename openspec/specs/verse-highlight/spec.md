# Verse Highlight Specification

## Purpose

Interactive verse cards with marker-like highlighting, persistent multi-select with color selection, and Strong concordance visual differentiation in the TeoVerse Bible reader.

## Requirements

### Requirement: Verse Card Rendering

The system MUST render each verse as a card element with `data-verso` (verse key) and `data-has-strong` attributes. Verses with Strong tokens MUST receive `verso-card--has-strong`.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Chapter renders cards | User navigates to a chapter | Server renders verse list | Each `<li>` has `data-verso`, `verso-card` class; Strong verses have `data-has-strong="true"` and `verso-card--has-strong` |

### Requirement: Card Mode Activation

Card mode (`verso-modo-activo` on `<html>`) MUST activate on first highlight interaction and persist permanently across sessions until user explicitly deactivates.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| First interaction | User never highlighted | Taps any verse | `verso-modo-activo` added to `<html>`, all verses show card styling |
| Persistence | Card mode active | Browser closed and reopened | Card mode active immediately on load (no FOUC via bootstrap script) |

### Requirement: Marker-Paint Animation

The system MUST play a horizontal sweep (`scaleX(0→1)`) on `::before` pseudo-element on highlight toggle. MUST complete under 300ms. MUST be disabled when `prefers-reduced-motion: reduce`.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Paint animation | Card mode active, color selected | User taps unhighlighted verse | Sweep animation plays under 300ms, verse retains color after |
| Reduced motion | `prefers-reduced-motion: reduce` | User taps verse | Color applied immediately, no animation |

### Requirement: Persistent Highlight State

Highlight state (`Record<verseKey, colorId>`) MUST persist in `$highlight` nanostore via `persistentJSON` (localStorage). Tap highlighted verse MUST remove highlight.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Survives reload | Gen 1:1 highlighted yellow | Page reloaded | Yellow highlight visible immediately (bootstrap script prevents FOUC) |
| Toggle off | Gen 1:1 highlighted | User taps Gen 1:1 again | Highlight removed, default card appearance restored |

### Requirement: Universal Highlight Scope

Highlights MUST apply across ALL Bible versions. Highlighting a verse key in one version MUST highlight the same verse key in every version.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Cross-version | User highlights Gen 1:1 in RVR1960 | User switches to NVI | Gen 1:1 in NVI shows same highlight color |

### Requirement: Color Picker

The system MUST provide a color picker fixed in the workspace header with at least 5 selectable colors. Selected color MUST apply to subsequent highlight actions.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Select color | Color picker visible in header | User taps "blue" swatch | Next verse taps apply blue highlight |

### Requirement: Strong Verse Differentiation

Verses with Strong tokens MUST show a subtle background pattern, distinct from all highlight colors. MUST gracefully degrade (no indicator) for versions without Strong data.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Strong pattern visible | Card mode active, version has Strong data | Chapter renders | Strong verses show subtle background pattern, distinct from highlight colors |
| Graceful degradation | Version without Strong data | Chapter renders | No Strong indicator shown (no broken/empty badge) |

### Requirement: Touch-Friendly Interaction

All highlight interactions MUST work via tap on mobile/tablet. No interaction MUST depend on hover.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Mobile tap | Mobile device, card mode active | User taps verse card | Highlight toggles (same as desktop click) |

### Requirement: Click Proxy Coexistence

`HighlightClickProxy` MUST use delegated listener with non-overlapping `.closest()` selectors — highlight targets `.verso-card`, Strong targets `[data-strong]`, TSK targets `[data-tsk]`.

| Scenario | Given | When | Then |
|----------|-------|------|------|
| Tap Strong token | Verse has Strong tokens, card mode active | User taps Strong token directly | Strong panel opens, verse NOT highlighted |
| Tap verse text | Verse has Strong tokens, card mode active | User taps text outside Strong token | Verse highlighted, Strong panel NOT opened |
