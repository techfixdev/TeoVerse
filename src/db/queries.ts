import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from './client';
import { recursos, recursoLibros, libros, versiculos, versiculosTokens, diccionarioEntradas } from './schema';

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
  // TODO: rename chapter.biblia.* → chapter.recurso.* in a follow-up PR (compat shim; sourced from recursos table)
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

export type BibleLibraryChapter = {
  capitulo: number;
  href: string;
};

export type BibleLibraryBook = {
  slug: string;
  nombre: string;
  chapters: BibleLibraryChapter[];
};

export type BibleLibraryVersion = {
  slug: string;
  nombre: string;
  books: BibleLibraryBook[];
};

export type SelectorBookEntry = {
  slug: string;
  nombre: string;
  abreviatura: string;
  capitulos: number[];
};

export type SelectorVersionEntry = {
  slug: string;
  nombre: string;
  abreviatura: string;
  libros: SelectorBookEntry[];
};

export type SelectorManifest = {
  versions: SelectorVersionEntry[];
  updatedAt: string;
};

/**
 * Hardcoded version abreviatura map. The `recursos` table has no
 * abreviatura column and the spec forbids schema changes, so the four
 * known Bible slugs are mapped at the projection boundary. Extend the
 * record when a new Bible is added.
 */
export const VERSION_ABBREVIATURES: Record<string, string> = {
  spapddpt: 'PDPT',
  sparvg: 'RVG',
  spaRV1909: 'RVR1909',
  mensaje: 'MSG',
};

type ChapterReference = {
  version: string;
  libro: string;
  capitulo: number;
};

export async function listStaticChapterPaths(): Promise<StaticChapterPath[]> {
  const rows = await db
    .select({
      version: recursos.slug,
      libro: libros.slug,
      capitulo: versiculos.capitulo,
    })
    .from(versiculos)
    .innerJoin(recursos, eq(versiculos.recursoId, recursos.id))
    .innerJoin(libros, eq(versiculos.libroId, libros.id))
    .innerJoin(recursoLibros, and(eq(recursoLibros.recursoId, recursos.id), eq(recursoLibros.libroId, libros.id)))
    .where(eq(recursos.tipo, 'biblia'))
    .groupBy(recursos.slug, libros.slug, versiculos.capitulo)
    .orderBy(asc(recursos.slug), asc(recursoLibros.orden), asc(versiculos.capitulo));

  return rows.map((row) => ({
    version: row.version,
    libro: row.libro,
    capitulo: String(row.capitulo),
  }));
}

