import type { APIRoute } from 'astro';
import { listSearchDocuments } from '@/db/queries';

export const prerender = true;

export const GET: APIRoute = async () => {
  const documents = await listSearchDocuments();

  return new Response(
    JSON.stringify({
      metadata: {
        source: 'seeded-mvp',
        documentCount: documents.length,
        versions: Array.from(new Set(documents.map((document) => document.version))),
      },
      documents,
    }),
    {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  );
};
