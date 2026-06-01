# TeoVerse Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inicializar TeoVerse como WebApp Open Source de estudio bíblico modular con Astro, TypeScript, Drizzle ORM y Turso/LibSQL, arrancando con una Biblia real de licencia compatible.

**Architecture:** Astro usará `output: 'hybrid'` con adapter Vercel para soportar SSG de capítulos bíblicos y endpoints/islas dinámicas para búsqueda, notas y módulos. La capa de datos vive en `src/db`, con esquema SQLite tipado por Drizzle y cliente LibSQL con fallback local `file:local.db`. La Biblia inicial se importa desde fuente estructurada con licencia verificable; NO desde PDF. La lectura bíblica inicial debe poder funcionar sin base de datos en runtime; Turso queda preparado para búsqueda, notas y módulos dinámicos.

**Tech Stack:** Astro v4+, TypeScript, Tailwind CSS, Drizzle ORM, Drizzle Kit, LibSQL/Turso opcional, SQLite local, lucide-astro, clsx, tailwind-merge, adapter Vercel.

**Package Manager:** `pnpm` only. Do not use npm for future project commands. Keep `pnpm-lock.yaml`; do not commit `package-lock.json`.

---

## Decision: fuente bíblica inicial

**No usar PDF como fuente primaria.** PDF es un formato de presentación, no de datos: rompe versículos, agrega headers/footers, cambia guiones, mezcla columnas y complica la normalización. Para una Biblia el dato es estructural: versión → libro → capítulo → versículo → texto.

**Fuente recomendada:** empezar con una Biblia de dominio público o licencia explícitamente compatible en formato estructurado:

1. **OSIS / USFM / USX** — mejor opción para biblias completas porque preserva estructura bíblica.
2. **XML / JSON bíblico validado** — buena opción si trae licencia clara y separación por versículo.
3. **SQLite/e-Sword module** — útil para importadores futuros, pero solo si la licencia permite redistribución.
4. **Web scraping** — último recurso; solo con permiso/licencia explícita.

**Versión inicial propuesta:** `spapddpt` / Palabra de Dios para ti como versión principal real en español latinoamericano contemporáneo, bajo licencia CC BY 4.0. Mantener `spaRV1909` / Reina-Valera 1909 como versión secundaria histórica de dominio público para comparación. Guardar siempre `licencia`, `fuente` y atribución en la base.

---

## File Structure

- Create: `package.json` — scripts, dependencias runtime y dev.
- Create: `astro.config.mjs` — Tailwind + adapter Vercel + salida híbrida.
- Create: `tsconfig.json` — TypeScript estricto compatible con Astro.
- Create: `tailwind.config.mjs` — content paths y dark mode por clase.
- Create: `src/styles/global.css` — directivas Tailwind y estilos base.
- Create: `drizzle.config.ts` — Drizzle Kit apuntando a `file:local.db`.
- Create: `src/db/schema.ts` — tablas bíblicas con metadata de fuente/licencia.
- Create: `src/db/client.ts` — cliente LibSQL/Turso con fallback local.
- Create: `src/db/seed.ts` — seed inicial con muestra real de `spapddpt` y metadata de atribución.
- Create: `src/layouts/MainLayout.astro` — layout base con modo oscuro.
- Create: `src/pages/index.astro` — UI inicial de tres paneles estilo e-Sword.
- Create: `src/pages/biblia/[version]/[libro]/[capitulo].astro` — ruta SSG mínima para capítulos.

---

## Implementation Tasks

