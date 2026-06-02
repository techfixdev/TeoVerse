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

-- posicion = 0-based word index within the verse across ALL words (tagged + untagged).
-- Unique guards against silent duplicate tokens if a future code path skips delete-before-insert.
CREATE UNIQUE INDEX `versiculos_tokens_versiculo_pos_uidx` ON `versiculos_tokens` (`versiculo_id`, `posicion`);
CREATE INDEX `versiculos_tokens_strong_idx` ON `versiculos_tokens` (`codigo_strong`);
