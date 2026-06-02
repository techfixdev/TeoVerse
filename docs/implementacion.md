# Estado de implementación — TeoVerse

Workspace de estudio bíblico modular estilo e-Sword sobre Astro 5 estático.
Cambio SDD: `modular-study-workspace`. Entrega: PRs encadenados stacked-to-main,
con judgment-day (revisión dual) por fase.

> Última actualización: 2026-06-02 — PR 2b mergeado a `main` y deployado.

## Arquitectura base (decidida)

- **Spine de referencia compartido** (URL) + **módulos enchufables** + **workspace componible**.
- **Catálogo universal `recursos`** (reemplaza `biblias`): biblia | diccionario | comentario | etc.
- **Canon por recurso** vía join `recurso_libros` (el deuterocanónico vive acá, no en `libros`).
- `libros.testamento` = `'AT' | 'NT'` SOLO. No existe `'DC'`.
- **Códigos Strong universales** compartidos entre recursos.
- Estado del workspace en nanostores (`persistentJSON`, key `teoverse.workspace.v1`).
- `EstadoModulo.modo`: `'cerrado' | 'minimizado' | 'normal' | 'maximizado'` (estados ilegales irrepresentables).

## Progreso por PR

| PR | Alcance | Estado |
|----|---------|--------|
| **PR 1** | Foundation: contrato `ModuloRegistro` + `EstadoModulo` + stores nanostores (TS puro) | ✅ Mergeado |
| **PR 2a** | Refactor de schema a catálogo `recursos` + `recurso_libros` (re-seed, no ALTER) | ✅ Mergeado |
| **PR 2b** | Pipeline interlinear Strong: tabla `versiculos_tokens` + parser + endpoints | ✅ **Mergeado + deployado (PR #6, commit 54b2238)** |
| **PR 3** | UI/UX del workspace con branding Ríos de Vida | ⏭️ Siguiente |

## PR 2b — detalle (recién cerrado)

**Qué entró:**
- Tabla `versiculos_tokens` con índice **UNIQUE** `(versiculo_id, posicion)` e índice por `codigo_strong`.
- `parseUsfmBookInterlinear` + `extractAllTokens` en `src/importers/usfm.ts`.
- Población de tokens durante `import-spapddpt` (decode UTF-8 una sola vez por libro).
- Endpoints: token JSON por capítulo (`/datos/tokens/...`) y lookup de código Strong (`/datos/strong/...`).
- Scripts de verificación: `verify:usfm-interlinear`, `verify:tokens`, `verify:strong`.

**Fixes de Judgment Day aplicados:**
- Captura de **TODAS** las palabras del versículo (tagged + untagged), antes solo ~57% (`\w`-only).
  La lista de palabras se deriva de `cleanUsfmText` y los códigos Strong se asignan por match de superficie
  → invariante de reconstrucción (tokens unidos por espacio == texto limpio del versículo).
- Índice único contra tokens duplicados silenciosos.
- Un solo decode UTF-8 por libro.

**Archivos clave:** `src/db/schema.ts`, `drizzle/0002_versiculos_tokens.sql`,
`src/importers/usfm.ts`, `scripts/import-spapddpt.ts`, `scripts/verify-usfm-interlinear.ts`,
`src/pages/datos/tokens/`, `src/pages/datos/strong/`.

## Próximo paso — PR 3

UI/UX del workspace con el branding de **Ríos de Vida** (manual de marca v1.0 ya extraído:
paleta, tipografía, voz, logo). Mobile-first (95% mobile). Functionality-first, frontend al final.

## Backlog (parado)

- **Amplified Bible** (ebible.org engamp): traducir a español ANTES de importar.
  Bloqueadores a discutir: licencia + red flags de traducción automática. NO iniciado.

## Pipeline de verificación

Gate de readiness del proyecto: `pnpm verify` (corre `prepare:build-data` + todos los `verify:*` + `build:astro`).
La CI (`.github/workflows/ci.yml`) corre `pnpm verify` en push/PR a `main`.
Deploy a producción: integración Git de Vercel al entrar a `main`.
