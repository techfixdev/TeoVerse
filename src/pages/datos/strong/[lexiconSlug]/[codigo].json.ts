import type { APIRoute, GetStaticPaths } from 'astro';
import { getDiccionarioEntrada, listStaticLexiconPaths } from '@/db/queries';

export const prerender = true;

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = await listStaticLexiconPaths();
  return paths.map((path) => ({
    params: {
      lexiconSlug: path.lexiconSlug,
      codigo: path.codigo,
    },
  }));
};

export const GET: APIRoute = async ({ params }) => {
  const { lexiconSlug, codigo } = params as { lexiconSlug: string; codigo: string };
  const entrada = await getDiccionarioEntrada(codigo, lexiconSlug);

  if (!entrada) {
    return new Response(JSON.stringify({ error: 'not_found', codigoStrong: codigo }), {
      status: 404,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  return new Response(
    JSON.stringify({
      codigoStrong: entrada.codigoStrong,
      lema: entrada.lema,
      definicion: entrada.definicion,
      recursoSlug: entrada.recursoSlug,
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  );
};
