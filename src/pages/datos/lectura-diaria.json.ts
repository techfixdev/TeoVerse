import type { APIRoute } from 'astro';
import { getDailyReadings, listBibliaVersions } from '@/db/queries';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const rawVersion = url.searchParams.get('version');
  const requestedVersion = rawVersion?.trim() || 'spapddpt';

  // Validate against live DB version list
  const availableVersions = await listBibliaVersions();
  const validSlugs = availableVersions.map((v) => v.slug);

  if (!validSlugs.includes(requestedVersion)) {
    return new Response(JSON.stringify({ error: 'invalid_version' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const readings = await getDailyReadings(requestedVersion);

  return new Response(JSON.stringify({ version: requestedVersion, readings }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  });
};
