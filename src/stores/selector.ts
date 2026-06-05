/**
 * Selector presentation-state store.
 *
 * Persists the last selection made on the home BibleSelector (version, book,
 * chapter) to localStorage under the key `rv:last-selection`. The home
 * BibleSelector reads this store on hydration to restore the user's last
 * pick (or fall back to defaults when localStorage is empty/unavailable).
 *
 * The store is local to the home — the chapter reader stays URL-driven and
 * does not read from it. This keeps the change scope tight: no cross-page
 * state, no chapter reader coupling.
 *
 * SSR safety: `persistentJSON` from `@nanostores/persistent` guards
 * localStorage access internally (testSupport() checks for undefined/errors),
 * so this module is safe to import in Astro server-side rendering contexts.
 */

import { persistentJSON } from '@nanostores/persistent';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SelectorVersionSlug = 'spapddpt' | 'sparvg' | 'spaRV1909' | 'mensaje';

export interface LastSelection {
  version: SelectorVersionSlug;
  libro: string;
  capitulo: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SELECTOR_KEY = 'rv:last-selection';

const defaultSelection: LastSelection = {
  version: 'spapddpt',
  libro: 'genesis',
  capitulo: 1,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * $selector — persisted last-selection atom.
 *
 * Read with `$selector.get()` in the BibleSelector hydration script.
 * Write with `$selector.set({ version, libro, capitulo })` on every
 * cascading-select change.
 */
export const $selector = persistentJSON<LastSelection>(SELECTOR_KEY, defaultSelection);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read the current last selection safely (returns default if not yet hydrated). */
export function getLastSelection(): LastSelection {
  return $selector.get();
}
