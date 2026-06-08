/**
 * PR 1 Foundation verification gate.
 *
 * Asserts that the verse-highlight foundation layer is correctly in place:
 * 1. Store exports exist in src/stores/highlight.ts
 * 2. Tailwind config has highlight color tokens
 * 3. CSS custom properties defined in global.css
 * 4. Verse markup in chapter page has data attributes and verso-card class
 *
 * Run: pnpm verify:pr1-foundation
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

function readFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), 'utf-8');
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

function verifyHighlightStore(): void {
  const src = readFile('src/stores/highlight.ts');

  assert(src.includes("export type ColorId"), 'Missing ColorId type export');
  assert(src.includes("'amarillo'") && src.includes("'violeta'"), 'COLORS array missing color entries');
  assert(src.includes('export const COLORS'), 'Missing COLORS array export');
  assert(src.includes('export type HighlightMap'), 'Missing HighlightMap type export');
  assert(src.includes('export const HIGHLIGHT_KEY'), 'Missing HIGHLIGHT_KEY constant export');
  assert(src.includes('export const ACTIVE_COLOR_KEY'), 'Missing ACTIVE_COLOR_KEY constant export');
  assert(src.includes("export const $highlight"), 'Missing $highlight store export');
  assert(src.includes("export const $colorActivo"), 'Missing $colorActivo store export');
  assert(src.includes('persistentJSON'), '$highlight/$colorActivo must use persistentJSON');
  assert(src.includes("'rv:highlights'"), 'HIGHLIGHT_KEY must be rv:highlights');
  assert(src.includes("'rv:active-color'"), 'ACTIVE_COLOR_KEY must be rv:active-color');

  console.info('  ✓ highlight store: all exports and keys present');
}

function verifyTailwindConfig(): void {
  const src = readFile('tailwind.config.mjs');

  const expectedColors = ['amarillo', 'verde', 'rosa', 'azul', 'naranja', 'violeta'];

  assert(src.includes('highlight:'), 'Missing highlight color group in tailwind config');

  for (const color of expectedColors) {
    assert(
      src.includes(`${color}:`) && src.includes(`var(--hl-${color})`),
      `Missing highlight color "${color}" with CSS var reference in tailwind config`,
    );
  }

  console.info('  ✓ tailwind config: all 6 highlight colors defined');
}

function verifyCssVariables(): void {
  const src = readFile('src/styles/global.css');

  const expectedVars = [
    '--hl-amarillo', '--hl-verde', '--hl-rosa',
    '--hl-azul', '--hl-naranja', '--hl-violeta',
  ];

  // Check :root block (light mode)
  for (const v of expectedVars) {
    assert(src.includes(v), `Missing CSS custom property ${v} in global.css`);
  }

  // Check dark mode overrides exist (dark values differ from light)
  assert(
    src.includes('.dark') && /--hl-amarillo:\s*#78350F/.test(src),
    'Missing dark mode --hl-amarillo override',
  );
  assert(
    /--hl-violeta:\s*#4C1D95/.test(src),
    'Missing dark mode --hl-violeta override',
  );

  console.info('  ✓ global.css: all CSS custom properties defined (light + dark)');
}

function verifyVersoCardStyles(): void {
  const src = readFile('src/styles/global.css');

  assert(src.includes('.verso-card'), 'Missing .verso-card base styles');
  assert(src.includes('position: relative'), '.verso-card must have position: relative');
  assert(src.includes('z-index: 0'), '.verso-card must have z-index: 0');

  console.info('  ✓ global.css: .verso-card base styles present');
}

function verifyVerseMarkup(): void {
  const src = readFile('src/pages/biblia/[version]/[libro]/[capitulo].astro');

  assert(
    src.includes('verso-card'),
    'Missing verso-card class on verse <li> elements',
  );
  assert(
    src.includes('data-verso='),
    'Missing data-verso attribute on verse <li> elements',
  );
  assert(
    src.includes('data-has-strong='),
    'Missing data-has-strong attribute on verse <li> elements',
  );

  // Verify verse key format: {libro}:{capitulo}:{verso}
  assert(
    src.includes('${libro}:${capitulo}:${run.startVerse}'),
    'Verse key must use {libro}:{capitulo}:{startVerse} format',
  );

  console.info('  ✓ chapter page: verse markup has verso-card, data-verso, data-has-strong');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function verifyPr1Foundation(): Promise<void> {
  console.info('PR 1 Foundation verification...\n');

  verifyHighlightStore();
  verifyTailwindConfig();
  verifyCssVariables();
  verifyVersoCardStyles();
  verifyVerseMarkup();

  console.info('\n✅ PR 1 Foundation: all assertions passed.');
}

verifyPr1Foundation().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