### Task 1: Configuración del proyecto

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `tailwind.config.mjs`
- Create: `src/styles/global.css`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "teoverse",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro check && astro build",
    "preview": "astro preview",
    "astro": "astro",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:seed": "tsx src/db/seed.ts"
  },
  "dependencies": {
    "@astrojs/vercel": "latest",
    "@astrojs/tailwind": "latest",
    "@libsql/client": "latest",
    "astro": "latest",
    "clsx": "latest",
    "drizzle-orm": "latest",
    "lucide-astro": "latest",
    "tailwind-merge": "latest"
  },
  "devDependencies": {
    "@astrojs/check": "latest",
    "@types/node": "latest",
    "drizzle-kit": "latest",
    "tailwindcss": "latest",
    "tsx": "latest",
    "typescript": "latest"
  }
}
```

- [ ] **Step 2: Create `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'hybrid',
  adapter: vercel({ edgeMiddleware: true }),
  integrations: [tailwind({ applyBaseStyles: false })],
});
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "types": ["node"]
  }
}
```

- [ ] **Step 4: Create `tailwind.config.mjs`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        reading: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 5: Create `src/styles/global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root { color-scheme: light; }
  .dark { color-scheme: dark; }

  html {
    @apply bg-slate-50 text-slate-950 antialiased dark:bg-slate-950 dark:text-slate-100;
  }

  body {
    @apply min-h-screen;
  }
}
```

- [ ] **Step 6: Verify configuration**

Run: `pnpm install && pnpm astro -- --version`

Expected: dependencies install successfully and Astro prints its version. Commit `pnpm-lock.yaml` so actual resolved versions are locked.

---

### Task 2: Esquema y cliente de base de datos

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/db/schema.ts`
- Create: `src/db/client.ts`

- [ ] **Step 1: Create `drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'file:local.db',
  },
  verbose: true,
  strict: true,
});
```

- [ ] **Step 2: Create `src/db/schema.ts`**

```ts
import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const biblias = sqliteTable('biblias', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  nombre: text('nombre').notNull(),
  idioma: text('idioma').notNull(),
  licencia: text('licencia').notNull(),
  fuente: text('fuente').notNull(),
});

export const libros = sqliteTable(
  'libros',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    testamento: text('testamento', { enum: ['AT', 'NT'] }).notNull(),
    nombre: text('nombre').notNull(),
    slug: text('slug').notNull(),
    abreviatura: text('abreviatura').notNull(),
    orden: integer('orden').notNull(),
  },
  (table) => ({
    ordenIdx: uniqueIndex('libros_orden_idx').on(table.orden),
    slugIdx: uniqueIndex('libros_slug_idx').on(table.slug),
  }),
);

export const versiculos = sqliteTable(
  'versiculos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    bibliaId: integer('biblia_id').notNull().references(() => biblias.id, { onDelete: 'cascade' }),
    libroId: integer('libro_id').notNull().references(() => libros.id, { onDelete: 'cascade' }),
    capitulo: integer('capitulo').notNull(),
    versiculo: integer('versiculo').notNull(),
    texto: text('texto').notNull(),
  },
  (table) => ({
    referenciaIdx: uniqueIndex('versiculos_referencia_idx').on(
      table.bibliaId,
      table.libroId,
      table.capitulo,
      table.versiculo,
    ),
  }),
);

export const diccionario = sqliteTable(
  'diccionario',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    codigoStrong: text('codigo_strong').notNull(),
    palabra: text('palabra').notNull(),
    definicion: text('definicion').notNull(),
  },
  (table) => ({
    codigoStrongIdx: uniqueIndex('diccionario_codigo_strong_idx').on(table.codigoStrong),
  }),
);

export const bibliasRelations = relations(biblias, ({ many }) => ({ versiculos: many(versiculos) }));
export const librosRelations = relations(libros, ({ many }) => ({ versiculos: many(versiculos) }));
export const versiculosRelations = relations(versiculos, ({ one }) => ({
  biblia: one(biblias, { fields: [versiculos.bibliaId], references: [biblias.id] }),
  libro: one(libros, { fields: [versiculos.libroId], references: [libros.id] }),
}));

export type Biblia = typeof biblias.$inferSelect;
export type NuevaBiblia = typeof biblias.$inferInsert;
export type Libro = typeof libros.$inferSelect;
export type NuevoLibro = typeof libros.$inferInsert;
export type Versiculo = typeof versiculos.$inferSelect;
export type NuevoVersiculo = typeof versiculos.$inferInsert;
export type EntradaDiccionario = typeof diccionario.$inferSelect;
export type NuevaEntradaDiccionario = typeof diccionario.$inferInsert;
```

