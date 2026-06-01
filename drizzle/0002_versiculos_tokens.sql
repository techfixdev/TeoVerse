-- PR 2b: versiculos_tokens table
-- NOTE: The DB is ephemeral — re-seeded from USFM source at every build via prepare-build-data.ts.
-- This file exists as a reference migration only. The live schema is applied via `drizzle-kit push --force`.

CREATE TABLE `versiculos_tokens` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `versiculo_id` integer NOT NULL REFERENCES `versiculos`(`id`) ON DELETE CASCADE,
  `posicion` integer NOT NULL,
  `palabra` text NOT NULL,
  `codigo_strong` text
);

CREATE INDEX `versiculos_tokens_versiculo_idx` ON `versiculos_tokens` (`versiculo_id`, `posicion`);
CREATE INDEX `versiculos_tokens_strong_idx` ON `versiculos_tokens` (`codigo_strong`);
