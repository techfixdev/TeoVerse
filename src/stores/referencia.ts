/**
 * Reference spine store.
 *
 * `$referencia` — the canonical /biblia/{version}/{libro}/{capitulo} reference.
 * Seeded at page load from `data-*` attributes on the root element by the
 * bootstrap script. Read-only after initial seed; navigation triggers a full
 * page load (static site).
 *
 * `$senalStrong` — word-click signal. Set by the interlinear word renderer
 * whenever the user clicks a word with a Strong code. Subscribed by the Strong
 * module island to update its lookup view without page navigation.
 */

import { atom } from 'nanostores';
import type { Referencia } from '@/modules/contrato';

// ---------------------------------------------------------------------------
// $referencia
// Current Bible reference. null until the bootstrap script seeds it from
// the page's data-* attributes.
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
