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
  let mes = Number.isInteger(parsedMes) && parsedMes >= 1 && parsedMes <= 12 ? parsedMes : undefined;
  let dia = Number.isInteger(parsedDia) && parsedDia >= 1 && parsedDia <= 31 ? parsedDia : undefined;

  // Cross-validar: (mes, dia) deben formar una fecha real. Se usa un año bisiesto (2024)
  // para aceptar el 29 de febrero. Una fecha imposible (p. ej. 30 de febrero) se descarta
  // y se cae al fallback de fecha del servidor en lugar de devolver lecturas vacías.
  if (mes !== undefined && dia !== undefined) {
    const probe = new Date(2024, mes - 1, dia);
    if (probe.getMonth() !== mes - 1) {
      mes = undefined;
      dia = undefined;
    }
  }

  const readings = await getDailyReadings(requestedVersion, mes, dia);

  // Calcular la etiqueta de fecha desde los valores resueltos con el constructor de 3
  // argumentos (evita el desborde de setMonth/setDate cuando el día del servidor no
  // existe en el mes pedido, p. ej. 31 de enero + mes=2).
  const now = new Date();
  const resolvedMes = mes ?? now.getMonth() + 1;
  const resolvedDia = dia ?? now.getDate();
  const fechaDate = new Date(now.getFullYear(), resolvedMes - 1, resolvedDia);
  const fecha = fechaDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

  return new Response(JSON.stringify({ version: requestedVersion, fecha, readings }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  });
};
