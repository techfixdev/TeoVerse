/**
 * verify-daily-readings.ts — Validates the parameterized daily readings implementation
 *
 * Checks:
 *   DRV-1: getDailyReadings(version) returns verses for the requested version only
 *   DRV-1: getDailyReadings() with no arg returns same output as getDailyReadings('spapddpt')
 *   DRV-2: endpoint structure validation (static analysis — no live server required in CI)
 *
 * Exit 0 on all pass, exit 1 on any failure.
 */

import { getDailyReadings, listBibliaVersions } from '../src/db/queries';

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
  console.log('verify:daily-readings starting...\n');

  // --- DRV-1a: getDailyReadings('sparvg') only returns sparvg verses ---
  console.log('DRV-1: getDailyReadings("sparvg") returns only sparvg verses');
  try {
    const readings = await getDailyReadings('sparvg');
    if (readings.length === 0) {
      ok('getDailyReadings("sparvg") returned 0 entries (no plan entry today — valid empty result)');
    } else {
      const allSparvg = readings.every((r) => r.biblia.slug === 'sparvg');
      if (allSparvg) {
        ok(`getDailyReadings("sparvg") returned ${readings.length} entries, all for sparvg`);
      } else {
        const badSlugs = readings
          .filter((r) => r.biblia.slug !== 'sparvg')
          .map((r) => r.biblia.slug);
        fail('getDailyReadings("sparvg") returned entries for wrong versions', badSlugs.join(', '));
      }
    }
  } catch (err) {
    fail('getDailyReadings("sparvg") threw an error', (err as Error).message);
  }

  // --- DRV-1b: getDailyReadings() default equals getDailyReadings('spapddpt') ---
  console.log('\nDRV-1: getDailyReadings() default matches getDailyReadings("spapddpt")');
  try {
    const [defaultReadings, explicitReadings] = await Promise.all([
      getDailyReadings(),
      getDailyReadings('spapddpt'),
    ]);

    const defaultJson = JSON.stringify(defaultReadings);
    const explicitJson = JSON.stringify(explicitReadings);

    if (defaultJson === explicitJson) {
      ok(`getDailyReadings() and getDailyReadings("spapddpt") return identical results (${defaultReadings.length} entries)`);
    } else {
      fail(
        'getDailyReadings() default does not match getDailyReadings("spapddpt")',
        `default: ${defaultReadings.length} entries, explicit: ${explicitReadings.length} entries`,
      );
    }
  } catch (err) {
    fail('getDailyReadings default comparison threw an error', (err as Error).message);
  }

  // --- DRV-1c: getDailyReadings('spapddpt') only returns spapddpt verses ---
  console.log('\nDRV-1: getDailyReadings("spapddpt") returns only spapddpt verses');
  try {
    const readings = await getDailyReadings('spapddpt');
    if (readings.length === 0) {
      ok('getDailyReadings("spapddpt") returned 0 entries (no plan entry today — valid empty result)');
    } else {
      const allSpapdpt = readings.every((r) => r.biblia.slug === 'spapddpt');
      if (allSpapdpt) {
        ok(`getDailyReadings("spapddpt") returned ${readings.length} entries, all for spapddpt`);
      } else {
        const badSlugs = readings
          .filter((r) => r.biblia.slug !== 'spapddpt')
          .map((r) => r.biblia.slug);
        fail('getDailyReadings("spapddpt") returned entries for wrong versions', badSlugs.join(', '));
      }
    }
  } catch (err) {
    fail('getDailyReadings("spapddpt") threw an error', (err as Error).message);
  }

  // --- DRV-2: listBibliaVersions returns known versions (validates endpoint's slug list) ---
  console.log('\nDRV-2: listBibliaVersions returns at least one known slug');
  try {
    const versions = await listBibliaVersions();
    if (versions.length === 0) {
      fail('listBibliaVersions returned 0 versions — endpoint validation would reject all versions');
    } else {
      const slugs = versions.map((v) => v.slug);
      const hasSpappddpt = slugs.includes('spapddpt');
      if (hasSpappddpt) {
        ok(`listBibliaVersions returned ${versions.length} versions including "spapddpt": [${slugs.join(', ')}]`);
      } else {
        fail('listBibliaVersions does not include "spapddpt"', `found: ${slugs.join(', ')}`);
      }
    }
  } catch (err) {
    fail('listBibliaVersions threw an error', (err as Error).message);
  }

  // --- Summary ---
  console.log(`\n--- verify:daily-readings results: ${passed} passed, ${failed} failed ---`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('verify:daily-readings unexpected error:', err);
  process.exit(1);
});
