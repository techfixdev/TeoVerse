import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../src/db/client';
import { recursos, libros, recursoLibros, versiculos, versiculosTokens } from '../src/db/schema';
import { NTV_BOOKS, NTV_SOURCE } from '../src/importers/ntv-manifest';
import { parseBblx } from '../src/importers/bblx';

const bblxPath = path.resolve('sources', NTV_SOURCE.slug, NTV_SOURCE.bblxFile);

export async function importNtv() {
  // Guard: skip gracefully if source file is not available (e.g. CI without local data).
  if (!existsSync(bblxPath)) {
    console.warn(
      `[import:ntv] Source file not found: ${bblxPath}\n` +
        `Skipping NTV import. Copy the .bblx file to sources/ntv/NTV.bblx to enable.`,
    );
    return;
  }

  const { verses } = parseBblx(bblxPath);

  // Guard: NTV must have all 66 books.
  const booksFound = new Set(verses.map((v) => v.book));
  if (booksFound.size !== NTV_BOOKS.length) {
    const missing = NTV_BOOKS.filter((b) => !booksFound.has(b.order)).map((b) => b.id);
    throw new Error(
      `[import:ntv] Expected ${NTV_BOOKS.length} books, found ${booksFound.size}. Missing: ${missing.join(', ')}.`,
    );
  }

  // Upsert recurso NTV.
  const [createdRecurso] = await db
    .insert(recursos)
    .values({
      tipo: 'biblia',
      slug: NTV_SOURCE.slug,
      nombre: NTV_SOURCE.name,
      idioma: NTV_SOURCE.language,
      licencia: NTV_SOURCE.license,
      fuente: NTV_SOURCE.source,
    })
    .onConflictDoNothing()
    .returning();

  const recurso =
    createdRecurso ??
    (await db.select().from(recursos).where(eq(recursos.slug, NTV_SOURCE.slug)).get());
  if (!recurso) throw new Error(`[import:ntv] Could not create or load recurso ${NTV_SOURCE.slug}.`);

  await db
    .update(recursos)
    .set({
      nombre: NTV_SOURCE.name,
      idioma: NTV_SOURCE.language,
      licencia: NTV_SOURCE.license,
      fuente: NTV_SOURCE.source,
    })
    .where(eq(recursos.id, recurso.id));

  // Idempotent re-import: delete existing NTV tokens, versiculos, and recursoLibros.
  // ON DELETE CASCADE is unreliable in SQLite without PRAGMA foreign_keys = ON (default: OFF).
  const versiculosParaBorrar = await db
    .select({ id: versiculos.id })
    .from(versiculos)
    .where(eq(versiculos.recursoId, recurso.id));

  if (versiculosParaBorrar.length > 0) {
    const ids = versiculosParaBorrar.map((v) => v.id);
    for (let i = 0; i < ids.length; i += 900) {
      await db.delete(versiculosTokens).where(inArray(versiculosTokens.versiculoId, ids.slice(i, i + 900)));
    }
  }

  await db.delete(versiculos).where(eq(versiculos.recursoId, recurso.id));
  await db.delete(recursoLibros).where(eq(recursoLibros.recursoId, recurso.id));

  // Group verses by book number.
  const versesByBook = new Map<number, typeof verses>();
  for (const v of verses) {
    let bookVerses = versesByBook.get(v.book);
    if (!bookVerses) {
      bookVerses = [];
      versesByBook.set(v.book, bookVerses);
    }
    bookVerses.push(v);
  }

  let totalVerses = 0;

  for (const book of NTV_BOOKS) {
    // Reuse canonical libro (created by other Bibles); create if missing.
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
    if (!libro) throw new Error(`[import:ntv] Could not create or load book ${book.slug}.`);

    // Seed per-resource canonical order.
    await db
      .insert(recursoLibros)
      .values({ recursoId: recurso.id, libroId: libro.id, orden: book.order })
      .onConflictDoNothing();

    const rows = versesByBook.get(book.order) ?? [];
    for (const chunk of chunkArray(rows, 350)) {
      await db
        .insert(versiculos)
        .values(
          chunk.map((row) => ({
            recursoId: recurso.id,
            libroId: libro.id,
            capitulo: row.chapter,
            versiculo: row.verse,
            texto: row.text,
          })),
        )
        .onConflictDoNothing();
    }

    totalVerses += rows.length;
  }

  console.info(`[import:ntv] Imported ${totalVerses} NTV verses from ${NTV_SOURCE.bblxFile}.`);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  importNtv().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
