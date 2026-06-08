/**
 * No-shift highlight bootstrap snippet.
 *
 * This module exports a JavaScript string that should be injected into
 * `<head>` via `<script is:inline>` on Bible chapter pages. It runs
 * synchronously before first paint to:
 *
 * 1. Read `rv:card-mode` from localStorage and apply `verso-modo-activo`
 *    class to `<html>` — activates card styling without FOUC.
 * 2. Read `rv:highlights` from localStorage, filter entries matching the
 *    current chapter (`data-libro:data-capitulo:*`), and apply
 *    `verso-resaltado verso-resaltado--{colorId}` classes to matching
 *    verse cards — restores highlight state without FOUC.
 *
 * Usage (in an Astro layout):
 *   import { highlightBootstrapScript } from '@/components/workspace/highlightBootstrap';
 *   ---
 *   <script is:inline set:html={highlightBootstrapScript} />
 *
 * NOTE: This string is evaluated in browser context. It must NOT reference
 * any Node.js or TypeScript-only APIs. It must be valid plain JavaScript.
 * The script is intentionally compact (no external deps, no bundling).
 */

import { HIGHLIGHT_KEY, CARD_MODE_KEY } from '@/stores/highlight';

/**
 * Inline script string to be injected in `<head>` before first paint.
 *
 * Reads localStorage directly (without Nanostores) to avoid hydration
 * timing issues. Applies CSS classes so the first rendered frame already
 * shows the user's persisted highlight state and card mode.
 */
export const highlightBootstrapScript: string = `(function(){
  try {
    var html = document.documentElement;

    /* Card mode — apply verso-modo-activo class pre-paint */
    var modeRaw = localStorage.getItem(${JSON.stringify(CARD_MODE_KEY)});
    if (modeRaw) {
      var mode = JSON.parse(modeRaw);
      if (mode === 'activo') {
        html.classList.add('verso-modo-activo');
      }
    }

    /* Highlights — filter current chapter entries, apply classes pre-paint */
    var raw = localStorage.getItem(${JSON.stringify(HIGHLIGHT_KEY)});
    if (raw) {
      var highlights = JSON.parse(raw);
      if (highlights && typeof highlights === 'object') {
        var libro = html.getAttribute('data-libro') || '';
        var capitulo = html.getAttribute('data-capitulo') || '';
        var prefix = libro + ':' + capitulo + ':';

        var keys = Object.keys(highlights);
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          if (key.indexOf(prefix) === 0) {
            var colorId = highlights[key];
            var el = document.querySelector('[data-verso="' + key + '"]');
            if (el) {
              el.classList.add('verso-resaltado', 'verso-resaltado--' + colorId);
            }
          }
        }
      }
    }
  } catch(e) {}
})();`;
