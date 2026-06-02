import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { eq } from 'drizzle-orm';
import { unzipSync, strFromU8 } from 'fflate';
import { db } from '../src/db/client';
import { SPARVG_BOOKS, SPARVG_SOURCE } from '../src/importers/sparvg-manifest';
import { recursos, libros, recursoLibros, versiculos } from '../src/db/schema';
import { parseUsfmBook } from '../src/importers/usfm';

const sourceDir = path.resolve('sources', SPARVG_SOURCE.slug);
const zipPath = path.join(sourceDir, 'sparvg_usfm.zip');

export async function importSparvg() {
  const zip = await readOrDownloadZip();
  const entries = unzipSync(new Uint8Array(zip));

  // Upsert the sparvg Bible recurso
  const [createdRecurso] = await db
    .insert(recursos)
    .values({
      tipo: 'biblia',
      slug: SPARVG_SOURCE.slug,
      nombre: SPARVG_SOURCE.name,
      idioma: SPARVG_SOURCE.language,
      licencia: SPARVG_SOURCE.license,
      fuente: SPARVG_SOURCE.source,
    })
    .onConflictDoNothing()
    .returning();

  const recurso =
    createdRecurso ??
    (await db.select().from(recursos).where(eq(recursos.slug, SPARVG_SOURCE.slug)).get());
  if (!recurso) throw new Error(`Could not create or load recurso ${SPARVG_SOURCE.slug}.`);

  await db
    .update(recursos)
    .set({
      nombre: SPARVG_SOURCE.name,
      idioma: SPARVG_SOURCE.language,
      licencia: SPARVG_SOURCE.license,
      fuente: SPARVG_SOURCE.source,
    })
    .where(eq(recursos.id, recurso.id));

  // Delete existing verses and recurso_libros for this recurso before re-import
  await db.delete(versiculos).where(eq(versiculos.recursoId, recurso.id));
  await db.delete(recursoLibros).where(eq(recursoLibros.recursoId, recurso.id));

  let totalVerses = 0;

  for (const book of SPARVG_BOOKS) {
    const entryName = Object.keys(entries).find((name) => name.endsWith(`${book.id}${SPARVG_SOURCE.slug}.usfm`));
    if (!entryName) throw new Error(`Missing USFM file for ${book.id}.`);

    const parsed = parseUsfmBook(strFromU8(entries[entryName]));
    if (parsed.book.id !== book.id) {
      throw new Error(`Expected ${entryName} to contain ${book.id}, got ${parsed.book.id}.`);
    }

    // Upsert libro — identity-only, no orden column
    const [createdLibro] = await db
      .insert(libros)
      .values({
        testamento: book.testament,
        nombre: book.name,
        slug: book.slug,
        abreviatura: book.abbreviation,
      })
      .onConflictDoNothing()
      .returning();

    const libro =
      createdLibro ?? (await db.select().from(libros).where(eq(libros.slug, book.slug)).get());
    if (!libro) throw new Error(`Could not create or load book ${book.slug}.`);

    await db
      .update(libros)
      .set({ testamento: book.testament, nombre: book.name, abreviatura: book.abbreviation })
      .where(eq(libros.id, libro.id));

    // Seed per-resource canon order via recurso_libros
    await db
      .insert(recursoLibros)
      .values({ recursoId: recurso.id, libroId: libro.id, orden: book.order })
      .onConflictDoNothing();

    const cleanVerses = parsed.verses.filter((verse) => verse.text.length > 0);

    for (const chunk of chunkArray(cleanVerses, 350)) {
      await db.insert(versiculos).values(
        chunk.map((verse) => ({
          recursoId: recurso.id,
          libroId: libro.id,
          capitulo: verse.chapter,
          versiculo: verse.verse,
          texto: verse.text,
        })),
      );
    }

    totalVerses += cleanVerses.length;
  }

  console.info(`Imported ${totalVerses} sparvg verses from ${SPARVG_SOURCE.usfmZipUrl}.`);
}

async function readOrDownloadZip(): Promise<Buffer> {
  try {
    return await readFile(zipPath);
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
  }

  const response = await fetch(SPARVG_SOURCE.usfmZipUrl);
  if (!response.ok) {
    throw new Error(`Failed to download ${SPARVG_SOURCE.usfmZipUrl}: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(sourceDir, { recursive: true });
  await writeFile(zipPath, buffer);
  return buffer;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  importSparvg().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
