/**
 * No-shift font-scale bootstrap snippet.
 *
 * This module exports a JavaScript string that should be injected into
 * `<head>` via `<script is:inline>` on every page. It runs synchronously
 * before first paint to read the persisted font-scale preference and apply
 * the corresponding `font-scale-{level}` class to `<html>`, preventing FOUC.
 *
 * Usage (in an Astro layout):
 *   import { fontBootstrapScript } from '@/components/brand/fontBootstrap';
 *   ---
 *   <script is:inline set:html={fontBootstrapScript} />
 *
 * NOTE: This string is evaluated in browser context. It must NOT reference
 * any Node.js or TypeScript-only APIs. It must be valid plain JavaScript.
 * The script is intentionally compact (no external deps, no bundling).
 */

import { FONT_SCALE_KEY } from '@/stores/fontScale';

/**
 * Inline script string to be injected in `<head>` before first paint.
 *
 * What it does:
 * 1. Reads `localStorage[FONT_SCALE_KEY]` and parses it as JSON.
 * 2. If the parsed value is not 'default' (and not null/undefined),
 *    applies `font-scale-{level}` class on `<html>`.
 * 3. All wrapped in try/catch — corrupted localStorage silently defaults
 *    to no class (scale 1.0).
 */
export const fontBootstrapScript: string = `(function(){
  try {
    var raw = localStorage.getItem(${JSON.stringify(FONT_SCALE_KEY)});
    if (raw) {
      var level = JSON.parse(raw);
      if (level && level !== 'default') {
        document.documentElement.classList.add('font-scale-' + level);
      }
    }
  } catch(e) {}
})();`;
