import { and, asc, between, eq, sql } from 'drizzle-orm';
import { client, db } from './client';
import { recursos, recursoLibros, libros, versiculos, versiculosTokens, diccionarioEntradas, tskReferencias, planLectura } from './schema';

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

export type DailyReading = {
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
  capituloInicio: number;
  capituloFin: number;
  versiculos: ChapterVerse[];
};

export type BibleAttribution = {
  slug: string;
  nombre: string;
  idioma: string;
  licencia: string;
  fuente: string;
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

export async function getDailyReadings(version: string = 'spapddpt', mes?: number, dia?: number): Promise<DailyReading[]> {
  // Si no se proveen mes/dia, se calcula la fecha actual del servidor (fallback para SSG).
  // El cliente debe pasar su propia fecha para evitar que el reading quede congelado al día del build.
  const now = new Date();
  const mesFinal = mes ?? now.getMonth() + 1;
  const diaFinal = dia ?? now.getDate();

  const planEntries = await db
    .select({
      libroId: planLectura.libroId,
      capituloInicio: planLectura.capituloInicio,
      capituloFin: planLectura.capituloFin,
      libroSlug: libros.slug,
      libroNombre: libros.nombre,
    })
    .from(planLectura)
    .innerJoin(libros, eq(planLectura.libroId, libros.id))
    .where(and(eq(planLectura.mes, mesFinal), eq(planLectura.dia, diaFinal)))
    .orderBy(asc(planLectura.orden));

  if (planEntries.length === 0) return [];

  const readings: DailyReading[] = [];

  for (const entry of planEntries) {
    const capFin = entry.capituloFin ?? entry.capituloInicio;

    const rows = await db
      .select({
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
          eq(recursos.slug, version),
          eq(libros.id, entry.libroId),
          between(versiculos.capitulo, entry.capituloInicio, capFin),
        ),
      )
      .orderBy(asc(versiculos.capitulo), asc(versiculos.versiculo));

    const firstRow = rows[0];
    if (!firstRow) continue;

    readings.push({
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
      capituloInicio: entry.capituloInicio,
      capituloFin: capFin,
      versiculos: rows.map((row) => ({ numero: row.versiculo, texto: row.texto })),
    });
  }

  return readings;
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

// ---------------------------------------------------------------------------
// FTS5 Search (added by search-version-selection)
// ---------------------------------------------------------------------------

export type SearchResult = {
  version: string;
  versionNombre: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  href: string;
};

export type SearchResponse = {
  results: SearchResult[];
  error?: string;
};

/**
 * Sanitize a raw user query for FTS5 MATCH syntax.
 * - Lowercase
 * - Split on whitespace
 * - Strip embedded double-quotes
 * - Wrap each term in "..." (neutralises all FTS5 operators)
 * - Join with space (implicit AND — all terms must match)
 */
function sanitizeFtsQuery(raw: string): string {
  return raw
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term.replace(/"/g, '')}"`)
    .join(' ');
}

/**
 * searchVersiculos — FTS5-backed BM25 search over versiculos.
 *
 * Uses the external-content virtual table `versiculos_fts` (populated by
 * build-fts.ts). bm25() returns negative values — ORDER BY score ASC puts
 * the most relevant rows first.
 *
 * Short-query guard: returns [] immediately for queries < 3 chars (no DB call).
 * Version filter: applies recurso_id IN (...) on the FTS virtual table.
 * Limit: 60 results (spec FTS-5).
 * Fallback: on any DB error, returns { results: [], error: 'search_unavailable' }.
 */
export async function searchVersiculos(q: string, versions: string[]): Promise<SearchResponse> {
  if (q.trim().length < 3) {
    return { results: [] };
  }

  const sanitized = sanitizeFtsQuery(q);

  if (!sanitized) {
    return { results: [] };
  }

  // Build IN clause placeholders
  const placeholders = versions.map(() => '?').join(', ');

  const sql = `
    SELECT
      v.id,
      bm25(versiculos_fts) AS score,
      v.texto,
      v.capitulo,
      v.versiculo,
      l.nombre AS libro_nombre,
      l.slug AS libro_slug,
      r.slug AS version_slug,
      r.nombre AS version_nombre
    FROM versiculos_fts
    JOIN versiculos v ON v.id = versiculos_fts.rowid
    JOIN recursos r ON r.id = v.recurso_id
    JOIN libros l ON l.id = v.libro_id
    WHERE versiculos_fts MATCH ?
      AND versiculos_fts.recurso_id IN (
        SELECT id FROM recursos WHERE slug IN (${placeholders})
      )
    ORDER BY score ASC
    LIMIT 60
  `;

  try {
    const result = await client.execute({ sql, args: [sanitized, ...versions] });

    const results: SearchResult[] = result.rows.map((row: any) => ({
      version: row.version_slug as string,
      versionNombre: row.version_nombre as string,
      book: row.libro_nombre as string,
      chapter: row.capitulo as number,
      verse: row.versiculo as number,
      text: row.texto as string,
      href: `/biblia/${row.version_slug}/${row.libro_slug}/${row.capitulo}/#v${row.versiculo}`,
    }));

    return { results };
  } catch (err) {
    console.error('searchVersiculos error:', (err as Error).message);
    return { results: [], error: 'search_unavailable' };
  }
}

