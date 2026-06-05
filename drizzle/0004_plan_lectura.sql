CREATE TABLE `plan_lectura` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `mes` integer NOT NULL,
  `dia` integer NOT NULL,
  `orden` integer DEFAULT 1 NOT NULL,
  `libro_id` integer NOT NULL REFERENCES `libros`(`id`) ON DELETE cascade,
  `capitulo_inicio` integer NOT NULL,
  `capitulo_fin` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_lectura_dia_idx` ON `plan_lectura` (`mes`,`dia`,`orden`);
