import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { and, eq, inArray } from 'drizzle-orm';
import { unzipSync, strFromU8 } from 'fflate';
import { db } from '../src/db/client';
import { SPARV1909_BOOKS, SPARV1909_SOURCE } from '../src/importers/sparv1909-manifest';
import { biblias, libros, versiculos } from '../src/db/schema';
import { parseUsfmBook } from '../src/importers/usfm';

const sourceDir = path.resolve('sources', SPARV1909_SOURCE.slug);
const zipPath = path.join(sourceDir, 'spaRV1909_usfm.zip');

export async function importSparv1909() {
  const zip = await readOrDownloadZip();
  const entries = unzipSync(new Uint8Array(zip));

  const [createdBiblia] = await db
    .insert(biblias)
    .values({
      slug: SPARV1909_SOURCE.slug,
      nombre: SPARV1909_SOURCE.name,
      idioma: SPARV1909_SOURCE.language,
      licencia: SPARV1909_SOURCE.license,
      fuente: SPARV1909_SOURCE.source,
    })
    .onConflictDoNothing()
    .returning();

  const biblia = createdBiblia ?? (await db.select().from(biblias).where(eq(biblias.slug, SPARV1909_SOURCE.slug)).get());
  if (!biblia) throw new Error(`Could not create or load Bible ${SPARV1909_SOURCE.slug}.`);

  await db
    .update(biblias)
    .set({
      nombre: SPARV1909_SOURCE.name,
      idioma: SPARV1909_SOURCE.language,
      licencia: SPARV1909_SOURCE.license,
      fuente: SPARV1909_SOURCE.source,
    })
    .where(eq(biblias.id, biblia.id));

  await db.delete(versiculos).where(eq(versiculos.bibliaId, biblia.id));

  let totalVerses = 0;

  for (const book of SPARV1909_BOOKS) {
    const entryName = Object.keys(entries).find((name) => name.endsWith(`${book.id}${SPARV1909_SOURCE.slug}.usfm`));
    if (!entryName) throw new Error(`Missing USFM file for ${book.id}.`);

    const parsed = parseUsfmBook(strFromU8(entries[entryName]));
    if (parsed.book.id !== book.id) {
      throw new Error(`Expected ${entryName} to contain ${book.id}, got ${parsed.book.id}.`);
    }

    const [createdLibro] = await db
      .insert(libros)
      .values({
        testamento: book.testament,
        nombre: book.name,
        slug: book.slug,
        abreviatura: book.abbreviation,
        orden: book.order,
      })
      .onConflictDoNothing()
      .returning();

    const libro = createdLibro ?? (await db.select().from(libros).where(eq(libros.slug, book.slug)).get());
    if (!libro) throw new Error(`Could not create or load book ${book.slug}.`);

    await db
      .update(libros)
      .set({ testamento: book.testament, nombre: book.name, abreviatura: book.abbreviation, orden: book.order })
      .where(eq(libros.id, libro.id));

    const cleanVerses = parsed.verses.filter((verse) => verse.text.length > 0);

    for (const chunk of chunkArray(cleanVerses, 350)) {
      await db.insert(versiculos).values(
        chunk.map((verse) => ({
          bibliaId: biblia.id,
          libroId: libro.id,
          capitulo: verse.chapter,
          versiculo: verse.verse,
          texto: verse.text,
        })),
      );
    }

    totalVerses += cleanVerses.length;
  }

  await removeNonCanonicalSparv1909Books();

  console.info(`Imported ${totalVerses} spaRV1909 verses from ${SPARV1909_SOURCE.usfmZipUrl}.`);
}

async function readOrDownloadZip(): Promise<Buffer> {
  try {
    return await readFile(zipPath);
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
  }

  const response = await fetch(SPARV1909_SOURCE.usfmZipUrl);
  if (!response.ok) {
    throw new Error(`Failed to download ${SPARV1909_SOURCE.usfmZipUrl}: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(sourceDir, { recursive: true });
  await writeFile(zipPath, buffer);
  return buffer;
}

async function removeNonCanonicalSparv1909Books() {
  const canonicalSlugs = SPARV1909_BOOKS.map((book) => book.slug);
  const sparv1909VerseRows = await db
    .select({ libroId: versiculos.libroId })
    .from(versiculos)
    .where(eq(versiculos.bibliaId, (await db.select().from(biblias).where(eq(biblias.slug, SPARV1909_SOURCE.slug)).get())!.id))
    .groupBy(versiculos.libroId);

  const sparv1909BookIds = sparv1909VerseRows.map((row) => row.libroId);
  if (sparv1909BookIds.length === 0) return;

  const nonCanonicalRows = await db
    .select({ id: libros.id })
    .from(libros)
    .where(and(inArray(libros.id, sparv1909BookIds), inArray(libros.slug, canonicalSlugs)));

  if (nonCanonicalRows.length !== SPARV1909_BOOKS.length) {
    throw new Error(`Expected ${SPARV1909_BOOKS.length} canonical spaRV1909 books, got ${nonCanonicalRows.length}.`);
  }
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  importSparv1909().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
