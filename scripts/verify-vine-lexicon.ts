/**
 * verify:vine-lexicon — DB-guarded assertions for the Vine lexicon import.
 *
 * Requires prepare:build-data to have run (vine-es entries in DB).
 * Gracefully skips if vine-es has 0 entries (CI without source files).
 */
import { db } from '../src/db/client';
import { recursos, diccionarioEntradas } from '../src/db/schema';
import { eq, count } from 'drizzle-orm';
import { getEntradasParaCodigo, listAllLexiconCodes } from '../src/db/queries';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

async function verifyVineLexicon(): Promise<void> {
  // 1. Check vine-es recurso exists
  const vineRecurso = await db.select().from(recursos).where(eq(recursos.slug, 'vine-es')).get();

  if (!vineRecurso) {
    console.warn('verify:vine-lexicon SKIPPED — vine-es recurso not found (source files missing?).');
    return;
  }

  assert(vineRecurso.tipo === 'diccionario', `Expected tipo "diccionario" for vine-es, got "${vineRecurso.tipo}".`);
  console.info(`  Vine recurso: ${vineRecurso.nombre} (id=${vineRecurso.id})`);

  // 2. Check entry count
  const [countRow] = await db
    .select({ total: count() })
    .from(diccionarioEntradas)
    .where(eq(diccionarioEntradas.recursoId, vineRecurso.id));

  const totalEntries = countRow?.total ?? 0;
  assert(totalEntries > 0, `Expected vine-es entries > 0, got ${totalEntries}.`);
  console.info(`  Vine entries: ${totalEntries}`);

  // 3. Multi-code article: one article → multiple rows for same definicion
  //    H1 (PADRE) is a well-known Vine entry
  const h1Entries = await getEntradasParaCodigo('H1');
  const vineH1 = h1Entries.filter((e) => e.lexiconSlug === 'vine-es');
  assert(vineH1.length >= 1, `Expected at least 1 vine-es entry for H1, got ${vineH1.length}.`);
  console.info(`  H1 vine-es entries: ${vineH1.length}`);

  // 4. No residual RTF in definitions
  for (const entry of vineH1) {
    assert(
      !entry.definicion.includes('\\'),
      `Residual RTF backslash in H1 definition: ${entry.definicion.slice(0, 100)}`,
    );
    assert(
      !entry.definicion.includes('{\\'),
      `Residual RTF brace group in H1 definition: ${entry.definicion.slice(0, 100)}`,
    );
  }

  // 5. listAllLexiconCodes returns codes from vine-es
  const allCodes = await listAllLexiconCodes();
  assert(allCodes.length > 0, 'Expected listAllLexiconCodes() to return codes.');
  assert(
    allCodes.includes('H1'),
    `Expected H1 in listAllLexiconCodes(), got ${allCodes.length} codes.`,
  );
  console.info(`  Distinct lexicon codes: ${allCodes.length}`);

  console.info('verify:vine-lexicon PASSED.');
}

verifyVineLexicon().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
