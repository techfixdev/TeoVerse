import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { listSelectorManifest } from '../src/db/queries';

// ---------------------------------------------------------------------------
// Canonical reference data
// ---------------------------------------------------------------------------

/**
 * Canonical 66-book slug order (recurso_libros.orden, OT + NT).
 * Source of truth for the bible-versions library; keep in sync with the seed
 * file and the chapter-count map below. Asserted by this gate so a missing
 * or extra book in any Bible version fails the build.
 */
const CANONICAL_BOOK_SLUGS: readonly string[] = [
  'genesis', 'exodo', 'levitico', 'numeros', 'deuteronomio',
  'josue', 'jueces', 'rut', '1-samuel', '2-samuel', '1-reyes', '2-reyes',
  '1-cronicas', '2-cronicas', 'esdras', 'nehemias', 'ester', 'job', 'salmos',
  'proverbios', 'eclesiastes', 'cantar-de-los-cantares', 'isaias', 'jeremias',
  'lamentaciones', 'ezequiel', 'daniel', 'oseas', 'joel', 'amos', 'abdias',
  'jonas', 'miqueas', 'nahum', 'habacuc', 'sofonias', 'hageo', 'zacarias',
  'malaquias', 'mateo', 'marcos', 'lucas', 'juan', 'hechos', 'romanos',
  '1-corintios', '2-corintios', 'galatas', 'efesios', 'filipenses', 'colosenses',
  '1-tesalonicenses', '2-tesalonicenses', '1-timoteo', '2-timoteo', 'tito',
  'filemon', 'hebreos', 'santiago', '1-pedro', '2-pedro', '1-juan', '2-juan',
  '3-juan', 'judas', 'apocalipsis',
];

/**
 * Canonical chapter counts per book. Must contain exactly one key per
 * slug in CANONICAL_BOOK_SLUGS. Asserted by this gate.
 */
const CANONICAL_CHAPTER_COUNTS: Record<string, number> = {
  genesis: 50, exodo: 40, levitico: 27, numeros: 36, deuteronomio: 34,
  josue: 24, jueces: 21, rut: 4, '1-samuel': 31, '2-samuel': 24,
  '1-reyes': 22, '2-reyes': 25, '1-cronicas': 29, '2-cronicas': 36,
  esdras: 10, nehemias: 13, ester: 10, job: 42, salmos: 150,
  proverbios: 31, eclesiastes: 12, 'cantar-de-los-cantares': 8,
  isaias: 66, jeremias: 52, lamentaciones: 5, ezequiel: 48, daniel: 12,
  oseas: 14, joel: 3, amos: 9, abdias: 1, jonas: 4, miqueas: 7, nahum: 3,
  habacuc: 3, sofonias: 3, hageo: 2, zacarias: 14, malaquias: 4, mateo: 28,
  marcos: 16, lucas: 24, juan: 21, hechos: 28, romanos: 16,
  '1-corintios': 16, '2-corintios': 13, galatas: 6, efesios: 6,
  filipenses: 4, colosenses: 4, '1-tesalonicenses': 5,
  '2-tesalonicenses': 3, '1-timoteo': 6, '2-timoteo': 4, tito: 3,
  filemon: 1, hebreos: 13, santiago: 5, '1-pedro': 5, '2-pedro': 3,
  '1-juan': 5, '2-juan': 1, '3-juan': 1, judas: 1, apocalipsis: 22,
};

const CANONICAL_VERSION_SLUGS = ['spapddpt', 'sparvg', 'spaRV1909', 'mensaje', 'ntv'] as const;
const EXPECTED_TOTAL_CHAPTERS = CANONICAL_VERSION_SLUGS.length *
  Object.values(CANONICAL_CHAPTER_COUNTS).reduce((sum, count) => sum + count, 0);