export async function getChapter(reference: ChapterReference): Promise<Chapter | null> {
  const rows = await db
    .select({
      // compat shim: fields named biblia.* but sourced from recursos table
      // TODO: rename chapter.biblia.* → chapter.recurso.* in a follow-up PR
      bibliaSlug: recursos.slug,
      bibliaNombre: recursos.nombre,
      bibliaLicencia: recursos.licencia,
      bibliaFuente: recursos.fuente,
      libroSlug: libros.slug,
      libroNombre: libros.nombre,
      capitulo: versiculos.capitulo,
      versiculo: versiculos.versiculo,
      texto: versiculos.texto,
    })
    .from(versiculos)
    .innerJoin(recursos, eq(versiculos.recursoId, recursos.id))
    .innerJoin(libros, eq(versiculos.libroId, libros.id))
    .where(
      and(
        eq(recursos.tipo, 'biblia'),
        eq(recursos.slug, reference.version),
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
      version: recursos.slug,
      libro: libros.slug,
      libroNombre: libros.nombre,
      libroOrden: recursoLibros.orden,
      capitulo: versiculos.capitulo,
    })
    .from(versiculos)
    .innerJoin(recursos, eq(versiculos.recursoId, recursos.id))
    .innerJoin(libros, eq(versiculos.libroId, libros.id))
    .innerJoin(recursoLibros, and(eq(recursoLibros.recursoId, recursos.id), eq(recursoLibros.libroId, libros.id)))
    .where(and(eq(recursos.tipo, 'biblia'), eq(recursos.slug, reference.version)))
    .groupBy(recursos.slug, recursoLibros.orden, libros.slug, libros.nombre, versiculos.capitulo)
    .orderBy(asc(recursos.slug), asc(recursoLibros.orden), asc(versiculos.capitulo));

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

export async function listSelectorManifest(): Promise<Omit<SelectorManifest, 'updatedAt'>> {
  const rows = await db
    .select({
      version: recursos.slug,
      versionNombre: recursos.nombre,
      libro: libros.slug,
      libroNombre: libros.nombre,
      libroAbreviatura: libros.abreviatura,
      libroOrden: recursoLibros.orden,
      maxCapitulo: sql<number>`MAX(${versiculos.capitulo})`.as('max_capitulo'),
    })
    .from(versiculos)
    .innerJoin(recursos, eq(versiculos.recursoId, recursos.id))
    .innerJoin(libros, eq(versiculos.libroId, libros.id))
    .innerJoin(
      recursoLibros,
      and(eq(recursoLibros.recursoId, recursos.id), eq(recursoLibros.libroId, libros.id)),
    )
    .where(eq(recursos.tipo, 'biblia'))
    .groupBy(
      recursos.slug,
      recursos.nombre,
      recursoLibros.orden,
      libros.slug,
      libros.nombre,
      libros.abreviatura,
    )
    .orderBy(asc(recursos.slug), asc(recursoLibros.orden));

  const versions: SelectorVersionEntry[] = [];

  for (const row of rows) {
    let version = versions.find((entry) => entry.slug === row.version);
    if (!version) {
      version = {
        slug: row.version,
        nombre: row.versionNombre,
        abreviatura: VERSION_ABBREVIATURES[row.version] ?? row.version.toUpperCase(),
        libros: [],
      };
      versions.push(version);
    }

    version.libros.push({
      slug: row.libro,
      nombre: row.libroNombre,
      abreviatura: row.libroAbreviatura,
      capitulos: Array.from({ length: row.maxCapitulo }, (_, i) => i + 1),
    });
  }

  return { versions };
}

export async function listBibleLibrary(): Promise<BibleLibraryVersion[]> {
  const rows = await db
    .select({
      version: recursos.slug,
      versionNombre: recursos.nombre,
      libro: libros.slug,
      libroNombre: libros.nombre,
      libroOrden: recursoLibros.orden,
      capitulo: versiculos.capitulo,
    })
    .from(versiculos)
    .innerJoin(recursos, eq(versiculos.recursoId, recursos.id))
    .innerJoin(libros, eq(versiculos.libroId, libros.id))
    .innerJoin(recursoLibros, and(eq(recursoLibros.recursoId, recursos.id), eq(recursoLibros.libroId, libros.id)))
    .where(eq(recursos.tipo, 'biblia'))
    .groupBy(recursos.slug, recursos.nombre, recursoLibros.orden, libros.slug, libros.nombre, versiculos.capitulo)
    .orderBy(asc(recursos.slug), asc(recursoLibros.orden), asc(versiculos.capitulo));

  const library: BibleLibraryVersion[] = [];

  for (const row of rows) {
    let version = library.find((entry) => entry.slug === row.version);

    if (!version) {
      version = { slug: row.version, nombre: row.versionNombre, books: [] };
      library.push(version);
    }

    let book = version.books.find((entry) => entry.slug === row.libro);

    if (!book) {
      book = { slug: row.libro, nombre: row.libroNombre, chapters: [] };
      version.books.push(book);
    }

    book.chapters.push({
      capitulo: row.capitulo,
      href: `/biblia/${row.version}/${row.libro}/${row.capitulo}/`,
    });
  }

  return library;
}

export type ChapterToken = {
  versiculo: number;
  posicion: number;
  palabra: string;
  codigoStrong: string | null;
};

export async function listTokensForChapter(reference: ChapterReference): Promise<ChapterToken[]> {
  const rows = await db
    .select({
      versiculo: versiculos.versiculo,
      posicion: versiculosTokens.posicion,
      palabra: versiculosTokens.palabra,
      codigoStrong: versiculosTokens.codigoStrong,
    })
    .from(versiculosTokens)
    .innerJoin(versiculos, eq(versiculosTokens.versiculoId, versiculos.id))
    .innerJoin(recursos, eq(versiculos.recursoId, recursos.id))
    .innerJoin(libros, eq(versiculos.libroId, libros.id))
    .where(
      and(
        eq(recursos.slug, reference.version),
        eq(recursos.tipo, 'biblia'),
        eq(libros.slug, reference.libro),
        eq(versiculos.capitulo, reference.capitulo),
      ),
    )
    .orderBy(asc(versiculos.versiculo), asc(versiculosTokens.posicion));

  return rows;
}

export type DiccionarioEntradaResult = {
  codigoStrong: string;
  lema: string;
  definicion: string;
  recursoSlug: string;
};

export async function getDiccionarioEntrada(
  codigoStrong: string,
  lexiconSlug = 'strong-es',
): Promise<DiccionarioEntradaResult | null> {
  const row = await db
    .select({
      codigoStrong: diccionarioEntradas.codigoStrong,
      lema: diccionarioEntradas.lema,
      definicion: diccionarioEntradas.definicion,
      recursoSlug: recursos.slug,
    })
    .from(diccionarioEntradas)
    .innerJoin(recursos, eq(diccionarioEntradas.recursoId, recursos.id))
    .where(and(eq(recursos.slug, lexiconSlug), eq(diccionarioEntradas.codigoStrong, codigoStrong)))
    .get();

  return row ?? null;
}

export type LexiconPath = {
  lexiconSlug: string;
  codigo: string;
};

export async function listStaticLexiconPaths(): Promise<LexiconPath[]> {
  const rows = await db
    .select({
      lexiconSlug: recursos.slug,
      codigo: diccionarioEntradas.codigoStrong,
    })
    .from(diccionarioEntradas)
    .innerJoin(recursos, eq(diccionarioEntradas.recursoId, recursos.id))
    .where(eq(recursos.tipo, 'diccionario'))
    .orderBy(asc(recursos.slug), asc(diccionarioEntradas.codigoStrong));

  return rows;
}

export async function listBibleAttributions(): Promise<BibleAttribution[]> {
  return db
    .select({
      slug: recursos.slug,
      nombre: recursos.nombre,
      idioma: recursos.idioma,
      licencia: recursos.licencia,
      fuente: recursos.fuente,
    })
    .from(recursos)
    .where(eq(recursos.tipo, 'biblia'))
    .orderBy(asc(recursos.slug));
}

export async function listSearchDocuments(): Promise<SearchDocument[]> {
  const rows = await db
    .select({
      version: recursos.slug,
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
    .where(eq(recursos.tipo, 'biblia'))
    .orderBy(asc(recursos.slug), asc(recursoLibros.orden), asc(versiculos.capitulo), asc(versiculos.versiculo));

  return rows.map((row) => ({
    version: row.version,
    book: row.book,
    chapter: row.chapter,
    verse: row.verse,
    text: row.text,
    href: `/biblia/${row.version}/${row.bookSlug}/${row.chapter}/#v${row.verse}`,
  }));
}