- [ ] **Step 3: Create `src/db/client.ts`**

```ts
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const connectionUrl = import.meta.env.TURSO_CONNECTION_URL ?? process.env.TURSO_CONNECTION_URL;
const authToken = import.meta.env.TURSO_AUTH_TOKEN ?? process.env.TURSO_AUTH_TOKEN;
const url = connectionUrl && connectionUrl.trim().length > 0 ? connectionUrl : 'file:local.db';

export const client = createClient({
  url,
  authToken: authToken && authToken.trim().length > 0 ? authToken : undefined,
});

export const db = drizzle(client, { schema });
```

- [ ] **Step 4: Generate migrations**

Run: `pnpm db:generate`

Expected: Drizzle creates SQL migration files under `drizzle/`.

---

### Task 3: Seed inicial con Biblia real

**Files:**
- Create: `src/db/seed.ts`

- [ ] **Step 1: Create `src/db/seed.ts` with spapddpt sample**

```ts
import { eq } from 'drizzle-orm';
import { db } from './client';
import { biblias, diccionario, libros, versiculos } from './schema';

async function seed() {
  const [createdBiblia] = await db
    .insert(biblias)
    .values({
      slug: 'spapddpt',
      nombre: 'Palabra de Dios para ti',
      idioma: 'es',
      licencia: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
      fuente: 'eBible.org — https://ebible.org/find/details.php?id=spapddpt',
    })
    .onConflictDoNothing()
    .returning();

  const biblia = createdBiblia ?? (await db.select().from(biblias).where(eq(biblias.slug, 'spapddpt')).get());
  if (!biblia) throw new Error('No se pudo crear ni recuperar la Biblia spapddpt.');

  const [createdGenesis] = await db
    .insert(libros)
    .values({ testamento: 'AT', nombre: 'Génesis', slug: 'genesis', abreviatura: 'Gn', orden: 1 })
    .onConflictDoNothing()
    .returning();

  const genesis = createdGenesis ?? (await db.select().from(libros).where(eq(libros.slug, 'genesis')).get());
  if (!genesis) throw new Error('No se pudo crear ni recuperar el libro Génesis.');

  await db
    .insert(versiculos)
    .values([
      { bibliaId: biblia.id, libroId: genesis.id, capitulo: 1, versiculo: 1, texto: 'En un principio ʼElohim creó los cielos y la tierra.' },
      { bibliaId: biblia.id, libroId: genesis.id, capitulo: 1, versiculo: 2, texto: 'La tierra estaba desordenada y vacía, y las tinieblas estaban sobre la superficie del abismo. El Espíritu de ʼElohim se movía sobre la superficie de las aguas.' },
      { bibliaId: biblia.id, libroId: genesis.id, capitulo: 1, versiculo: 3, texto: 'Entonces ʼElohim dijo: Haya luz. Y hubo luz.' },
      { bibliaId: biblia.id, libroId: genesis.id, capitulo: 1, versiculo: 4, texto: 'ʼElohim vio que la luz era buena, y ʼElohim separó la luz de las tinieblas.' },
      { bibliaId: biblia.id, libroId: genesis.id, capitulo: 1, versiculo: 5, texto: 'ʼElohim llamó a la luz Día, y a las tinieblas llamó Noche. Y fue la tarde y fue la mañana: día uno.' },
    ])
    .onConflictDoNothing();

  await db
    .insert(diccionario)
    .values([
      { codigoStrong: 'H7225', palabra: 'principio', definicion: 'Comienzo, primero o punto de origen.' },
      { codigoStrong: 'H430', palabra: 'Dios', definicion: 'Elohim; término hebreo usado para Dios en Génesis.' },
    ])
    .onConflictDoNothing();

  console.info('Seed spapddpt completado correctamente.');
}

seed().catch((error) => {
  console.error('Error ejecutando seed:', error);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Run migrations and seed**

Run: `pnpm db:push && pnpm db:seed`

Expected: `local.db` is created and the console prints `Seed spapddpt completado correctamente.`

---

### Task 4: UI de tres paneles y primera ruta SSG

**Files:**
- Create: `src/layouts/MainLayout.astro`
- Create: `src/pages/index.astro`
- Create: `src/pages/biblia/[version]/[libro]/[capitulo].astro`

- [ ] **Step 1: Create `src/layouts/MainLayout.astro`**

```astro
---
import '../styles/global.css';

