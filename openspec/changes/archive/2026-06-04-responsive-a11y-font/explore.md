# Exploration: responsive-a11y-font

> Audit of responsiveness, accessibility, and typography in TeoVerse — preparing for font size controls targeting older users with SSG constraints.

## Current State

### Responsiveness

| Aspect | Status | Details |
|--------|--------|---------|
| Viewport meta | ✅ Present | Both `MainLayout.astro` and `WorkspaceLayout.astro` include `<meta name="viewport" content="width=device-width, initial-scale=1.0" />` |
| Tailwind responsive classes | ⚠️ Minimal | Only `sm:` (640px) used for padding (`sm:p-6`, `sm:p-8`, `sm:p-10`), grid (`sm:grid-cols-[1fr_auto]`, `sm:grid-cols-[1fr_1fr_1fr_auto]`), flex direction (`sm:flex-row`), and heading sizes (`sm:text-4xl`, `sm:text-6xl`) |
| Custom media queries | ⚠️ Sparse | `global.css`: one at 640px for `--header-h`; workspace grid at 1024px (single column → reading + 360px aside); Strong panel at 1023px max (mobile bottom sheet) and 1024px min (desktop sticky panel) |
| Container queries | ❌ None | No `@container` or `container-type` anywhere |
| Fluid typography (`clamp()`) | ❌ None | All font sizes are fixed Tailwind utility classes (`text-xs` through `text-6xl`) |
| Flexbox / Grid layout | ✅ Good | `index.astro`: flex/grid for responsive forms; `WorkspaceLayout`: CSS Grid for workspace; `biblia/index.astro`: flex for chapter pills |
| Max-width containers | ✅ Consistent | Pages use `max-w-3xl` (chapter reader, home), `max-w-4xl` (buscar, atribuciones), `max-w-5xl` (biblioteca), `max-w-6xl` (MainLayout header/footer), `max-w-7xl` (WorkspaceLayout) |
| iOS overscroll fix | ✅ Present | `html { background-color: var(--brand-base) }` prevents grey flash |

### Accessibility

| Aspect | Status | Details |
|--------|--------|---------|
| `<html lang>` | ✅ `lang="es"` | Both layouts |
| Semantic landmarks | ✅ Good | `<header>`, `<main>`, `<footer>`, `<nav>`, `<article>`, `<section>`, `<aside>` used throughout |
| Heading hierarchy | ⚠️ Flat | `h1` on every page, but chapter page has no `h2`/`h3` subsections; biblia/index has proper `h1→h2(section)→h3(book)` |
| ARIA attributes | ✅ Good | `aria-label` on navs, forms, panels, buttons; `aria-labelledby` on sections; `aria-current="page"`; `aria-disabled="true"`; `aria-live="polite"` on search results and Strong panel; `aria-atomic="true"`; `role="search"`; `role="complementary"` |
| Keyboard navigation | ✅ Good | Tab order follows DOM; interactive elements are `<a>`, `<button>`, `<select>`, `<input>` (no divs with onclick) |
| Focus indicators | ✅ Consistent | `:focus-visible` rings on all interactive elements: 2px solid `--brand-cian-dark` (≥3:1 per WCAG 2.4.11). Inputs/buttons use `focus:ring-2 focus:ring-brand-cian` |
| Skip-to-content link | ❌ Missing | Screen reader and keyboard users must tab through header nav on every page |
| Color contrast | ✅ Documented | `cianDark #0E7FA3` = 4.58:1 on white (AA); `gris #767676` = 4.54:1 on white (AA); `cian #19ADD3` = 2.64:1 (decorative only, not for text). Dark mode: `[#0E1A1F]` bg with `#E6F4F8` text |
| Screen reader text | ✅ `sr-only` | Used for hidden labels on search inputs, BrandLogo fallback |
| `prefers-reduced-motion` | ❌ None | Transitions exist (hover, focus) but no user-preference media query |

### Typography System

