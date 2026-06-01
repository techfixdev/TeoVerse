CREATE TABLE `biblias` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`nombre` text NOT NULL,
	`idioma` text NOT NULL,
	`licencia` text NOT NULL,
	`fuente` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `biblias_slug_unique` ON `biblias` (`slug`);--> statement-breakpoint
CREATE TABLE `diccionario` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`codigo_strong` text NOT NULL,
	`palabra` text NOT NULL,
	`definicion` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `diccionario_codigo_strong_idx` ON `diccionario` (`codigo_strong`);--> statement-breakpoint
CREATE TABLE `libros` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`testamento` text NOT NULL,
	`nombre` text NOT NULL,
	`slug` text NOT NULL,
	`abreviatura` text NOT NULL,
	`orden` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `libros_orden_idx` ON `libros` (`orden`);--> statement-breakpoint
CREATE UNIQUE INDEX `libros_slug_idx` ON `libros` (`slug`);--> statement-breakpoint
CREATE TABLE `versiculos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`biblia_id` integer NOT NULL,
	`libro_id` integer NOT NULL,
	`capitulo` integer NOT NULL,
	`versiculo` integer NOT NULL,
	`texto` text NOT NULL,
	FOREIGN KEY (`biblia_id`) REFERENCES `biblias`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`libro_id`) REFERENCES `libros`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `versiculos_referencia_idx` ON `versiculos` (`biblia_id`,`libro_id`,`capitulo`,`versiculo`);