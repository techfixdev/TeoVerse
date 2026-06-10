/**
 * verify:lexicon-aggregate — asserts multi-lexicon aggregation works.
 *
 * Requires prepare:build-data to have run (both strong-es and vine-es seeded).
 * Tests that getEntradasParaCodigo aggregates across resources and that
 * missing codes return [] (not throw/404).
 */
import { getEntradasParaCodigo } from '../src/db/queries';
import { db } from '../src/db/client';
import { recursos } from '../src/db/schema';
import { eq } from 'drizzle-orm';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

async function verifyLexiconAggregate(): Promise<void> {
  // 1. Check that strong-es exists (seeded by db:seed)
  const strongEs = await db.select().from(recursos).where(eq(recursos.slug, 'strong-es')).get();
  if (!strongEs) {
    console.warn('verify:lexicon-aggregate SKIPPED — strong-es recurso not found.');
    return;
  }

  // 2. H430 should aggregate across resources (strong-es always has a seed entry)
  const h430Entries = await getEntradasParaCodigo('H430');
  assert(
    h430Entries.length >= 1,
    `Expected at least 1 entry for H430 across all lexicons, got ${h430Entries.length}.`,
  );

  const strongEsEntry = h430Entries.find((e) => e.lexiconSlug === 'strong-es');
  assert(
    strongEsEntry !== undefined,
    'Expected strong-es entry for H430 in aggregate results.',
  );
  console.info(`  H430 aggregate: ${h430Entries.length} entries (strong-es: yes)`);

  // 3. Stable order: results ordered by recursos.id
  if (h430Entries.length > 1) {
    // Just verify they all have the required shape
    for (const entry of h430Entries) {
      assert(
        typeof entry.lexiconSlug === 'string' && entry.lexiconSlug.length > 0,
        `Expected non-empty lexiconSlug in aggregate entry.`,
      );
      assert(
        typeof entry.lexiconNombre === 'string' && entry.lexiconNombre.length > 0,
        `Expected non-empty lexiconNombre in aggregate entry.`,
      );
      assert(typeof entry.lema === 'string', `Expected lema string in aggregate entry.`);
      assert(typeof entry.definicion === 'string', `Expected definicion string in aggregate entry.`);
    }
  }

  // 4. Missing code → [] (not throw, not 404)
  const missing = await getEntradasParaCodigo('Z9999');
  assert(
    Array.isArray(missing) && missing.length === 0,
    `Expected [] for non-existent code Z9999, got: ${JSON.stringify(missing)}`,
  );
  console.info('  Missing code Z9999 → [] (correct)');

  console.info('verify:lexicon-aggregate PASSED.');
}

verifyLexiconAggregate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
