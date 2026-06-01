import { db } from '../src/db/client';
import { recursos, diccionarioEntradas } from '../src/db/schema';
import { eq, count } from 'drizzle-orm';
import { getDiccionarioEntrada, listStaticLexiconPaths } from '../src/db/queries';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

async function verifyStrongEndpoint(): Promise<void> {
  // 1. Confirm the strong-es lexicon recurso exists
  const lexicon = await db.select().from(recursos).where(eq(recursos.slug, 'strong-es')).get();
  assert(lexicon !== undefined, 'Expected strong-es recurso to exist.');
  assert(lexicon!.tipo === 'diccionario', `Expected tipo "diccionario" for strong-es, got "${lexicon!.tipo}".`);
  console.info(`  Lexicon recurso: ${lexicon!.nombre} (id=${lexicon!.id})`);

  // 2. Check that diccionario_entradas has stub entries seeded
  const [entriesCountRow] = await db
    .select({ total: count() })
    .from(diccionarioEntradas)
    .innerJoin(recursos, eq(diccionarioEntradas.recursoId, recursos.id))
    .where(eq(recursos.slug, 'strong-es'));
  const totalEntries = entriesCountRow?.total ?? 0;
  assert(totalEntries > 0, `Expected at least 1 diccionario_entradas row for strong-es, got ${totalEntries}.`);
  console.info(`  Lexicon entries count: ${totalEntries}`);

  // 3. Verify known stub entries (seeded in db:seed)
  const h7225 = await getDiccionarioEntrada('H7225', 'strong-es');
  assert(h7225 !== null, 'Expected H7225 (principio) to be in strong-es diccionario_entradas.');
  assert(h7225!.lema === 'principio', `Expected lema "principio" for H7225, got "${h7225!.lema}".`);
  console.info(`  H7225 → lema="${h7225!.lema}", definicion="${h7225!.definicion}"`);

  const h430 = await getDiccionarioEntrada('H430', 'strong-es');
  assert(h430 !== null, 'Expected H430 (Dios) to be in strong-es diccionario_entradas.');
  assert(h430!.lema === 'Dios', `Expected lema "Dios" for H430, got "${h430!.lema}".`);
  console.info(`  H430  → lema="${h430!.lema}"`);

  // 4. Verify a missing code returns null (not an exception)
  const missing = await getDiccionarioEntrada('H9999', 'strong-es');
  assert(missing === null, 'Expected null for a non-existent Strong code.');
  console.info(`  Missing code H9999 → null (correct)`);

  // 5. Verify listStaticLexiconPaths returns entries
  const paths = await listStaticLexiconPaths();
  assert(paths.length > 0, 'Expected at least one lexicon path for static generation.');
  const h7225Path = paths.find((p) => p.codigo === 'H7225' && p.lexiconSlug === 'strong-es');
  assert(h7225Path !== undefined, 'Expected H7225 in listStaticLexiconPaths for strong-es.');
  console.info(`  listStaticLexiconPaths returns ${paths.length} entries.`);

  console.info('verify:strong PASSED.');
}

verifyStrongEndpoint().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
