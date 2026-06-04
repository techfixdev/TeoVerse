import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { MENSAJE_BOOKS, MENSAJE_SOURCE } from '../src/importers/mensaje-manifest';
import { recursos, libros, recursoLibros, versiculos } from '../src/db/schema';
import { parseMensajeHtml } from '../src/importers/mensaje-html';

const htmlPath = path.resolve('sources', MENSAJE_SOURCE.slug, MENSAJE_SOURCE.htmlFile);

export async function importMensaje() {
  const html = await readFile(htmlPath, 'utf-8');
  const { verses, booksFound } = parseMensajeHtml(html);

  // Guardia: la fuente trae nombres corruptos; si un alias deja de coincidir, el libro
  // se pierde silenciosamente. Fallamos ruidosamente para detectarlo en el build.
  if (booksFound.length !== MENSAJE_BOOKS.length) {
    const missing = MENSAJE_BOOKS.filter((b) => !booksFound.includes(b.id)).map((b) => b.id);
    throw new Error(
      `El Mensaje: se detectaron ${booksFound.length}/${MENSAJE_BOOKS.length} libros. Faltan: ${missing.join(', ')}.`,
    );
  }

  // Upsert del recurso El Mensaje.
  const [createdRecurso] = await db
    .insert(recursos)
    .values({
      tipo: 'biblia',
      slug: MENSAJE_SOURCE.slug,
      nombre: MENSAJE_SOURCE.name,
      idioma: MENSAJE_SOURCE.language,
      licencia: MENSAJE_SOURCE.license,
      fuente: MENSAJE_SOURCE.source,
    })
    .onConflictDoNothing()
    .returning();

  const recurso =
    createdRecurso ??
    (await db.select().from(recursos).where(eq(recursos.slug, MENSAJE_SOURCE.slug)).get());
  if (!recurso) throw new Error(`Could not create or load recurso ${MENSAJE_SOURCE.slug}.`);

  await db
    .update(recursos)
    .set({
      nombre: MENSAJE_SOURCE.name,
      idioma: MENSAJE_SOURCE.language,
      licencia: MENSAJE_SOURCE.license,
      fuente: MENSAJE_SOURCE.source,
    })
    .where(eq(recursos.id, recurso.id));

  // Reimport limpio: borra versículos y orden canónico previos de este recurso.
  await db.delete(versiculos).where(eq(versiculos.recursoId, recurso.id));
  await db.delete(recursoLibros).where(eq(recursoLibros.recursoId, recurso.id));

  // Agrupa versículos por libro y deduplica por (capítulo, versículo) conservando el primero.
  const versesByBook = new Map<string, Map<string, MensajeRow>>();
  for (const v of verses) {
    let bookMap = versesByBook.get(v.bookId);
    if (!bookMap) {
      bookMap = new Map();
      versesByBook.set(v.bookId, bookMap);
    }
    const key = `${v.chapter}:${v.verse}`;
    if (!bookMap.has(key)) bookMap.set(key, { chapter: v.chapter, verse: v.verse, text: v.text });
  }

  let totalVerses = 0;

  for (const book of MENSAJE_BOOKS) {
    // Reusa el libro canónico (lo crean las otras Biblias); crea si no existe.
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

    // Seed del orden canónico per-recurso.
    await db
      .insert(recursoLibros)
      .values({ recursoId: recurso.id, libroId: libro.id, orden: book.order })
      .onConflictDoNothing();

    const rows = [...(versesByBook.get(book.id)?.values() ?? [])];
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

  console.info(`Imported ${totalVerses} mensaje verses from ${MENSAJE_SOURCE.htmlFile}.`);
}

type MensajeRow = { chapter: number; verse: number; text: string };

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  importMensaje().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
