import type { APIRoute } from 'astro';
import { db } from '@/db/client';
import { versiculos, recursos, libros, recursoLibros } from '@/db/schema';
import { and, asc, eq, like, or, inArray } from 'drizzle-orm';

export const prerender = false;

const VERSIONES_DISPONIBLES = ['spapddpt', 'sparvg', 'spaRV1909', 'mensaje'];

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const versionesParam = url.searchParams.get('versiones') ?? '';

  if (!q || q.length < 2) {
    return Response.json({ results: [], count: 0, query: q });
  }

  const versionesSeleccionadas = versionesParam
    ? versionesParam.split(',').filter((v) => VERSIONES_DISPONIBLES.includes(v))
    : VERSIONES_DISPONIBLES;

  if (versionesSeleccionadas.length === 0) {
    return Response.json({ results: [], count: 0, query: q });
  }

  const normalizedQuery = `%${q}%`;

  const conditions: ReturnType<typeof and>[] = [
    eq(recursos.tipo, 'biblia'),
    inArray(recursos.slug, versionesSeleccionadas),
    or(
      like(versiculos.texto, normalizedQuery),
      like(libros.nombre, normalizedQuery),
    )!,
  ];

  const rows = await db
    .select({
      version: recursos.slug,
      versionNombre: recursos.nombre,
      book: libros.nombre,
      bookSlug: libros.slug,
      chapter: versiculos.capitulo,
      verse: versiculos.versiculo,
      text: versiculos.texto,
    })
    .from(versiculos)
    .innerJoin(recursos, eq(versiculos.recursoId, recursos.id))
    .innerJoin(libros, eq(versiculos.libroId, libros.id))
    .innerJoin(recursoLibros, and(eq(recursoLibros.recursoId, recursos.id), eq(recursoLibros.libroId, libros.id)))
    .where(and(...conditions))
    .orderBy(asc(recursos.slug), asc(recursoLibros.orden), asc(versiculos.capitulo), asc(versiculos.versiculo))
    .limit(60);

  const results = rows.map((row) => ({
    version: row.version,
    versionNombre: row.versionNombre,
    book: row.book,
    chapter: row.chapter,
    verse: row.verse,
    text: row.text,
    href: `/biblia/${row.version}/${row.bookSlug}/${row.chapter}/#v${row.verse}`,
  }));

  return Response.json({
    query: q,
    count: results.length,
    versiones: versionesSeleccionadas,
    results,
  });
};
