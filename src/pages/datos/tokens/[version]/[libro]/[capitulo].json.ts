import type { APIRoute, GetStaticPaths } from 'astro';
import { listStaticChapterPaths, listTokensForChapter } from '@/db/queries';

export const prerender = true;

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = await listStaticChapterPaths();
  return paths.map((path) => ({
    params: {
      version: path.version,
      libro: path.libro,
      capitulo: path.capitulo,
    },
  }));
};

export const GET: APIRoute = async ({ params }) => {
  const { version, libro, capitulo } = params as { version: string; libro: string; capitulo: string };
  const tokens = await listTokensForChapter({ version, libro, capitulo: Number(capitulo) });

  return new Response(
    JSON.stringify({
      metadata: {
        version,
        libro,
        capitulo: Number(capitulo),
        tokenCount: tokens.length,
      },
      tokens,
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  );
};