interface Props {
  title?: string;
  description?: string;
}

const {
  title = 'TeoVerse',
  description = 'WebApp modular de estudio bíblico inspirada en e-Sword.',
} = Astro.props;
---

<!doctype html>
<html lang="es" class="h-full">
  <head>
    <meta charset="UTF-8" />
    <meta name="description" content={description} />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
  </head>
  <body class="h-full bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
    <slot />
  </body>
</html>
```

- [ ] **Step 2: Create `src/pages/index.astro`**

Use the three-panel e-Sword-inspired shell:

```txt
┌───────────────────────────────────────────────┐
│ Header + search                               │
├──────────────┬──────────────────┬─────────────┤
│ Books        │ Bible chapter    │ Comments    │
│ Chapters     │ RV1909 Genesis 1 ├─────────────┤
│              │                  │ Dictionary  │
└──────────────┴──────────────────┴─────────────┘
```

The page must use Tailwind `dark:` classes and display RV1909/Génesis instead of DEMO data.

- [ ] **Step 3: Create `src/pages/biblia/[version]/[libro]/[capitulo].astro`**

```astro
---
import MainLayout from '@/layouts/MainLayout.astro';

export function getStaticPaths() {
  return [
    {
      params: {
        version: 'spapddpt',
        libro: 'genesis',
        capitulo: '1',
      },
    },
  ];
}

const { version, libro, capitulo } = Astro.params;
---

<MainLayout title={`TeoVerse | ${version?.toUpperCase()} ${libro} ${capitulo}`}>
  <main class="min-h-screen bg-slate-50 p-6 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
    <article class="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p class="text-sm font-medium uppercase text-indigo-600 dark:text-indigo-400">{version}</p>
      <h1 class="mt-2 text-3xl font-bold capitalize">{libro} {capitulo}</h1>
      <p class="mt-4 text-slate-600 dark:text-slate-400">
        Ruta SSG inicial. En el siguiente paso esta página debe leer capítulos desde Drizzle durante build time.
      </p>
    </article>
  </main>
</MainLayout>
```

- [ ] **Step 4: Verify Astro build**

Run: `pnpm build`

Expected: Astro type-checks and builds the static/hybrid site without errors.

---

## Self-Review

- Spec coverage: configuración, esquema, cliente, seed real inicial, layout de tres paneles y primera ruta SSG están cubiertos.
- Source decision: PDF queda descartado como fuente primaria; se prioriza OSIS/USFM/USX/XML/JSON con licencia verificable.
- Risk: `spapddpt` usa CC BY 4.0; la app debe mostrar atribución clara. `spaRV1909` queda como baseline histórico de dominio público.
- Deployment decision: Vercel es el target inicial. Usar `@astrojs/vercel/serverless`, no `@astrojs/node`.
- Database decision: Turso/Drizzle queda preparado, pero la lectura SSG inicial no debe depender de DB en runtime.
- Tooling decision: usar solo `pnpm`; no usar npm ni `package-lock.json` en el proyecto.
- Risk: `latest` acelera el bootstrap, pero el `pnpm-lock.yaml` debe commitearse. Antes de release conviene documentar versiones soportadas.
- Next improvement: reemplazar la ruta SSG temporal con queries build-time a Drizzle y agregar migración FTS5 para búsqueda.
