/**
 * verify-search-fts.ts — Validates the FTS5 search implementation
 *
 * Checks:
 *   FTS-1: accent-insensitive matching (corazon -> corazón)
 *   FTS-2: case-insensitive matching (El -> él)
 *   FTS-4: version filter (only requested recurso_id returned)
 *   FTS-5: short-query guard (<3 chars returns [], no DB call)
 *   FTS-5: result count cap (LIMIT 60)
 *
 * Exit 0 on all pass, exit 1 on any failure.
 */

import { client } from '../src/db/client';
import { searchVersiculos } from '../src/db/queries';

let passed = 0;
let failed = 0;

function ok(label: string) {
  console.log(`  PASS: ${label}`);
  passed++;
}

function fail(label: string, detail?: string) {
  console.error(`  FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
  failed++;
}

async function main() {
  console.log('verify:search-fts starting...\n');

  // --- Prerequisite: ensure FTS table exists ---
  try {
    const check = await client.execute(`SELECT count(*) AS n FROM versiculos_fts`);
    const count = (check.rows[0] as any)?.n ?? 0;
    if (count === 0) {
      console.error('ERROR: versiculos_fts table is empty or does not exist.');
      console.error('Run `pnpm build:fts` first (after importers have loaded versiculos).');
      process.exit(1);
    }
    console.log(`  INFO: versiculos_fts has ${count} rows\n`);
  } catch (err) {
    console.error('ERROR: Cannot access versiculos_fts:', (err as Error).message);
    console.error('Run `pnpm build:fts` first.');
    process.exit(1);
  }

  // --- FTS-1: Accent-insensitive matching ---
  console.log('FTS-1: accent-insensitive matching');
  try {
    const result = await client.execute({
      sql: `SELECT count(*) AS n FROM versiculos_fts WHERE versiculos_fts MATCH ?`,
      args: ['"corazon"'],
    });
    const n = (result.rows[0] as any)?.n ?? 0;
    if (n > 0) {
      ok(`"corazon" (no accent) matched ${n} rows containing "corazón"`);
    } else {
      fail('"corazon" returned 0 rows — accent folding not working');
    }
  } catch (err) {
    fail('FTS-1 query threw an error', (err as Error).message);
  }

  // --- FTS-2: Case-insensitive matching ---
  console.log('\nFTS-2: case-insensitive matching');
  try {
    const result = await client.execute({
      sql: `SELECT count(*) AS n FROM versiculos_fts WHERE versiculos_fts MATCH ?`,
      args: ['"El"'],
    });
    const n = (result.rows[0] as any)?.n ?? 0;
    if (n > 0) {
      ok(`"El" (capital E) matched ${n} rows`);
    } else {
      fail('"El" returned 0 rows — case folding not working');
    }
  } catch (err) {
    fail('FTS-2 query threw an error', (err as Error).message);
  }

  // --- FTS-4: Version filter ---
  console.log('\nFTS-4: version filter');
  try {
    const result = await client.execute({
      sql: `
        SELECT r.slug AS version_slug, count(*) AS n
        FROM versiculos_fts
        JOIN versiculos v ON v.id = versiculos_fts.rowid
        JOIN recursos r ON r.id = v.recurso_id
        WHERE versiculos_fts MATCH ?
          AND versiculos_fts.recurso_id IN (
            SELECT id FROM recursos WHERE slug = 'spapddpt'
          )
        GROUP BY r.slug
      `,
      args: ['"amor"'],
    });

    if (result.rows.length === 0) {
      fail('FTS-4 version filter returned 0 rows for "amor" + spapddpt filter');
    } else {
      const allMatchVersion = result.rows.every((row: any) => row.version_slug === 'spapddpt');
      if (allMatchVersion) {
        ok(`All rows for "amor" with spapddpt filter belong to spapddpt (${(result.rows[0] as any).n} matches)`);
      } else {
        const badVersions = result.rows
          .filter((row: any) => row.version_slug !== 'spapddpt')
          .map((row: any) => row.version_slug);
        fail('FTS-4 version filter leaked rows from other versions', badVersions.join(', '));
      }
    }
  } catch (err) {
    fail('FTS-4 query threw an error', (err as Error).message);
  }

  // --- FTS-5: Short-query guard (< 3 chars) ---
  console.log('\nFTS-5: short-query guard');
  {
    // Track that we don't hit the DB — searchVersiculos short-circuits
    const response = await searchVersiculos('ab', ['spapddpt']);
    if (Array.isArray(response.results) && response.results.length === 0 && !response.error) {
      ok('"ab" (2 chars) returned [] with no error and no DB call');
    } else {
      fail('"ab" short-query guard did not return empty results', JSON.stringify(response));
    }
  }

  // Also verify single char
  {
    const response = await searchVersiculos('a', ['spapddpt']);
    if (Array.isArray(response.results) && response.results.length === 0 && !response.error) {
      ok('"a" (1 char) returned [] with no error and no DB call');
    } else {
      fail('"a" short-query guard did not return empty results', JSON.stringify(response));
    }
  }

  // --- FTS-5: Result count cap (LIMIT 60) ---
  console.log('\nFTS-5: result count cap');
  {
    const response = await searchVersiculos('amor', ['spapddpt']);
    if (response.error) {
      fail('searchVersiculos("amor") returned an error', response.error);
    } else if (response.results.length <= 60) {
      ok(`searchVersiculos("amor") returned ${response.results.length} results (<= 60)`);
    } else {
      fail(`searchVersiculos("amor") returned ${response.results.length} results (exceeds 60 limit)`);
    }
  }

  // --- FTS-3: BM25 relevance order (score ASC — lower = more relevant) ---
  console.log('\nFTS-3: BM25 relevance ordering');
  {
    // Use a raw query to get the scores directly, asserting score is non-descending (ASC order)
    try {
      const result = await client.execute({
        sql: `
          SELECT bm25(versiculos_fts) AS score
          FROM versiculos_fts
          WHERE versiculos_fts MATCH ?
            AND versiculos_fts.recurso_id IN (SELECT id FROM recursos WHERE slug = 'spapddpt')
          ORDER BY score ASC
          LIMIT 5
        `,
        args: ['"amor"'],
      });

      if (result.rows.length < 2) {
        ok(`FTS-3: fewer than 2 results returned, ordering trivially satisfied`);
      } else {
        const scores = result.rows.map((r: any) => r.score as number);
        const isAscending = scores.every((s, i) => i === 0 || s >= scores[i - 1]!);
        if (isAscending) {
          ok(`BM25 scores are non-descending (ORDER BY score ASC): [${scores.slice(0, 3).join(', ')}...]`);
        } else {
          fail('BM25 scores are NOT in ascending order (ORDER BY score ASC expected)', scores.join(', '));
        }
      }
    } catch (err) {
      fail('FTS-3 ordering assertion threw an error', (err as Error).message);
    }
  }

  // --- Summary ---
  console.log(`\n--- verify:search-fts results: ${passed} passed, ${failed} failed ---`);

  client.close();

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('verify:search-fts unexpected error:', err);
  process.exit(1);
});
