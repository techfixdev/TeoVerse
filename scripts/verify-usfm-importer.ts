import { and, eq, notInArray } from 'drizzle-orm';
import { db } from '../src/db/client';
import { recursos, libros, recursoLibros, versiculos, versiculosTokens } from '../src/db/schema';
import { importUsfmBook } from './import-usfm';

const fixturePath = new URL('../fixtures/usfm/spapddpt-genesis-1.usfm', import.meta.url);

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} Expected ${String(expected)}, got ${String(actual)}.`);
  }
}

async function verifyUsfmImporter() {
  await cleanupFixtureImport();

  try {
    const result = await importUsfmBook({
      filePath: fixturePath,
      bible: {
        slug: 'spapddpt-fixture',
        name: 'Palabra de Dios para ti Fixture',
        language: 'es',
        license: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
        source: 'eBible.org fixture derived from https://ebible.org/find/details.php?id=spapddpt',
      },
      book: {
        testament: 'AT',
        name: 'Génesis Fixture',
        slug: 'genesis-fixture',
        abbreviation: 'Gn',
        order: 101,
      },
    });

    assertEqual(result.bibleSlug, 'spapddpt-fixture', 'Expected importer to report imported Bible slug.');
    assertEqual(result.bookSlug, 'genesis-fixture', 'Expected importer to report imported book slug.');
    assertEqual(result.verseCount, 5, 'Expected importer to report fixture verse count.');

    const recurso = await db.select().from(recursos).where(eq(recursos.slug, 'spapddpt-fixture')).get();
    if (!recurso) throw new Error('Expected importer to insert the fixture recurso row.');

    assertEqual(recurso.tipo, 'biblia', 'Expected importer to set tipo biblia on the fixture recurso.');
    assertEqual(recurso.licencia.includes('CC BY 4.0'), true, 'Expected importer to preserve CC BY 4.0 license.');
    assertEqual(
      recurso.fuente.includes('https://ebible.org/find/details.php?id=spapddpt'),
      true,
      'Expected importer to preserve source attribution metadata.',
    );

    const libro = await db.select().from(libros).where(eq(libros.slug, 'genesis-fixture')).get();
    if (!libro) throw new Error('Expected importer to insert the fixture book row.');

    const importedVerses = await db
      .select()
      .from(versiculos)
      .where(eq(versiculos.recursoId, recurso.id));

    assertEqual(importedVerses.length, 5, 'Expected importer to insert five fixture verses without duplicates.');
    assertEqual(
      importedVerses.find((verse) => verse.versiculo === 1)?.texto,
      'En un principio ʼElohim creó los cielos y la tierra.',
      'Expected importer to persist parsed verse text.',
    );

    await importUsfmBook({
      filePath: fixturePath,
      bible: {
        slug: 'spapddpt-fixture',
        name: 'Palabra de Dios para ti Fixture',
        language: 'es',
        license: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
        source: 'eBible.org fixture derived from https://ebible.org/find/details.php?id=spapddpt',
      },
      book: {
        testament: 'AT',
        name: 'Génesis Fixture',
        slug: 'genesis-fixture',
        abbreviation: 'Gn',
        order: 101,
      },
    });

    const afterSecondImport = await db
      .select()
      .from(versiculos)
      .where(eq(versiculos.recursoId, recurso.id));

    assertEqual(afterSecondImport.length, 5, 'Expected repeated fixture import to avoid duplicate verses.');

    // Verificar que no quedan tokens huérfanos tras la re-importación.
    // Un token huérfano es aquel cuyo versiculo_id no existe en la tabla versiculos.
    // Si ON DELETE CASCADE no funcionara (PRAGMA foreign_keys OFF) y la limpieza explícita
    // tampoco se aplicara, el segundo import dejaría tokens con IDs del primer import que
    // ya no existen en versiculos.
    const allVersiculoIds = (await db.select({ id: versiculos.id }).from(versiculos)).map((r) => r.id);
    let orphanCount = 0;
    if (allVersiculoIds.length > 0) {
      const orphans = await db
        .select({ id: versiculosTokens.id })
        .from(versiculosTokens)
        .where(notInArray(versiculosTokens.versiculoId, allVersiculoIds));
      orphanCount = orphans.length;
    } else {
      // Si no hay versículos, cualquier token sería huérfano — pero eso no debería ocurrir
      const allTokens = await db.select({ id: versiculosTokens.id }).from(versiculosTokens);
      orphanCount = allTokens.length;
    }
    assertEqual(orphanCount, 0, `Re-import should leave zero orphaned versiculos_tokens (found ${orphanCount}).`);

    // Assert recurso_libros row exists with the correct orden for this (recurso, libro) pair.
    const recursoLibroRow = await db
      .select()
      .from(recursoLibros)
      .where(and(eq(recursoLibros.recursoId, recurso.id), eq(recursoLibros.libroId, libro.id)))
      .get();
    if (!recursoLibroRow) {
      throw new Error('Expected importer to insert a recurso_libros row for the fixture (recurso, libro) pair.');
    }
    assertEqual(recursoLibroRow.orden, 101, 'Expected recurso_libros.orden to match the fixture book order.');
  } finally {
    await cleanupFixtureImport();
  }
}

async function cleanupFixtureImport() {
  await db.delete(recursos).where(eq(recursos.slug, 'spapddpt-fixture'));
  await db.delete(libros).where(eq(libros.slug, 'genesis-fixture'));
}

verifyUsfmImporter().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
