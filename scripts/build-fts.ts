/**
 * build-fts.ts — FTS5 index builder for versiculos_fts
 *
 * Applies the external-content FTS5 DDL idempotently and populates the index.
 * DB target is resolved automatically:
 *   - TURSO_CONNECTION_URL set → Turso (prod/staging)
 *   - not set → file:local.db
 *
 * Usage:
 *   pnpm build:fts
 *
 * IMPORTANT: Run AFTER all importers have loaded versiculos (importers
 * DELETE+reinsert per resource, making versiculos.id unstable until done).
 * Running rebuild before importers finish produces a stale or empty FTS index.
 */

import { client } from '../src/db/client';

async function main() {
  console.log('build-fts: starting FTS5 index build...');

  try {
    // Step 1: Drop existing table (idempotent)
    await client.execute('DROP TABLE IF EXISTS versiculos_fts');
    console.log('build-fts: dropped versiculos_fts (if existed)');

    // Step 2: Create external-content FTS5 virtual table
    // recurso_id is UNINDEXED (not tokenized) — stored for version filtering
    // tokenize unicode61 remove_diacritics 2 — accent + case insensitive (FTS-1, FTS-2)
    await client.execute(`
      CREATE VIRTUAL TABLE versiculos_fts USING fts5(
        texto,
        recurso_id UNINDEXED,
        content='versiculos',
        content_rowid='id',
        tokenize='unicode61 remove_diacritics 2'
      )
    `);
    console.log('build-fts: created versiculos_fts virtual table');

    // Step 3: Rebuild from external content
    // This reads all rows from versiculos and populates the FTS index.
    // Must be the LAST operation — all importers must have finished before this.
    await client.execute(`INSERT INTO versiculos_fts(versiculos_fts) VALUES('rebuild')`);
    console.log('build-fts: FTS index rebuild complete');

    // Step 4: Quick sanity check
    const countResult = await client.execute('SELECT count(*) AS n FROM versiculos_fts');
    const count = (countResult.rows[0] as any)?.n ?? 0;
    console.log(`build-fts: index contains ${count} rows`);

    if (count === 0) {
      console.error('build-fts: WARNING — index is empty. Did importers run first?');
      process.exit(1);
    }

    console.log('build-fts: done.');
  } catch (err) {
    console.error('build-fts: FAILED —', (err as Error).message);
    process.exit(1);
  } finally {
    client.close();
  }
}

main();
