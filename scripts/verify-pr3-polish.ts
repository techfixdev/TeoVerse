/**
 * PR 3 Polish verification gate.
 *
 * Asserts that the verse-highlight polish layer is correctly in place:
 * 1. ColorPicker component exists with correct structure
 * 2. Strong differentiation styles (.verso-card--has-strong with diagonal stripes)
 * 3. Chapter page conditionally applies verso-card--has-strong class
 * 4. HighlightClickProxy activates card mode on first verse tap
 * 5. WorkspaceLayout mounts ColorPicker in header
 * 6. Color picker visibility CSS rule (hidden until card mode)
 *
 * Run: pnpm verify:pr3-polish
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

function verifyColorPicker(): void {
  const src = readFile('src/components/brand/ColorPicker.astro');

  assert(
    src.includes('data-color-swatch'),
    'ColorPicker must render swatch buttons with data-color-swatch attribute',
  );
  assert(
    src.includes('$colorActivo'),
    'ColorPicker must import and use $colorActivo store',
  );
  assert(
    src.includes('COLORS'),
    'ColorPicker must import COLORS array from highlight store',
  );
  assert(
    src.includes('color-picker'),
    'ColorPicker must have color-picker class for CSS visibility rule',
  );
  assert(
    src.includes('ring-2'),
    'ColorPicker must apply ring-2 to active swatch',
  );
  assert(
    src.includes('aria-pressed'),
    'ColorPicker swatches must use aria-pressed for accessibility',
  );
  assert(
    src.includes('bg-highlight-amarillo') && src.includes('bg-highlight-violeta'),
    'ColorPicker must map all 6 highlight color tokens',
  );

  console.info('  ✓ ColorPicker.astro: island with 6 swatches, $colorActivo binding, ring indicator');
}

function verifyStrongPattern(): void {
  const src = readFile('src/styles/global.css');

  assert(
    src.includes('.verso-card--has-strong'),
    'Missing .verso-card--has-strong styles',
  );
  assert(
    src.includes('repeating-linear-gradient'),
    'Strong pattern must use repeating-linear-gradient for diagonal stripes',
  );
  assert(
    src.includes('45deg'),
    'Strong pattern gradient must be at 45 degrees',
  );
  assert(
    src.includes('color-mix(in srgb, var(--brand-cian) 6%'),
    'Strong pattern must use color-mix with 6% cian tint',
  );
  assert(
    src.includes('html.verso-modo-activo .verso-card--has-strong'),
    'Strong pattern must be scoped under html.verso-modo-activo',
  );

  console.info('  ✓ global.css: .verso-card--has-strong diagonal stripe pattern (6% cian)');
}

function verifyChapterPageMarkup(): void {
  const src = readFile('src/pages/biblia/[version]/[libro]/[capitulo].astro');

  assert(
    src.includes('verso-card--has-strong'),
    'Chapter page must conditionally apply verso-card--has-strong class',
  );
  assert(
    src.includes('class:list'),
    'Chapter page must use class:list for conditional class application',
  );
  assert(
    src.includes('codigoStrong !== null'),
    'Strong detection must check for non-null codigoStrong',
  );

  console.info('  ✓ [capitulo].astro: verso-card--has-strong class conditionally applied');
}

function verifyCardModeActivation(): void {
  const src = readFile('src/components/workspace/HighlightClickProxy.astro');

  assert(
    src.includes('CARD_MODE_KEY'),
    'Proxy must import CARD_MODE_KEY from highlight store',
  );
  assert(
    src.includes('verso-modo-activo'),
    'Proxy must add verso-modo-activo class to <html>',
  );
  assert(
    src.includes('localStorage.setItem'),
    'Proxy must persist card mode to localStorage',
  );
  assert(
    src.includes('classList.add'),
    'Proxy must use classList.add to activate card mode',
  );
  assert(
    src.includes('activateCardMode'),
    'Proxy must have activateCardMode function',
  );

  console.info('  ✓ HighlightClickProxy.astro: activates card mode on first verse tap');
}

function verifyWorkspaceLayoutMount(): void {
  const src = readFile('src/layouts/WorkspaceLayout.astro');

  assert(
    src.includes('import ColorPicker'),
    'WorkspaceLayout must import ColorPicker component',
  );
  assert(
    src.includes('<ColorPicker'),
    'WorkspaceLayout must mount <ColorPicker /> in header',
  );
  assert(
    src.includes('FontSizeControl') && src.includes('ColorPicker'),
    'WorkspaceLayout must have both FontSizeControl and ColorPicker in header',
  );

  console.info('  ✓ WorkspaceLayout.astro: mounts ColorPicker in header alongside FontSizeControl');
}

function verifyColorPickerVisibilityCSS(): void {
  const src = readFile('src/styles/global.css');

  assert(
    src.includes('html:not(.verso-modo-activo) .color-picker'),
    'Missing CSS rule to hide color picker when card mode is inactive',
  );
  assert(
    src.includes('display: none'),
    'Color picker visibility rule must use display: none',
  );

  console.info('  ✓ global.css: color picker hidden until verso-modo-activo');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function verifyPr3Polish(): Promise<void> {
  console.info('PR 3 Polish verification...\n');

  verifyColorPicker();
  verifyStrongPattern();
  verifyChapterPageMarkup();
  verifyCardModeActivation();
  verifyWorkspaceLayoutMount();
  verifyColorPickerVisibilityCSS();

  console.info('\n✅ PR 3 Polish: all assertions passed.');
}

verifyPr3Polish().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
