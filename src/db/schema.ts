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
  (table) => [uniqueIndex('libros_orden_idx').on(table.orden), uniqueIndex('libros_slug_idx').on(table.slug)],
);

export const versiculos = sqliteTable(
  'versiculos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    bibliaId: integer('biblia_id')
      .notNull()
      .references(() => biblias.id, { onDelete: 'cascade' }),
    libroId: integer('libro_id')
      .notNull()
      .references(() => libros.id, { onDelete: 'cascade' }),
    capitulo: integer('capitulo').notNull(),
    versiculo: integer('versiculo').notNull(),
    texto: text('texto').notNull(),
  },
  (table) => [
    uniqueIndex('versiculos_referencia_idx').on(
      table.bibliaId,
      table.libroId,
      table.capitulo,
      table.versiculo,
    ),
  ],
);

export const diccionario = sqliteTable(
  'diccionario',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    codigoStrong: text('codigo_strong').notNull(),
    palabra: text('palabra').notNull(),
    definicion: text('definicion').notNull(),
  },
  (table) => [uniqueIndex('diccionario_codigo_strong_idx').on(table.codigoStrong)],
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
