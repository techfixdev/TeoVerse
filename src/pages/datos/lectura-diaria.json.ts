import type { APIRoute } from 'astro';
import { getDailyReadings, listBibliaVersions } from '@/db/queries';
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

  // Parsear mes y dia opcionales enviados por el cliente (fecha local del usuario).
  // Si son inválidos se ignoran y getDailyReadings usa la fecha del servidor como fallback.
  const rawMes = url.searchParams.get('mes');
  const rawDia = url.searchParams.get('dia');
  const parsedMes = rawMes !== null ? parseInt(rawMes, 10) : NaN;
  const parsedDia = rawDia !== null ? parseInt(rawDia, 10) : NaN;
  const mes = Number.isInteger(parsedMes) && parsedMes >= 1 && parsedMes <= 12 ? parsedMes : undefined;
  const dia = Number.isInteger(parsedDia) && parsedDia >= 1 && parsedDia <= 31 ? parsedDia : undefined;

  const readings = await getDailyReadings(requestedVersion, mes, dia);

  // Calcular la etiqueta de fecha a partir de los parámetros resueltos (cliente o servidor).
  const fechaDate = new Date();
  if (mes !== undefined) fechaDate.setMonth(mes - 1);
  if (dia !== undefined) fechaDate.setDate(dia);
  const fecha = fechaDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

  return new Response(JSON.stringify({ version: requestedVersion, fecha, readings }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  });
};
