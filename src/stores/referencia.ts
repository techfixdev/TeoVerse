/**
 * Reference spine store.
 *
 * `$referencia` — the canonical /biblia/{version}/{libro}/{capitulo} reference.
 * Defaults to null. The seeding mechanism (reading the build-injected `data-*`
 * reference attribute on the root element and calling `$referencia.set(...)`)
 * is wired during page integration in Phase 3 (PR 3); in this phase
 * `$referencia` is never set from the DOM and remains null after page load.
 * Read-only after initial seed; navigation triggers a full page load
 * (static site).
 *
 * `$senalStrong` — word-click signal. Set by the interlinear word renderer
 * whenever the user clicks a word with a Strong code. Subscribed by the Strong
 * module island to update its lookup view without page navigation.
 */

import { atom } from 'nanostores';
import type { Referencia } from '@/modules/contrato';

// ---------------------------------------------------------------------------
// $referencia
// Current Bible reference. Defaults to null in this phase; Phase 3 (PR 3)
// wires seeding from the build-injected data-* reference attribute.
// ---------------------------------------------------------------------------

export const $referencia = atom<Referencia | null>(null);

// ---------------------------------------------------------------------------
// $senalStrong
// Word-click event payload. null when no word is selected.
// ---------------------------------------------------------------------------

export interface SenalStrong {
  codigoStrong: string;
  palabra: string;
}

export const $senalStrong = atom<SenalStrong | null>(null);
