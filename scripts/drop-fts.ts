/**
 * drop-fts.ts — Drops versiculos_fts before drizzle-kit push
 *
 * drizzle-kit push detects the FTS5 virtual table in sqlite_master on
 * subsequent runs and attempts to DROP its shadow tables individually,
 * which fails because they are managed by SQLite's FTS5 extension.
 *
 * Running this before db:push ensures Drizzle sees a clean schema.
 * The table is recreated by build:fts at the end of the pipeline.
 *
 * Only runs against local.db (never Turso — prepare-build-data exits early
 * when TURSO_CONNECTION_URL is set, so this script is never reached).
 */

import { client } from '../src/db/client';

async function main() {
  try {
    await client.execute('DROP TABLE IF EXISTS versiculos_fts');
    console.log('drop-fts: versiculos_fts dropped (clean slate for drizzle-kit push)');
  } catch (err) {
    // Non-fatal: if the table didn't exist or couldn't be dropped, db:push will handle it
    console.warn('drop-fts: warning —', (err as Error).message);
  } finally {
    client.close();
  }
}

main();
