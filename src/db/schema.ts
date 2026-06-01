import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const recursos = sqliteTable('recursos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tipo: text('tipo', {
    enum: ['biblia', 'diccionario', 'comentario', 'referencias', 'mapa', 'estudio', 'teologia'],
  }).notNull(),
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
    // NOTE: global `orden` column removed — book order is per-resource via recurso_libros
  },
  (table) => [uniqueIndex('libros_slug_idx').on(table.slug)],
);

export const recursoLibros = sqliteTable(
  'recurso_libros',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    recursoId: integer('recurso_id')
      .notNull()
      .references(() => recursos.id, { onDelete: 'cascade' }),
    libroId: integer('libro_id')
      .notNull()
      .references(() => libros.id, { onDelete: 'cascade' }),
    orden: integer('orden').notNull(),
  },
  (table) => [
    uniqueIndex('recurso_libros_orden_idx').on(table.recursoId, table.orden),
    uniqueIndex('recurso_libros_libro_idx').on(table.recursoId, table.libroId),
  ],
);

export const versiculos = sqliteTable(
  'versiculos',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    recursoId: integer('recurso_id')
      .notNull()
      .references(() => recursos.id, { onDelete: 'cascade' }),
    libroId: integer('libro_id')
      .notNull()
      .references(() => libros.id, { onDelete: 'cascade' }),
    capitulo: integer('capitulo').notNull(),
    versiculo: integer('versiculo').notNull(),
    texto: text('texto').notNull(),
  },
  (table) => [
    uniqueIndex('versiculos_referencia_idx').on(table.recursoId, table.libroId, table.capitulo, table.versiculo),
  ],
);

export const versiculosTokens = sqliteTable(
  'versiculos_tokens',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    versiculoId: integer('versiculo_id')
      .notNull()
      .references(() => versiculos.id, { onDelete: 'cascade' }),
    posicion: integer('posicion').notNull(),
    palabra: text('palabra').notNull(),
    codigoStrong: text('codigo_strong'),
  },
  (table) => [
    index('versiculos_tokens_versiculo_idx').on(table.versiculoId, table.posicion),
    index('versiculos_tokens_strong_idx').on(table.codigoStrong),
  ],
);

export const diccionarioEntradas = sqliteTable(
  'diccionario_entradas',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    recursoId: integer('recurso_id')
      .notNull()
      .references(() => recursos.id, { onDelete: 'cascade' }),
    codigoStrong: text('codigo_strong').notNull(),
    lema: text('lema').notNull(),
    definicion: text('definicion').notNull(),
  },
  (table) => [uniqueIndex('diccionario_entradas_idx').on(table.recursoId, table.codigoStrong)],
);

// Relations

export const recursosRelations = relations(recursos, ({ many }) => ({
  recursoLibros: many(recursoLibros),
  versiculos: many(versiculos),
  diccionarioEntradas: many(diccionarioEntradas),
}));

export const librosRelations = relations(libros, ({ many }) => ({
  recursoLibros: many(recursoLibros),
  versiculos: many(versiculos),
}));

export const recursoLibrosRelations = relations(recursoLibros, ({ one }) => ({
  recurso: one(recursos, { fields: [recursoLibros.recursoId], references: [recursos.id] }),
  libro: one(libros, { fields: [recursoLibros.libroId], references: [libros.id] }),
}));

export const versiculosRelations = relations(versiculos, ({ one, many }) => ({
  recurso: one(recursos, { fields: [versiculos.recursoId], references: [recursos.id] }),
  libro: one(libros, { fields: [versiculos.libroId], references: [libros.id] }),
  tokens: many(versiculosTokens),
}));

export const versiculosTokensRelations = relations(versiculosTokens, ({ one }) => ({
  versiculo: one(versiculos, { fields: [versiculosTokens.versiculoId], references: [versiculos.id] }),
}));

export const diccionarioEntradasRelations = relations(diccionarioEntradas, ({ one }) => ({
  recurso: one(recursos, { fields: [diccionarioEntradas.recursoId], references: [recursos.id] }),
}));

// Inferred types

export type Recurso = typeof recursos.$inferSelect;
export type NuevoRecurso = typeof recursos.$inferInsert;
export type Libro = typeof libros.$inferSelect;
export type NuevoLibro = typeof libros.$inferInsert;
export type RecursoLibro = typeof recursoLibros.$inferSelect;
export type NuevoRecursoLibro = typeof recursoLibros.$inferInsert;
export type Versiculo = typeof versiculos.$inferSelect;
export type NuevoVersiculo = typeof versiculos.$inferInsert;
export type EntradaDiccionario = typeof diccionarioEntradas.$inferSelect;
export type NuevaEntradaDiccionario = typeof diccionarioEntradas.$inferInsert;
export type VersiculoToken = typeof versiculosTokens.$inferSelect;
export type NuevoVersiculoToken = typeof versiculosTokens.$inferInsert;
