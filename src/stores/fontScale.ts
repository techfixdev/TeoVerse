/**
 * Font-scale presentation-state store.
 *
 * Persists the user's font-size preference to localStorage under the key
 * `rv:font-scale` and feeds the FontSizeControl UI. The inline bootstrap
 * script reads the same localStorage key directly (without this store) before
 * first paint to prevent FOUC.
 *
 * Values: 'default' | 'sm' | 'md' | 'lg'
 *
 * SSR safety: `persistentJSON` from `@nanostores/persistent` guards
 * localStorage access internally (testSupport() checks for undefined/errors),
 * so this module is safe to import in Astro server-side rendering contexts.
 */

import { persistentJSON } from '@nanostores/persistent';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FontScaleLevel = 'default' | 'sm' | 'md' | 'lg';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const FONT_SCALE_KEY = 'rv:font-scale';

export const LEVELS: readonly FontScaleLevel[] = ['default', 'sm', 'md', 'lg'] as const;

const defaultLevel: FontScaleLevel = 'default';

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * $fontScale — persisted font-scale preference atom.
 *
 * Read with `$fontScale.get()` in the FontSizeControl hydration script.
 * Write with `$fontScale.set(level)` on button click.
 *
 * The bootstrap script reads `localStorage[FONT_SCALE_KEY]` directly (without
 * going through this store) before first paint to avoid layout shift. This
 * store then hydrates from localStorage on client mount.
 */
export const $fontScale = persistentJSON<FontScaleLevel>(FONT_SCALE_KEY, defaultLevel);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read current font-scale preference safely (returns default if not yet hydrated). */
export function getFontScale(): FontScaleLevel {
  return $fontScale.get();
}

/** Advance to the next scale level (caps at 'lg'). */
export function increaseFontScale(): void {
  const current = getFontScale();
  const idx = LEVELS.indexOf(current);
  if (idx < LEVELS.length - 1) {
    $fontScale.set(LEVELS[idx + 1]);
  }
}

/** Step back to the previous scale level (caps at 'default'). */
export function decreaseFontScale(): void {
  const current = getFontScale();
  const idx = LEVELS.indexOf(current);
  if (idx > 0) {
    $fontScale.set(LEVELS[idx - 1]);
  }
}

/** Reset to default scale (1.0). */
export function resetFontScale(): void {
  $fontScale.set(defaultLevel);
}
