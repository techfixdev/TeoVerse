-- Migration: recursos schema refactor (PR 2a)
-- Replaces: biblias → recursos (tipo='biblia'), diccionario → diccionario_entradas (per-recurso)
-- Adds: recurso_libros (per-resource canon + order), moves versiculos.biblia_id → recurso_id
--
-- IMPORTANT: This migration documents the one-time refactor from the single-Bible `biblias`
-- schema to the multi-resource `recursos` schema. It is NOT executed at runtime — the database
-- is re-seeded from the USFM source via `prepare:build-data`. It is kept for git history and
-- schema-intent documentation only.

--> statement-breakpoint
CREATE TABLE `recursos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tipo` text NOT NULL,
	`slug` text NOT NULL,
	`nombre` text NOT NULL,
	`idioma` text NOT NULL,
	`licencia` text NOT NULL,
	`fuente` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recursos_slug_unique` ON `recursos` (`slug`);
--> statement-breakpoint
CREATE TABLE `recurso_libros` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recurso_id` integer NOT NULL,
	`libro_id` integer NOT NULL,
	`orden` integer NOT NULL,
	FOREIGN KEY (`recurso_id`) REFERENCES `recursos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`libro_id`) REFERENCES `libros`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recurso_libros_orden_idx` ON `recurso_libros` (`recurso_id`, `orden`);
--> statement-breakpoint
CREATE UNIQUE INDEX `recurso_libros_libro_idx` ON `recurso_libros` (`recurso_id`, `libro_id`);
--> statement-breakpoint
CREATE TABLE `diccionario_entradas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recurso_id` integer NOT NULL,
	`codigo_strong` text NOT NULL,
	`lema` text NOT NULL,
	`definicion` text NOT NULL,
	FOREIGN KEY (`recurso_id`) REFERENCES `recursos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `diccionario_entradas_idx` ON `diccionario_entradas` (`recurso_id`, `codigo_strong`);
--> statement-breakpoint
-- Backfill: INSERT recursos (biblia) from biblias
INSERT INTO `recursos` (`tipo`, `slug`, `nombre`, `idioma`, `licencia`, `fuente`)
SELECT 'biblia', `slug`, `nombre`, `idioma`, `licencia`, `fuente` FROM `biblias`;
--> statement-breakpoint
-- Backfill: INSERT recurso_libros from libros.orden (MUST happen before libros.orden is dropped)
-- Derives membership from which books each Bible actually has verses for, mapping
-- biblias.id → recursos.id via slug — correct for any number of Bibles.
INSERT INTO `recurso_libros` (`recurso_id`, `libro_id`, `orden`)
SELECT DISTINCT r.id, v.libro_id, l.orden
FROM `versiculos` v
JOIN `libros` l ON l.id = v.libro_id
JOIN `biblias` b ON b.id = v.biblia_id
JOIN `recursos` r ON r.slug = b.slug AND r.tipo = 'biblia';
--> statement-breakpoint
-- Backfill: seed lexicon recurso
INSERT OR IGNORE INTO `recursos` (`tipo`, `slug`, `nombre`, `idioma`, `licencia`, `fuente`)
VALUES ('diccionario', 'strong-es', 'Strong Español', 'es', 'Public Domain', 'Strong Concordance — dominio público');
--> statement-breakpoint
-- Backfill: INSERT diccionario_entradas from diccionario (palabra → lema)
INSERT INTO `diccionario_entradas` (`recurso_id`, `codigo_strong`, `lema`, `definicion`)
SELECT r.id, d.`codigo_strong`, d.`palabra`, d.`definicion`
FROM `diccionario` d
JOIN `recursos` r ON r.slug = 'strong-es';
--> statement-breakpoint
-- Recreate versiculos with recurso_id instead of biblia_id
CREATE TABLE `versiculos_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recurso_id` integer NOT NULL,
	`libro_id` integer NOT NULL,
	`capitulo` integer NOT NULL,
	`versiculo` integer NOT NULL,
	`texto` text NOT NULL,
	FOREIGN KEY (`recurso_id`) REFERENCES `recursos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`libro_id`) REFERENCES `libros`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `versiculos_new` (`id`, `recurso_id`, `libro_id`, `capitulo`, `versiculo`, `texto`)
SELECT v.id, r.id, v.libro_id, v.capitulo, v.versiculo, v.texto
FROM `versiculos` v
JOIN `recursos` r ON r.tipo = 'biblia' AND r.slug = (SELECT slug FROM biblias WHERE id = v.biblia_id);
--> statement-breakpoint
DROP TABLE `versiculos`;
--> statement-breakpoint
ALTER TABLE `versiculos_new` RENAME TO `versiculos`;
--> statement-breakpoint
CREATE UNIQUE INDEX `versiculos_referencia_idx` ON `versiculos` (`recurso_id`, `libro_id`, `capitulo`, `versiculo`);
--> statement-breakpoint
-- Recreate libros without orden column
CREATE TABLE `libros_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`testamento` text NOT NULL,
	`nombre` text NOT NULL,
	`slug` text NOT NULL,
	`abreviatura` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `libros_new` (`id`, `testamento`, `nombre`, `slug`, `abreviatura`)
SELECT `id`, `testamento`, `nombre`, `slug`, `abreviatura` FROM `libros`;
--> statement-breakpoint
DROP TABLE `libros`;
--> statement-breakpoint
ALTER TABLE `libros_new` RENAME TO `libros`;
--> statement-breakpoint
CREATE UNIQUE INDEX `libros_slug_idx` ON `libros` (`slug`);
--> statement-breakpoint
-- Drop old tables
DROP TABLE `biblias`;
--> statement-breakpoint
DROP TABLE `diccionario`;
