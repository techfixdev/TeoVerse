/**
 * No-shift workspace bootstrap snippet.
 *
 * This module exports a JavaScript string that should be injected into
 * `<head>` via `<script is:inline>` on Bible chapter pages. It runs
 * synchronously before first paint to read the persisted workspace state and
 * apply initial open/closed CSS classes to `<html>`, preventing layout shift
 * (FOUC) on mobile where modules are shown by default.
 *
 * Usage (in an Astro page):
 *   import { bootstrapScript } from '@/components/workspace/bootstrap';
 *   ---
 *   <script is:inline set:html={bootstrapScript} />
 *
 * NOTE: This string is evaluated in browser context. It must NOT reference
 * any Node.js or TypeScript-only APIs. It must be valid plain JavaScript.
 * The script is intentionally compact (no external deps, no bundling).
 */

const WORKSPACE_KEY = 'teoverse.workspace.v1';

/**
 * Inline script string to be injected in `<head>` before first paint.
 *
 * What it does:
 * 1. Reads `localStorage[WORKSPACE_KEY]` and parses it as JSON.
 * 2. For each module in `estado.modulos`, applies a CSS class on `<html>`:
 *    - `ws-{id}-open`   when the module is `habilitado && abierto`
 *    - `ws-{id}-closed` when the module is `habilitado && !abierto`
 *    - `ws-{id}-min`    when the module is `habilitado && modo === 'minimizado'`
 * 3. Applies `ws-workspace-ready` to `<html>` so CSS can show the workspace
 *    chrome only after state is known (avoids unstyled flash).
 *
 * CSS convention for consumers:
 *   html:not(.ws-workspace-ready) .workspace-chrome { display: none; }
 *   html.ws-lectura-open .module-lectura { display: block; }
 */
export const bootstrapScript: string = `(function(){
  try {
    var raw = localStorage.getItem(${JSON.stringify(WORKSPACE_KEY)});
    if (raw) {
      var state = JSON.parse(raw);
      var modulos = state && state.modulos;
      if (modulos) {
        var html = document.documentElement;
        var ids = Object.keys(modulos);
        for (var i = 0; i < ids.length; i++) {
          var id = ids[i];
          var m = modulos[id];
          if (!m || !m.habilitado) continue;
          html.classList.add('ws-' + id + (m.abierto ? '-open' : '-closed'));
          if (m.modo === 'minimizado') html.classList.add('ws-' + id + '-min');
          if (m.modo === 'maximizado') html.classList.add('ws-' + id + '-max');
        }
      }
    }
  } catch(e) {}
  document.documentElement.classList.add('ws-workspace-ready');
})();`;
