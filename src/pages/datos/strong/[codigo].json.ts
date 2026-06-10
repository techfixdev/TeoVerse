/**
 * Aggregate Strong lexicon endpoint — returns entries from ALL dictionary resources.
 *
 * GET /datos/strong/{codigo}.json
 * Response: { codigoStrong, lexicons: LexiconEntry[] }
 *
 * getStaticPaths enumerates distinct codes via listAllLexiconCodes() (one query).
 * The existing [lexiconSlug]/[codigo].json.ts stays for back-compat.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getEntradasParaCodigo, listAllLexiconCodes } from '@/db/queries';

export const prerender = true;

export const getStaticPaths: GetStaticPaths = async () => {
  const codes = await listAllLexiconCodes();
  return codes.map((codigo) => ({
    params: { codigo },
  }));
};

export const GET: APIRoute = async ({ params }) => {
  const codigo = params.codigo as string;
  const lexicons = await getEntradasParaCodigo(codigo);

  if (lexicons.length === 0) {
    return new Response(JSON.stringify({ error: 'not_found', codigoStrong: codigo }), {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  return new Response(
    JSON.stringify({ codigoStrong: codigo, lexicons }),
    {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    },
  );
};
