# TeoVerse

TeoVerse is a static Astro 5 Bible reading site focused on approved Spanish Bible content, visible attribution, and safe local import workflows. It builds static pages with Astro, Tailwind, Drizzle ORM, and a LibSQL-compatible local fallback.

## Quick Path

1. Install dependencies with pnpm only:

   ```bash
   pnpm install
   ```

2. Run the full readiness check:

   ```bash
   pnpm verify
   ```

3. Start local development:

   ```bash
   pnpm dev
   ```

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Astro dev server. |
| `pnpm build` | Prepare seeded build data, run `astro check`, and build static output. |
| `pnpm verify` | Prepare seeded build data, run Bible query checks, USFM parser checks, USFM importer checks, and build. |
| `pnpm prepare:build-data` | Create/update the local build database schema and seed data when Turso is not configured. |
| `pnpm verify:bible-queries` | Verify expected Bible query behavior against the local database. |
| `pnpm verify:usfm-parser` | Verify the USFM parser against the committed fixture. |
| `pnpm verify:usfm-importer` | Verify idempotent USFM import behavior against the local database. |

## Architecture

| Area | Notes |
| --- | --- |
| Framework | Astro 5 with `output: 'static'`. |
| Deployment adapter | `@astrojs/vercel` for Vercel static deployment output. |
| Styling | Tailwind with project styles in `src/styles/global.css`. |
| Data access | Drizzle ORM over `@libsql/client`. |
| Local database | Falls back to `file:local.db` when Turso env vars are not set. |
| Schema and migrations | Schema lives in `src/db/schema.ts`; generated migrations live in `drizzle/`. |

## Bible And Licensing Policy

The primary Bible version is `spapddpt`, Palabra de Dios para ti, licensed under Creative Commons Attribution 4.0 International (CC BY 4.0). Any page or feature that displays this text must preserve visible attribution to Palabra de Dios para ti, CC BY 4.0, and eBible.org.

Do not add Bible text unless the source is approved, license-compatible, and attribution requirements are understood before import.

## USFM Importer Policy

The importer is local-only and intentionally conservative.

- Use only manually approved local USFM files.
- Do not download Bible text during `build`, `verify`, or runtime.
- Do not commit full Bible source files or downloaded USFM directories.
- Keep committed fixtures small and safe under `fixtures/usfm`.
- Do not import from PDF, scrape sources, or use DEMO/RVR1960 text.

Importer details live in `docs/usfm-importer.md`.

## Environment

Local development and the seeded MVP build work without Turso by using an ignored `local.db`. `pnpm build` and `pnpm verify` prepare that local database automatically from a clean checkout before Astro queries Drizzle. Optional Turso deployment variables are documented in `.env.example` with placeholders only.

| Variable | Required | Purpose |
| --- | --- | --- |
| `TURSO_CONNECTION_URL` | No | Remote LibSQL/Turso database URL. |
| `TURSO_AUTH_TOKEN` | No | Remote Turso auth token. Never commit a real token. |

## Vercel Deployment Notes

- Use pnpm as the package manager.
- Build command: `pnpm build` or `pnpm verify` for stricter pre-deploy checks.
- Git builds are self-contained for the seeded MVP: `pnpm build` creates the local schema and seed data when Turso is not configured, without committing `local.db`.
- Output is static; database queries happen at build time for generated pages.
- Set Turso env vars in Vercel only when the build should read from a remote database. Turso becomes necessary later for dynamic data, search, user notes, or other data that cannot come from the committed seed scripts.
- Confirm attribution pages and visible Bible attribution before publishing.

## Readiness Checklist

- [ ] `pnpm verify` passes locally.
- [ ] `.env` contains only local secrets and is not committed.
- [ ] Full Bible source directories are outside git or ignored.
- [ ] Visible attribution is present for `spapddpt` content.
- [ ] Vercel project uses pnpm and the expected build command.
