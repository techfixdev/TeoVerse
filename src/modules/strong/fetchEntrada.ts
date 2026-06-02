/**
 * fetchEntrada — pure fetch helper for Strong lexicon entries.
 *
 * Builds the static JSON URL for a Strong code and fetches it.
 * Designed to be called at runtime from the StrongPanel island.
 *
 * Return contract:
 *   - `{ lema, definicion }` on HTTP 200
 *   - `null` on HTTP 404 (graceful empty per D7 — code is shown without definition)
 *   - throws on any other status or network error
 *
 * No runtime DB access. Consumes the static endpoints emitted by PR 2b at
 * `/datos/strong/{lexiconSlug}/{codigo}.json`.
 */

export interface EntradaStrong {
  lema: string;
  definicion: string;
}

/**
 * Fetch a Strong lexicon entry from the static JSON endpoint.
 *
 * @param codigoStrong - The Strong code, e.g. `"G25"` or `"H430"`.
 * @param lexiconSlug  - The lexicon resource slug. Defaults to `'strong-es'`.
 * @returns The entry `{ lema, definicion }` on success, `null` on 404.
 * @throws  On network failures or non-200/404 HTTP statuses.
 */
export async function fetchEntrada(
  codigoStrong: string,
  lexiconSlug = 'strong-es',
): Promise<EntradaStrong | null> {
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
  return { lema: data.lema, definicion: data.definicion };
}
