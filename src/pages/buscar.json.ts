import type { APIRoute } from 'astro';
import { listBibliaVersions, searchVersiculos } from '@/db/queries';
import { isLocalFallback } from '@/db/client';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  // Guard: en producción sin TURSO_CONNECTION_URL configurada, el endpoint no puede funcionar.
  if (isLocalFallback && import.meta.env.PROD) {
    console.error('TURSO_CONNECTION_URL is not configured in this deployment');
    return new Response(JSON.stringify({ error: 'database_unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const versionesParam = url.searchParams.get('versiones') ?? '';

  // Spec FTS-5: queries shorter than 3 chars return empty immediately (no DB call)
  if (q.length < 3) {
    return Response.json({ results: [], count: 0, query: q });
  }

  // Fetch valid Bible slugs from DB (replaces hardcoded VERSIONES_DISPONIBLES)
  const availableVersions = await listBibliaVersions();
  const availableSlugs = new Set(availableVersions.map((v) => v.slug));

  // Validate requested versions against live DB slugs
  const requestedSlugs = versionesParam ? versionesParam.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const validatedSlugs = requestedSlugs.length > 0
    ? requestedSlugs.filter((slug) => availableSlugs.has(slug))
    : [...availableSlugs];

  if (validatedSlugs.length === 0) {
    return Response.json({ results: [], count: 0, query: q });
  }

  // FTS5 search — searchVersiculos handles sanitization, short-query guard, error fallback
  const searchResponse = await searchVersiculos(q, validatedSlugs);

  // Spec FTS-6: on FTS error, return HTTP 200 with error indicator (never 500)
  if (searchResponse.error) {
    return Response.json({
      results: [],
      count: 0,
      query: q,
      versiones: validatedSlugs,
      error: searchResponse.error,
    });
  }

  return Response.json({
    query: q,
    count: searchResponse.results.length,
    versiones: validatedSlugs,
    results: searchResponse.results,
  });
};
