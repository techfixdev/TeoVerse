/**
 * PR 2 Interaction verification gate.
 *
 * Asserts that the verse-highlight interaction layer is correctly in place:
 * 1. Bootstrap script exists and reads correct localStorage keys
 * 2. HighlightClickProxy component exists with delegation pattern
 * 3. @keyframes marker-paint defined in global.css
 * 4. .verso-card::before pseudo-element styles present
 * 5. .verso-resaltado::before animation trigger present
 * 6. All 6 .verso-resaltado--{colorId} classes defined
 * 7. Active card styles scoped under html.verso-modo-activo
 * 8. WorkspaceLayout mounts proxy and injects bootstrap script
 * 9. CARD_MODE_KEY exported from highlight store
 *
 * Run: pnpm verify:pr2-interaction
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

function verifyBootstrapScript(): void {
  const src = readFile('src/components/workspace/highlightBootstrap.ts');

  assert(
    src.includes('export const highlightBootstrapScript'),
    'Missing highlightBootstrapScript export',
  );
  assert(
    src.includes('rv:highlights') || src.includes('HIGHLIGHT_KEY'),
    'Bootstrap must reference HIGHLIGHT_KEY or rv:highlights',
  );
  assert(
    src.includes('rv:card-mode') || src.includes('CARD_MODE_KEY'),
    'Bootstrap must reference CARD_MODE_KEY or rv:card-mode',
  );
  assert(
    src.includes('verso-modo-activo'),
    'Bootstrap must apply verso-modo-activo class',
  );
  assert(
    src.includes('verso-resaltado'),
    'Bootstrap must apply verso-resaltado classes',
  );
  assert(
    src.includes('data-libro') && src.includes('data-capitulo'),
    'Bootstrap must read data-libro and data-capitulo for chapter filtering',
  );
  assert(
    src.includes('data-verso'),
    'Bootstrap must query elements by data-verso attribute',
  );

  console.info('  ✓ highlightBootstrap.ts: script exports and reads correct keys');
}

function verifyClickProxy(): void {
  const src = readFile('src/components/workspace/HighlightClickProxy.astro');

  assert(
    src.includes('$highlight'),
    'Proxy must import and use $highlight store',
  );
  assert(
    src.includes('$colorActivo'),
    'Proxy must import and use $colorActivo store',
  );
  assert(
    src.includes('main.module-lectura'),
    'Proxy must delegate on main.module-lectura container',
  );
  assert(
    src.includes('[data-strong]'),
    'Proxy must bail on [data-strong] targets (coexistence)',
  );
  assert(
    src.includes('[data-tsk-refs]'),
    'Proxy must bail on [data-tsk-refs] targets (coexistence)',
  );
  assert(
    src.includes('.verso-card'),
    'Proxy must match .verso-card elements',
  );
  assert(
    src.includes('data-verso') || src.includes('dataset.verso'),
    'Proxy must read data-verso key from card',
  );
  assert(
    src.includes('verso-resaltado'),
    'Proxy must toggle verso-resaltado classes',
  );

  console.info('  ✓ HighlightClickProxy.astro: delegation pattern with coexistence bail-out');
}

function verifyKeyframes(): void {
  const src = readFile('src/styles/global.css');

  assert(
    src.includes('@keyframes marker-paint'),
    'Missing @keyframes marker-paint definition',
  );
  assert(
    src.includes('scaleX(0)'),
    'marker-paint must animate from scaleX(0)',
  );
  assert(
    src.includes('scaleX(1)'),
    'marker-paint must animate to scaleX(1)',
  );

  console.info('  ✓ global.css: @keyframes marker-paint defined (scaleX 0→1)');
}

function verifyPseudoElement(): void {
  const src = readFile('src/styles/global.css');

  assert(
    src.includes('.verso-card::before'),
    'Missing .verso-card::before pseudo-element styles',
  );
  assert(
    /content:\s*''/.test(src),
    '.verso-card::before must have content: \'\'',
  );
  assert(
    src.includes('position: absolute') && src.includes('inset: 0'),
    '.verso-card::before must be absolutely positioned with inset: 0',
  );
  assert(
    src.includes('z-index: -1'),
    '.verso-card::before must have z-index: -1 (behind content)',
  );
  assert(
    src.includes('transform-origin: left'),
    '.verso-card::before must have transform-origin: left',
  );
  assert(
    src.includes('transform: scaleX(0)'),
    '.verso-card::before must default to scaleX(0)',
  );
  assert(
    src.includes('--hl-active'),
    '.verso-card::before must use --hl-active for background-color',
  );

  console.info('  ✓ global.css: .verso-card::before paint layer configured');
}

function verifyAnimationTrigger(): void {
  const src = readFile('src/styles/global.css');

  assert(
    src.includes('.verso-resaltado::before'),
    'Missing .verso-resaltado::before animation trigger',
  );
  assert(
    src.includes('animation: marker-paint'),
    '.verso-resaltado::before must trigger marker-paint animation',
  );
  assert(
    src.includes('forwards'),
    'Animation must use forwards fill mode',
  );

  console.info('  ✓ global.css: .verso-resaltado::before animation trigger present');
}

function verifyHighlightColorClasses(): void {
  const src = readFile('src/styles/global.css');

  const colors = ['amarillo', 'verde', 'rosa', 'azul', 'naranja', 'violeta'];

  for (const color of colors) {
    assert(
      src.includes(`.verso-resaltado--${color}`),
      `Missing .verso-resaltado--${color} class`,
    );
    assert(
      src.includes(`--hl-${color}`),
      `.verso-resaltado--${color} must reference --hl-${color}`,
    );
  }

  console.info('  ✓ global.css: all 6 .verso-resaltado--{colorId} classes defined');
}

function verifyActiveCardStyles(): void {
  const src = readFile('src/styles/global.css');

  assert(
    src.includes('html.verso-modo-activo .verso-card'),
    'Missing active card styles scoped under html.verso-modo-activo',
  );
  assert(
    src.includes('padding:') && src.includes('html.verso-modo-activo'),
    'Active card must have padding',
  );
  assert(
    src.includes('border:') && src.includes('html.verso-modo-activo'),
    'Active card must have border',
  );
  assert(
    src.includes('box-shadow:') && src.includes('html.verso-modo-activo'),
    'Active card must have box-shadow',
  );

  console.info('  ✓ global.css: active card styles scoped under verso-modo-activo');
}

function verifyWorkspaceLayout(): void {
  const src = readFile('src/layouts/WorkspaceLayout.astro');

  assert(
    src.includes('HighlightClickProxy'),
    'WorkspaceLayout must import HighlightClickProxy',
  );
  assert(
    src.includes('highlightBootstrapScript'),
    'WorkspaceLayout must import highlightBootstrapScript',
  );
  assert(
    src.includes('<HighlightClickProxy'),
    'WorkspaceLayout must mount <HighlightClickProxy /> component',
  );
  assert(
    src.includes('set:html={highlightBootstrapScript}'),
    'WorkspaceLayout must inject highlightBootstrapScript as inline script',
  );
  assert(
    src.includes('is:inline'),
    'Highlight bootstrap script must use is:inline directive',
  );

  console.info('  ✓ WorkspaceLayout.astro: mounts proxy and injects bootstrap script');
}

function verifyCardModeKey(): void {
  const src = readFile('src/stores/highlight.ts');

  assert(
    src.includes('export const CARD_MODE_KEY'),
    'Missing CARD_MODE_KEY constant export from highlight store',
  );
  assert(
    src.includes("'rv:card-mode'"),
    'CARD_MODE_KEY must be rv:card-mode',
  );

  console.info('  ✓ highlight store: CARD_MODE_KEY exported');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function verifyPr2Interaction(): Promise<void> {
  console.info('PR 2 Interaction verification...\n');

  verifyCardModeKey();
  verifyBootstrapScript();
  verifyClickProxy();
  verifyKeyframes();
  verifyPseudoElement();
  verifyAnimationTrigger();
  verifyHighlightColorClasses();
  verifyActiveCardStyles();
  verifyWorkspaceLayout();

  console.info('\n✅ PR 2 Interaction: all assertions passed.');
}

verifyPr2Interaction().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
