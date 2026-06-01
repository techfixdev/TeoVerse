/**
 * Workspace presentation-state store.
 *
 * Persists which modules are enabled and their visual state (open/minimized/
 * maximized) to localStorage under the key `teoverse.workspace.v1`.
 *
 * Design decision: `persistentJSON` is used instead of `persistentMap`.
 * `persistentMap` stores each key as a separate localStorage entry
 * (`prefix + key`), which is incompatible with the single-JSON-blob schema
 * `teoverse.workspace.v1` described in the design. `persistentJSON` stores
 * the complete `EstadoWorkspace` object serialized as one JSON string, which
 * allows the bootstrap script to read and parse a single key pre-paint.
 *
 * SSR safety: `persistentJSON` from `@nanostores/persistent` guards
 * localStorage access internally (testSupport() checks for undefined/errors),
 * so this module is safe to import in Astro server-side rendering contexts.
 */

import { persistentJSON } from '@nanostores/persistent';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModoVisual = 'cerrado' | 'minimizado' | 'normal' | 'maximizado';

export interface EstadoModulo {
  /** Whether the module is in the user's active workspace. */
  habilitado: boolean;
  /**
   * Visual display mode for the module panel/tab.
   * `'cerrado'` means the module is closed (collapsed); any other value means
   * it is open. Use `modo` to express open/closed — there is no separate
   * `abierto` flag.
   */
  modo: ModoVisual;
  /** Display order within the workspace (lower = first). */
  orden: number;
}

export interface EstadoWorkspace {
  modulos: Record<string, EstadoModulo>;
  /** Schema version — bump when the shape changes incompatibly. */
  version: 1;
}

// ---------------------------------------------------------------------------
// Default state
// ---------------------------------------------------------------------------

export const WORKSPACE_KEY = 'teoverse.workspace.v1';

const defaultEstado: EstadoWorkspace = {
  modulos: {
    lectura: {
      habilitado: true,
      modo: 'normal',
      orden: 0,
    },
  },
  version: 1,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * $workspace — persisted workspace state atom.
 *
 * Read with `$workspace.get()` or `useStore($workspace)` in islands.
 * Write with `$workspace.set({ ...newState })`.
 *
 * The bootstrap script reads `localStorage[WORKSPACE_KEY]` directly (without
 * going through this store) before first paint to avoid layout shift. This
 * store then hydrates from localStorage on client mount.
 */
export const $workspace = persistentJSON<EstadoWorkspace>(WORKSPACE_KEY, defaultEstado);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read current workspace state safely (returns default if not yet hydrated). */
export function getWorkspace(): EstadoWorkspace {
  return $workspace.get();
}

/** Update a single module's state without touching others. */
export function actualizarModulo(id: string, patch: Partial<EstadoModulo>): void {
  const current = getWorkspace();
  const moduloActual = current.modulos[id];
  $workspace.set({
    ...current,
    modulos: {
      ...current.modulos,
      [id]: {
        ...(moduloActual ?? { habilitado: false, modo: 'normal', orden: 99 }),
        ...patch,
      },
    },
  });
}