| Aspect | Status | Details |
|--------|--------|---------|
| Font size definition | 🔴 Fixed Tailwind classes | `text-xs` (12px), `text-sm` (14px), `text-base` (16px), `text-lg` (18px), `text-2xl` (24px), `text-3xl` (30px), `text-4xl` (36px), `text-6xl` (60px). No custom fontSize scale in tailwind.config.mjs |
| Font size custom properties | ❌ None | No `--font-size-*` or `--text-*` CSS custom properties |
| Fluid typography | ❌ None | No `clamp()`, no viewport-relative font units |
| Font family system | ✅ Defined | `font-reading` (Georgia serif — verse body), `font-brand` (Inter sans-serif — UI chrome), `font-script` (Caveat cursive — "una gran familia" tagline) |
| Verse body font | `text-lg leading-8 font-reading` | 18px / 32px line-height. Most important text for aging users — hardcoded, no scaling mechanism |
| Font loading | ✅ Self-hosted | `@fontsource/inter` (300-700) and `@fontsource/caveat` (400-500). No CDN dependency. `font-display: swap` baked in by @fontsource |
| Font size preference mechanism | ❌ None | No localStorage, no CSS class, no button/toggle for font size |

### Layout System

| Layout | File | Strategy |
|--------|------|----------|
| MainLayout | `src/layouts/MainLayout.astro` | Simple centered shell: `<header>` (max-w-6xl) + `<slot />` + `<footer>` (max-w-6xl). Used by index, buscar, atribuciones, biblia/index |
| WorkspaceLayout | `src/layouts/WorkspaceLayout.astro` | Full document shell with CSS Grid workspace (mobile: single column; lg: reading + 360px aside). Owns `<html>`, `<head>`, bootstrap script. Used by chapter reader |
| Home | `src/pages/index.astro` | Centered card in MainLayout: max-w-3xl, BibleSelector + search form + verse preview |
| Chapter reader | `src/pages/biblia/[version]/[libro]/[capitulo].astro` | WorkspaceLayout: max-w-3xl article with breadcrumb, nav, verse list, attribution. Strong panel in aside |
| Biblioteca | `src/pages/biblia/index.astro` | MainLayout: max-w-5xl, nested sections for versions → books → chapter pills |
| Buscar | `src/pages/buscar.astro` | MainLayout: max-w-4xl, search form + client-side search over `/search-index.json` |
| Atribuciones | `src/pages/atribuciones.astro` | MainLayout: max-w-4xl, static attribution cards |

### State Management & Storage

| Store | Key | Library | Pattern |
|-------|-----|---------|---------|
| `$selector` | `rv:last-selection` | `@nanostores/persistent` (persistentJSON) | BibleSelector last selection |
| `$workspace` | `teoverse.workspace.v1` | `@nanostores/persistent` (persistentJSON) | Workspace module states |
| `$referencia` | (in-memory atom) | `nanostores` (atom) | Current Bible reference, seeded from DOM data-* |
| `$senalStrong` | (in-memory atom) | `nanostores` (atom) | Strong word click signal |
| Bootstrap script | `localStorage.getItem` | Inline `<script is:inline>` in `<head>` | Reads workspace state before first paint, applies CSS classes to `<html>` |

**Key insight**: The bootstrap pattern (inline script reads localStorage pre-paint → applies `<html>` classes → CSS responds) is the established SSG-safe pattern for user preferences. A font size mechanism should follow this same pattern.

### Dark Mode

