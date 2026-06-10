/**
 * fetchEntrada — pure fetch helpers for Strong lexicon entries.
 *
 * Builds the static JSON URL for a Strong code and fetches it.
 * Designed to be called at runtime from the StrongPanel island.
 *
 * Two entry points:
 *   - fetchEntrada(code, lexiconSlug) → single entry from per-lexicon endpoint (legacy)
 *   - fetchEntradas(code) → LexiconEntry[] from aggregate endpoint (multi-lexicon)
 *
 * No runtime DB access. Consumes the static endpoints emitted at build time.
 */

export interface EntradaStrong {
  lema: string;
  definicion: string;
}

export interface LexiconEntryData {
  lexiconSlug: string;
  lexiconNombre: string;
  lema: string;
  definicion: string;
}

/**
 * Fetch a Strong lexicon entry from the per-lexicon static JSON endpoint.
 *
 * @param codigoStrong - The Strong code, e.g. `"G25"` or `"H430"`.
 * @param lexiconSlug  - The lexicon resource slug. Defaults to `'strong-es'`.
 * @returns The entry `{ lema, definicion }` on success; `null` on 404 or on a
 *          200 response with no lema and no definicion; throws on other HTTP
 *          errors or invalid code format.
 * @throws  On network failures or non-200/404 HTTP statuses.
 */
export async function fetchEntrada(
  codigoStrong: string,
  lexiconSlug = 'strong-es',
): Promise<EntradaStrong | null> {
  if (!/^[GH]\d+[a-z]?$/.test(codigoStrong)) {
    throw new Error(`fetchEntrada: invalid codigoStrong format: "${codigoStrong}"`);
  }

  const url = `/datos/strong/${lexiconSlug}/${codigoStrong}.json`;
  const response = await fetch(url);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `fetchEntrada: unexpected HTTP ${response.status} for ${url}`,
    );
  }

  const data = await response.json();
  const lema = typeof data.lema === 'string' ? data.lema : '';
  const definicion = typeof data.definicion === 'string' ? data.definicion : '';
  if (!lema && !definicion) return null;
  return { lema, definicion };
}

/**
 * Fetch all lexicon entries for a Strong code from the aggregate endpoint.
 *
 * @param codigoStrong - The Strong code, e.g. `"G25"` or `"H430"`.
 * @returns Array of LexiconEntry objects; empty array on 404 (no entries).
 * @throws  On network failures or non-200/404 HTTP statuses.
 */
export async function fetchEntradas(
  codigoStrong: string,
): Promise<LexiconEntryData[]> {
  if (!/^[GH]\d+[a-z]?$/.test(codigoStrong)) {
    throw new Error(`fetchEntradas: invalid codigoStrong format: "${codigoStrong}"`);
  }

  const url = `/datos/strong/${codigoStrong}.json`;
  const response = await fetch(url);

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(
      `fetchEntradas: unexpected HTTP ${response.status} for ${url}`,
    );
  }

  const data = await response.json();
  const lexicons = Array.isArray(data.lexicons) ? data.lexicons : [];
  return lexicons as LexiconEntryData[];
}
