import { createClient } from '@libsql/client';

async function main() {
  const client = createClient({ url: 'file::memory:' });
  try {
    await client.execute(`CREATE TABLE versiculos(id INTEGER PRIMARY KEY, recurso_id INTEGER, texto TEXT)`);
    await client.execute(`INSERT INTO versiculos(id, recurso_id, texto) VALUES (1, 10, 'En el principio creó Dios el corazón'), (2, 10, 'Examínara su corazón con amor')`);

    // External-content FTS5 + remove_diacritics 2
    await client.execute(`CREATE VIRTUAL TABLE versiculos_fts USING fts5(texto, content='versiculos', content_rowid='id', tokenize='unicode61 remove_diacritics 2')`);
    console.log('OK: external-content FTS5 virtual table created');

    // rebuild from external content
    await client.execute(`INSERT INTO versiculos_fts(versiculos_fts) VALUES('rebuild')`);
    console.log("OK: 'rebuild' command succeeded");

    // accent-insensitive MATCH + bm25
    const r1 = await client.execute({
      sql: `SELECT v.id, v.recurso_id, v.texto, bm25(versiculos_fts) AS score FROM versiculos_fts JOIN versiculos v ON v.id = versiculos_fts.rowid WHERE versiculos_fts MATCH ? ORDER BY score LIMIT 10`,
      args: ['corazon'],
    });
    console.log('MATCH corazon ->', r1.rows.map((x: any) => `${x.id}:${x.texto}`));

    const r2 = await client.execute({ sql: `SELECT v.id FROM versiculos_fts JOIN versiculos v ON v.id = versiculos_fts.rowid WHERE versiculos_fts MATCH ?`, args: ['examinara'] });
    console.log('MATCH examinara ->', r2.rows.map((x: any) => x.id));

    console.log('RESULT: FTS5_EXTERNAL_CONTENT_SUPPORTED');
  } catch (e) {
    console.error('FTS5 PROBE FAILED:', (e as Error).message);
    console.log('RESULT: FTS5_EXTERNAL_CONTENT_FAILED');
  } finally {
    client.close();
  }
}

main();
