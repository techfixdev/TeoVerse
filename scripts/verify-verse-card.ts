import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function readFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf-8');
}

function fileExists(relativePath: string): boolean {
  return existsSync(join(process.cwd(), relativePath));
}

// ---------------------------------------------------------------------------
// 1. VerseCard component must exist
// ---------------------------------------------------------------------------
assert(
  fileExists('src/components/biblia/VerseCard.astro'),
  `src/components/biblia/VerseCard.astro does not exist. Extract the inline <li class="verso-card"> block into this component.`,
);

// ---------------------------------------------------------------------------
// 2. [capitulo].astro must NOT contain the inline verso-card markup
// ---------------------------------------------------------------------------
assert(
  fileExists('src/pages/biblia/[version]/[libro]/[capitulo].astro'),
  `[capitulo].astro not found at expected path.`,
);

const capituloSource = readFile('src/pages/biblia/[version]/[libro]/[capitulo].astro');

// The inline <li> with class="verso-card" should no longer exist directly.
// After extraction the page uses <VerseCard ... /> instead.
assert(
  !capituloSource.includes('class="verso-card'),
  `[capitulo].astro still contains the inline 'class="verso-card"' string. Replace the inline <li> block with <VerseCard ... />.`,
);

console.info('verify:verse-card PASSED.');
