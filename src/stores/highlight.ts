/**
 * Verse-highlight presentation-state store.
 *
 * Persists the user's verse highlight map to localStorage under the key
 * `rv:highlights` and the active marker color under `rv:active-color`.
 * The inline bootstrap script reads the same localStorage keys directly
 * (without this store) before first paint to prevent FOUC.
 *
 * HighlightMap: Record<verseKey, colorId> — e.g. { "genesis:1:1": "amarillo" }
 * ColorId: one of 6 marker colors (amarillo, verde, rosa, azul, naranja, violeta)
 *
 * SSR safety: `persistentJSON` from `@nanostores/persistent` guards
 * localStorage access internally (testSupport() checks for undefined/errors),
 * so this module is safe to import in Astro server-side rendering contexts.
 */

import { persistentJSON } from '@nanostores/persistent';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ColorId = 'amarillo' | 'verde' | 'rosa' | 'azul' | 'naranja' | 'violeta';

export type HighlightMap = Record<string, ColorId>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const COLORS: readonly ColorId[] = [
  'amarillo', 'verde', 'rosa', 'azul', 'naranja', 'violeta',
] as const;

export const HIGHLIGHT_KEY = 'rv:highlights';
export const ACTIVE_COLOR_KEY = 'rv:active-color';
export const CARD_MODE_KEY = 'rv:card-mode';

const defaultHighlight: HighlightMap = {};
const defaultColor: ColorId = 'amarillo';

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

/**
 * $highlight — persisted verse-highlight map atom.
 *
 * Keys are verse identifiers in `{libro}:{capitulo}:{verso}` format
 * (e.g. "genesis:1:1"). Values are ColorId strings.
 *
 * The bootstrap script reads `localStorage[HIGHLIGHT_KEY]` directly (without
 * going through this store) before first paint to apply highlight classes
 * and avoid layout shift. This store then hydrates from localStorage on
 * client mount.
 */
export const $highlight = persistentJSON<HighlightMap>(HIGHLIGHT_KEY, defaultHighlight);

/**
 * $colorActivo — currently selected marker color for the color picker.
 *
 * Read by HighlightClickProxy to determine which color to apply on tap.
 * Written by ColorPicker when the user selects a different swatch.
 */
export const $colorActivo = persistentJSON<ColorId>(ACTIVE_COLOR_KEY, defaultColor);
