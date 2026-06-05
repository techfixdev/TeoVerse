CREATE TABLE tsk_referencias (
  id            INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  libro_id      INTEGER NOT NULL REFERENCES libros(id),
  capitulo      INTEGER NOT NULL,
  versiculo     INTEGER NOT NULL,
  ref_libro_id  INTEGER NOT NULL REFERENCES libros(id),
  ref_capitulo  INTEGER NOT NULL,
  ref_versiculo_start INTEGER NOT NULL,
  ref_versiculo_end   INTEGER NOT NULL
);

CREATE INDEX tsk_ref_source_idx ON tsk_referencias (libro_id, capitulo, versiculo);
