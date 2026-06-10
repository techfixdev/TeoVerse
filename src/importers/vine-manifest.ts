/**
 * Vine lexicon manifest — source metadata for the Diccionario Expositivo Vine.
 *
 * Both AT and NT .dctx files feed a single resource slug `vine-es`.
 * The importer deduplicates cross-file code collisions (AT wins over NT).
 */
import type { LexiconSource } from './lexicon';

export const VINE_SOURCE: LexiconSource = {
  slug: 'vine-es',
  nombre: 'Diccionario Expositivo Vine',
  idioma: 'es',
  licencia:
    'Vine, W.E. (1940). Diccionario Expositivo de Palabras del Antiguo y Nuevo Testamento. ' +
    'Publicado por Editorial CLIE. Versión digital e-Sword.',
  fuente: 'e-Sword - https://www.e-sword.net/',
  files: ['vine-at.dctx', 'vine-nt.dctx'],
  attribution:
    'Diccionario Expositivo Vine — W.E. Vine. Datos proporcionados por e-Sword.',
} as const;