/**
 * listBibliaVersions — returns available Bible versions from the DB.
 * Replaces the hardcoded VERSIONES_DISPONIBLES array.
 * Used for version validation in /buscar.json and for rendering pills.
 */
export async function listBibliaVersions(): Promise<{ slug: string; nombre: string }[]> {
  const result = await client.execute(
    `SELECT slug, nombre FROM recursos WHERE tipo = 'biblia' ORDER BY slug`,
  );
  return result.rows.map((row: any) => ({
    slug: row.slug as string,
    nombre: row.nombre as string,
  }));
}

// ---------------------------------------------------------------------------
// TSK Cross-References
// ---------------------------------------------------------------------------

export type TskRefTarget = {
  libro: string;
  libro_slug: string;
  capitulo: number;
  versiculo_start: number;
  versiculo_end: number;
};

export type TskReference = {
  versiculo: number;
  referencias: TskRefTarget[];
};

/**
 * listTskForChapter — returns cross-references for a given chapter,
 * grouped by source verse, ordered by target canon order + chapter + verse.
 *
 * Joins tsk_referencias with libros (twice: source + target) to resolve
 * book slugs and names. Runs at build time during getStaticPaths().
 *
 * @param libroSlug - Source book slug (e.g., "genesis")
 * @param capitulo  - Source chapter number
 * @returns References grouped by verse number
 */
export async function listTskForChapter(
  libroSlug: string,
  capitulo: number,
): Promise<TskReference[]> {
  // Resolve source libro ID from slug
  const srcLibro = await db
    .select({ id: libros.id })
    .from(libros)
    .where(eq(libros.slug, libroSlug))
    .get();

  if (!srcLibro) return [];

  const rows = await db
    .select({
      versiculo: tskReferencias.versiculo,
      refLibroNombre: libros.nombre,
      refLibroSlug: libros.slug,
      refCapitulo: tskReferencias.refCapitulo,
      refVersiculoStart: tskReferencias.refVersiculoStart,
      refVersiculoEnd: tskReferencias.refVersiculoEnd,
    })
    .from(tskReferencias)
    .innerJoin(libros, eq(tskReferencias.refLibroId, libros.id))
    .where(
      and(
        eq(tskReferencias.libroId, srcLibro.id),
        eq(tskReferencias.capitulo, capitulo),
      ),
    )
    .orderBy(
      asc(tskReferencias.versiculo),
      asc(tskReferencias.refCapitulo),
      asc(tskReferencias.refVersiculoStart),
    );

  // Group by verse number
  const grouped = new Map<number, TskRefTarget[]>();
  for (const row of rows) {
    let targets = grouped.get(row.versiculo);
    if (!targets) {
      targets = [];
      grouped.set(row.versiculo, targets);
    }
    targets.push({
      libro: row.refLibroNombre,
      libro_slug: row.refLibroSlug,
      capitulo: row.refCapitulo,
      versiculo_start: row.refVersiculoStart,
      versiculo_end: row.refVersiculoEnd,
    });
  }

  return Array.from(grouped, ([versiculo, referencias]) => ({ versiculo, referencias }));
}