const MAX_GZIPPED_BYTES = 80 * 1024;
const MANIFEST_DIST_PATH = join(process.cwd(), 'dist', 'datos', 'biblioteca.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

function arrEq(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

async function verifySelectorManifest(): Promise<void> {
  // 1. listSelectorManifest returns and is well-shaped.
  const manifest = await listSelectorManifest();

  // 2. Exactly 4 versions, slugs match the canonical set (order independent).
  assert(
    manifest.versions.length === CANONICAL_VERSION_SLUGS.length,
    `Expected ${CANONICAL_VERSION_SLUGS.length} versions in selector manifest, got ${manifest.versions.length}.`,
  );

  const actualSlugs = manifest.versions.map((v) => v.slug).sort();
  const expectedSlugs = [...CANONICAL_VERSION_SLUGS].sort();
  assert(
    arrEq(actualSlugs, expectedSlugs),
    `Expected version slugs ${expectedSlugs.join(',')}, got ${actualSlugs.join(',')}.`,
  );

  // 3. Every version exposes 66 books in canonical order, every book has
  //    abreviatura populated and capitulos == [1..CANONICAL_CHAPTER_COUNTS[slug]].
  let totalCapitulos = 0;

  for (const version of manifest.versions) {
    assert(
      version.libros.length === CANONICAL_BOOK_SLUGS.length,
      `Expected version ${version.slug} to expose ${CANONICAL_BOOK_SLUGS.length} books, got ${version.libros.length}.`,
    );

    assert(
      version.abreviatura.length > 0,
      `Expected version ${version.slug} to expose a non-empty abreviatura.`,
    );

    for (let i = 0; i < version.libros.length; i++) {
      const book = version.libros[i];
      const canonicalSlug = CANONICAL_BOOK_SLUGS[i];

      assert(
        book.slug === canonicalSlug,
        `Expected ${version.slug} book[${i}] slug "${canonicalSlug}", got "${book.slug}".`,
      );

      assert(
        book.abreviatura.length > 0,
        `Expected ${version.slug}/${book.slug} to expose a non-empty abreviatura.`,
      );

      const expectedCount = CANONICAL_CHAPTER_COUNTS[book.slug];
      const expectedCapitulos = Array.from({ length: expectedCount }, (_, j) => j + 1);

      assert(
        arrEq(book.capitulos, expectedCapitulos),
        `Expected ${version.slug}/${book.slug} capitulos to equal [1..${expectedCount}], got [${book.capitulos.slice(0, 5).join(',')}${book.capitulos.length > 5 ? ',…' : ''}] (length ${book.capitulos.length}).`,
      );

      totalCapitulos += book.capitulos.length;
    }
  }

  // 4. Total chapter count across all versions matches the canonical sum.
  assert(
    totalCapitulos === EXPECTED_TOTAL_CHAPTERS,
    `Expected total chapter count ${EXPECTED_TOTAL_CHAPTERS}, got ${totalCapitulos}.`,
  );

  console.info(`  Selector manifest: ${manifest.versions.length} versions, ${totalCapitulos} total chapters.`);

  // 5. (Gated) dist size check — only runs under SDD_FULL_VERIFY=1 AND when
  //    the prerendered artifact exists (chain runs this script before
  //    build:astro, so the file is absent in normal `pnpm verify`).
  if (process.env.SDD_FULL_VERIFY === '1') {
    assert(
      existsSync(MANIFEST_DIST_PATH),
      `Expected ${MANIFEST_DIST_PATH} to exist under SDD_FULL_VERIFY=1 (run pnpm build first).`,
    );

    const raw = readFileSync(MANIFEST_DIST_PATH);
    const gzipped = gzipSync(raw, { level: 9 });

    console.info(`  dist/datos/biblioteca.json: ${raw.length} bytes raw, ${gzipped.length} bytes gzipped.`);

    assert(
      gzipped.length <= MAX_GZIPPED_BYTES,
      `dist/datos/biblioteca.json gzipped size ${gzipped.length} exceeds NFR-001 ceiling of ${MAX_GZIPPED_BYTES} bytes.`,
    );
  } else {
    console.info('  Skipping dist size check (set SDD_FULL_VERIFY=1 to enable).');
  }
}

verifySelectorManifest().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
