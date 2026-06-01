import { and, asc, eq } from 'drizzle-orm';
import { db } from './client';
import { biblias, libros, versiculos } from './schema';

export type StaticChapterPath = {
  version: string;
  libro: string;
  capitulo: string;
};

export type ChapterVerse = {
  numero: number;
  texto: string;
};

export type Chapter = {
  biblia: {
    slug: string;
    nombre: string;
    licencia: string;
    fuente: string;
  };
  libro: {
    slug: string;
    nombre: string;
  };
  capitulo: number;
  versiculos: ChapterVerse[];
};

export type BibleAttribution = {
  slug: string;
  nombre: string;
  idioma: string;
  licencia: string;
  fuente: string;
};

export type SearchDocument = {
  version: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  href: string;
};

export type ChapterNavigationLink = {
  version: string;
  libro: string;
  capitulo: number;
  label: string;
  href: string;
};

export type ChapterNavigation = {
  current: ChapterNavigationLink;
  previous: ChapterNavigationLink | null;
  next: ChapterNavigationLink | null;
};

type ChapterReference = {
  version: string;
  libro: string;
  capitulo: number;
};

export async function listStaticChapterPaths(): Promise<StaticChapterPath[]> {
  const rows = await db
    .select({
      version: biblias.slug,
      libro: libros.slug,
      capitulo: versiculos.capitulo,
    })
    .from(versiculos)
    .innerJoin(biblias, eq(versiculos.bibliaId, biblias.id))
    .innerJoin(libros, eq(versiculos.libroId, libros.id))
    .groupBy(biblias.slug, libros.slug, versiculos.capitulo)
    .orderBy(asc(biblias.slug), asc(libros.orden), asc(versiculos.capitulo));

  return rows.map((row) => ({
    version: row.version,
    libro: row.libro,
    capitulo: String(row.capitulo),
  }));
}

export async function getChapter(reference: ChapterReference): Promise<Chapter | null> {
  const rows = await db
    .select({
      bibliaSlug: biblias.slug,
      bibliaNombre: biblias.nombre,
      bibliaLicencia: biblias.licencia,
      bibliaFuente: biblias.fuente,
      libroSlug: libros.slug,
      libroNombre: libros.nombre,
      capitulo: versiculos.capitulo,
      versiculo: versiculos.versiculo,
      texto: versiculos.texto,
    })
    .from(versiculos)
    .innerJoin(biblias, eq(versiculos.bibliaId, biblias.id))
    .innerJoin(libros, eq(versiculos.libroId, libros.id))
    .where(
      and(
        eq(biblias.slug, reference.version),
        eq(libros.slug, reference.libro),
        eq(versiculos.capitulo, reference.capitulo),
      ),
    )
    .orderBy(asc(versiculos.versiculo));

  const firstRow = rows[0];
  if (!firstRow) return null;

  return {
    biblia: {
      slug: firstRow.bibliaSlug,
      nombre: firstRow.bibliaNombre,
      licencia: firstRow.bibliaLicencia,
      fuente: firstRow.bibliaFuente,
    },
    libro: {
      slug: firstRow.libroSlug,
      nombre: firstRow.libroNombre,
    },
    capitulo: firstRow.capitulo,
    versiculos: rows.map((row) => ({ numero: row.versiculo, texto: row.texto })),
  };
}

export async function getHomeChapter(): Promise<Chapter | null> {
  return getChapter({ version: 'spapddpt', libro: 'genesis', capitulo: 1 });
}

export async function getChapterNavigation(reference: ChapterReference): Promise<ChapterNavigation | null> {
  const rows = await db
    .select({
      version: biblias.slug,
      libro: libros.slug,
      libroNombre: libros.nombre,
      capitulo: versiculos.capitulo,
    })
    .from(versiculos)
    .innerJoin(biblias, eq(versiculos.bibliaId, biblias.id))
    .innerJoin(libros, eq(versiculos.libroId, libros.id))
    .groupBy(biblias.slug, libros.orden, libros.slug, libros.nombre, versiculos.capitulo)
    .orderBy(asc(biblias.slug), asc(libros.orden), asc(versiculos.capitulo));

  const links = rows.map((row) => ({
    version: row.version,
    libro: row.libro,
    capitulo: row.capitulo,
    label: `${row.libroNombre} ${row.capitulo}`,
    href: `/biblia/${row.version}/${row.libro}/${row.capitulo}/`,
  }));

  const currentIndex = links.findIndex(
    (link) =>
      link.version === reference.version && link.libro === reference.libro && link.capitulo === reference.capitulo,
  );

  if (currentIndex === -1) return null;

  return {
    current: links[currentIndex],
    previous: links[currentIndex - 1] ?? null,
    next: links[currentIndex + 1] ?? null,
  };
}

export async function listBibleAttributions(): Promise<BibleAttribution[]> {
  return db
    .select({
      slug: biblias.slug,
      nombre: biblias.nombre,
      idioma: biblias.idioma,
      licencia: biblias.licencia,
      fuente: biblias.fuente,
    })
    .from(biblias)
    .orderBy(asc(biblias.slug));
}

export async function listSearchDocuments(): Promise<SearchDocument[]> {
  const rows = await db
    .select({
      version: biblias.slug,
      book: libros.nombre,
      bookSlug: libros.slug,
      chapter: versiculos.capitulo,
      verse: versiculos.versiculo,
      text: versiculos.texto,
    })
    .from(versiculos)
    .innerJoin(biblias, eq(versiculos.bibliaId, biblias.id))
    .innerJoin(libros, eq(versiculos.libroId, libros.id))
    .orderBy(asc(biblias.slug), asc(libros.orden), asc(versiculos.capitulo), asc(versiculos.versiculo));

  return rows.map((row) => ({
    version: row.version,
    book: row.book,
    chapter: row.chapter,
    verse: row.verse,
    text: row.text,
    href: `/biblia/${row.version}/${row.bookSlug}/${row.chapter}/#v${row.verse}`,
  }));
}
