import type { APIRoute } from 'astro';
import { listSelectorManifest, type SelectorManifest } from '@/db/queries';

export const prerender = true;

export const GET: APIRoute = async () => {
  const { versions } = await listSelectorManifest();
  const body: SelectorManifest = { versions, updatedAt: new Date().toISOString() };

  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
};