| Aspect | Status | Details |
|--------|--------|---------|
| Tailwind config | `darkMode: 'class'` | Dark mode controlled by `.dark` class on `<html>` |
| CSS variables | ✅ Defined | `:root` = light; `.dark` = dark (brand-base → #0E1A1F, brand-text → #E6F4F8) |
| Toggle UI | ❌ Missing | No dark mode toggle in the UI. Dark classes exist in markup (`dark:*`) but no mechanism to toggle `.dark` |
| `prefers-color-scheme` | ❌ None | No media query for system preference |

---

## Gaps Identified

1. **🔴 No font size scaling mechanism**: All font sizes are fixed Tailwind utilities. Aging users cannot increase text without browser zoom (which may break the CSS Grid workspace layout, sticky header offsets, and Strong panel positioning).

2. **🔴 No font size preference persistence**: No localStorage key, no CSS class, no UI control for font size.

3. **🟡 Limited responsive breakpoints**: Only `sm:` (640px) and the workspace grid `lg:` (1024px). No testing/consideration for very narrow screens (< 375px). The BibleSelector's `sm:grid-cols-[1fr_1fr_1fr_auto]` could overflow on small screens (4 columns of native `<select>` elements).

4. **🟡 No skip-to-content link**: Screen reader and keyboard users must navigate through header on every page load. Critical for a Bible study app where users navigate frequently between chapters.

5. **🟡 No `prefers-reduced-motion` support**: Hover transitions, focus transitions, and Strong panel slide animations have no reduced-motion fallback.

6. **🟡 Verse body text is hardcoded**: `text-lg` (18px) is the reading comfort baseline — the most important text for aging users has zero flexibility.

7. **🟢 Dark mode toggle absent**: `darkMode: 'class'` is configured with complete dark color variables in `global.css`, but there's no UI to activate it.

8. **🟢 `font-brand` applied to `<body>` in WorkspaceLayout**: Verse text uses `font-reading` (Georgia), but the body default is Inter. This is correct for the chapter page but means Inter font-size scaling would be the primary mechanism.

---

## Technical Constraints

1. **SSG-only** (`output: 'static'`): All pages are pre-rendered at build time. Font size preference MUST be client-side — read from localStorage and applied via CSS before/after paint.

2. **No hydration unless necessary**: The existing pattern (workspace bootstrap) uses a minimal inline `<script is:inline>` in `<head>` — no framework, no hydration cost. Font scaling should follow suit.

3. **Tailwind 3.4.19 with `applyBaseStyles: false`**: Cannot use `@apply` in base layer for font-size overrides without losing Tailwind's utility guarantees. CSS custom properties are the correct approach.

4. **Astro component model**: Static `.astro` templates with optional `<script>` islands. A font-size toggle button would be a small island with `client:load` or inline script. The bootstrap pre-paint mechanism must remain inline (no module imports).

5. **Existing nanostores pattern**: The project already uses `@nanostores/persistent` (`persistentJSON`) for localStorage-backed preferences. A font-size store should follow this exact pattern for consistency.

6. **Build pipeline**: `pnpm verify` runs assertion-based verification scripts. Any CSS or HTML structure changes must not break the existing verification chain. The verify step is the SDD verification gate (no vitest/jest).

7. **No project-level linter/formatter**: No style conventions enforced automatically — consistency must be maintained manually.

---

## Approaches

### 1. CSS Custom Properties + `<html>` class + Bootstrap Script (Recommended)

**How it works**:
- Define `--font-scale` CSS custom property on `:root` (default: 1)
- Define scale levels as CSS classes on `<html>`: `font-scale-sm` (1.15), `font-scale-md` (1.35), `font-scale-lg` (1.6)
- In `global.css`, set `html { font-size: calc(100% * var(--font-scale)) }` — this scales ALL `rem`-based units (Tailwind's default)
- Write an inline bootstrap script (same pattern as `bootstrap.ts`) that reads `localStorage['rv:font-scale']` and applies the class to `<html>` before first paint
- Optionally, create a `<FontSizeControl />` island component (or inline script) for the toggle UI in the header
- Create a nanostore `$fontScale` using `persistentJSON` (key: `rv:font-scale`) for reactive components

| Pros | Cons |
|------|------|
| ✅ Scales ALL text uniformly — headings, body, UI labels, verse numbers | ⚠️ Also scales spacing (padding, margin, gap) — but this is actually desirable for readability |
| ✅ Zero hydration cost — inline script runs before paint | ⚠️ Slight layout shift if the user has a stored preference (the script applies class synchronously, so no FOUC) |
| ✅ Follows existing workspace bootstrap pattern exactly | ⚠️ `<html>` font-size affects `rem` computations globally — need to verify `scroll-margin-top` for verse anchors still works |
| ✅ SSR-safe — no server-side localStorage access | |
| ✅ Persists across sessions via localStorage | |
| ✅ Works without JS (just no persistence — user gets default scale) | |
| ✅ Minimal code surface — ~30 lines CSS + ~15 lines inline script + optional island | |
| **Effort**: Low | |

### 2. CSS `:has()` Selector — Pure CSS, No JS

**How it works**:
- Use a hidden `<input type="radio">` or `<select>` with CSS `:has()` to toggle font scale
- `html:has(#font-scale-md:checked) { --font-scale: 1.35; }`
- No JS required at all for the toggle

| Pros | Cons |
|------|------|
| ✅ Zero JS — works without JavaScript | ❌ No persistence across page loads (SSG constraint — each page is a fresh load) |
| ✅ Simple markup | ❌ `:has()` browser support: ~92% global (Safari 15.4+, Chrome 105+, Firefox 121+). Not viable for older users who may be on older browsers |
| | ❌ Toggle state lost on navigation — every page load resets to default |
| | ❌ Can't read user preference from localStorage without JS |
| **Effort**: Low | **Verdict**: ❌ Rejected — no persistence, browser support gap for target audience |

### 3. CSS `clamp()` Fluid Typography (Supplemental)

**How it works**:
- Replace fixed Tailwind font-size classes with `clamp(min, preferred, max)` in `@layer base`
- Example: `h1 { font-size: clamp(2rem, 5vw, 3.75rem); }` instead of `text-6xl`
- Complements approach #1 — fluid typography handles viewport responsiveness, while the scale factor handles user preference

| Pros | Cons |
|------|------|
| ✅ Text adapts to viewport width automatically | ❌ Significant refactor — every page uses fixed Tailwind classes, would need to migrate to custom CSS |
| ✅ Reduces need for responsive breakpoints on headings | ❌ Conflicts with Tailwind's utility-first approach — either abandon Tailwind text classes or fight them |
| | ❌ Doesn't solve the user preference problem by itself |
| **Effort**: High | **Verdict**: 🟡 Consider as future enhancement, not for this change |

### 4. Nanostores-Only (No Inline Bootstrap)

**How it works**:
- Create `$fontScale` nanostore with `persistentJSON`
- Import in a `client:load` island that applies the class after hydration
- No inline bootstrap script

| Pros | Cons |
|------|------|
| ✅ Consistent with existing stores | ❌ **FOUC**: Page renders at default scale, then jumps when JS hydrates — unacceptable for the target audience |
| ✅ Type-safe, testable | ❌ Slower than inline script — hydration happens after React/Astro island mounts |
| | ❌ Violates the established pattern (workspace already uses inline bootstrap for pre-paint state) |
| **Effort**: Low | **Verdict**: ❌ Rejected — causes visible text jump (FOUC) |

---

## Recommendation

### Primary: CSS Custom Properties + Bootstrap Script (Approach #1)

This is the **only approach that meets all constraints**:
- ✅ SSG-compatible (client-side only)
- ✅ No FOUC (inline script runs synchronously before paint)
- ✅ Persistent (localStorage)  
- ✅ Minimal code surface
- ✅ Follows existing workspace bootstrap pattern
- ✅ Scales all text uniformly
- ✅ No new dependencies

### Implementation Blueprint

```
1. Add CSS custom property in global.css:
   :root { --font-scale: 1; }
   html.font-scale-sm { --font-scale: 1.15; }
   html.font-scale-md { --font-scale: 1.35; }  
   html.font-scale-lg { --font-scale: 1.6; }
   html { font-size: calc(100% * var(--font-scale)); }

2. Create src/stores/fontScale.ts:
   - persistentJSON store, key: 'rv:font-scale'
   - Type: 'default' | 'sm' | 'md' | 'lg'

3. Create inline bootstrap snippet (similar to bootstrap.ts):
   - Reads localStorage['rv:font-scale']
   - Applies font-scale-{value} class to <html> before paint

4. Inject inline script in both layouts (MainLayout + WorkspaceLayout)
   in <head> after the workspace bootstrap

5. (Optional) Create FontSizeControl.astro component:
   - Shows current scale with + / - / reset buttons
   - Writes to $fontScale store
   - Placed in header or footer
   - Uses ARIA: role="group", aria-label="Control de tamaño de texto"

6. Font sizes to verify after scaling:
   - Verse body: text-lg (18px) — primary target
   - Verse numbers: text-sm (14px)
   - Headings: text-3xl, text-4xl, text-6xl
   - UI labels: text-sm, text-xs
   - Breadcrumb and navigation links
```

### Additional Quick Wins (Same Change)

While implementing font scaling, include these low-effort a11y improvements:

1. **Skip-to-content link**: Add to both layouts (3 lines each)
   ```html
   <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-brand focus:bg-brand-cianDark focus:px-4 focus:py-2 focus:text-white focus:outline-none">
     Saltar al contenido
   </a>
   ```

2. **`prefers-reduced-motion` support**: Add to `global.css` (5 lines)
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after {
       animation-duration: 0.01ms !important;
       transition-duration: 0.01ms !important;
     }
   }
   ```

3. **`id="main-content"` on all `<main>` elements** to connect the skip link

### What to Defer

- **Dark mode toggle**: Separate change — requires UI design, system preference detection, and persistence. The CSS infrastructure is already ready.
- **Fluid typography (`clamp()`)**: Large refactor touching every page. Evaluate after font scaling is proven.
- **Heading hierarchy on chapter page**: Could add `h2` for "Lectura" section, but not critical for this change.

---

## Affected Areas

| File | Impact | Why |
|------|--------|-----|
| `src/styles/global.css` | **Modify** — Add `--font-scale` custom properties, scale classes, `html { font-size }` rule, `prefers-reduced-motion` | Core font scaling mechanism |
| `src/layouts/MainLayout.astro` | **Modify** — Add inline bootstrap script, skip-to-content link, `id="main-content"` on slot wrapper | Non-workspace pages (index, buscar, biblia/index, atribuciones) |
| `src/layouts/WorkspaceLayout.astro` | **Modify** — Add inline bootstrap script, skip-to-content link, `id="main-content"` on `<main>` | Chapter reader page |
| `src/stores/fontScale.ts` | **Create** — `$fontScale` nanostore with persistentJSON | Type-safe font scale preference |
| `src/components/brand/FontSizeControl.astro` | **Create** (optional) — Toggle UI component | User-facing font size control |
| `src/components/workspace/bootstrap.ts` | **No change** — Existing bootstrap is separate concern | Font scale bootstrap is a separate inline script |
| `tailwind.config.mjs` | **No change** — Not needed | CSS custom properties handle scaling without touching Tailwind config |
| All page `.astro` files | **Minimal** — Add `id="main-content"` to `<main>` if not already wrapped | Skip link target |
| `src/pages/index.astro` | **Minimal** — `id="main-content"` | Skip link target |
| `src/pages/buscar.astro` | **Minimal** — `id="main-content"` | Skip link target |
| `src/pages/biblia/index.astro` | **Minimal** — `id="main-content"` | Skip link target |
| `src/pages/atribuciones.astro` | **Minimal** — `id="main-content"` | Skip link target |

---

## Risks

1. **`scroll-margin-top` breakage**: Verse anchors (`#v{n}`) use `scroll-margin-top: var(--header-h)` which is `5rem` (mobile) / `6rem` (desktop). If `html { font-size }` changes, `rem` values change and the header height CSS variable would also need to be rem-based or computed differently. **Mitigation**: `--header-h` is already defined in `rem` (5rem/6rem). With `html { font-size: calc(100% * var(--font-scale)) }`, these scale proportionally, which is correct behavior — larger text needs a larger header offset.

2. **Layout overflow at max scale**: At `font-scale-lg` (1.6x), some UI elements could overflow their containers on narrow screens. The `BibleSelector` grid with 4 columns at `sm:` may need adjustments. **Mitigation**: Test at 320px width with max scale. Add `overflow-x-auto` or `text-overflow: ellipsis` guards where needed.

3. **Strong panel bottom sheet**: Mobile bottom sheet uses `max-height: 60vh` and fixed positioning. At max font scale, the panel content could overflow the viewport. **Mitigation**: The panel already has `overflow-y: auto` on `.strong-panel` and `.strong-panel__body`.

4. **Inline script parse errors**: If the localStorage value is corrupted, the script must fail gracefully (default to no scaling). **Mitigation**: Wrap in try/catch, same as workspace bootstrap.

5. **Two bootstrap scripts**: Both layouts would have two inline scripts (workspace bootstrap + font scale bootstrap). They must not conflict. **Mitigation**: Font scale bootstrap runs separately and only touches `<html>` classes. Order: workspace bootstrap → font scale bootstrap (both in `<head>`).

---

## Ready for Proposal

**Yes**. The exploration is complete. The recommended approach (CSS custom properties + inline bootstrap + optional nanostore) is low-risk, follows existing patterns, and addresses the core need: font size controls for older users that persist across sessions and don't break layout.

**Next phase**: `sdd-propose` — define the formal proposal with scope, approach, rollback plan, and delivery strategy.
