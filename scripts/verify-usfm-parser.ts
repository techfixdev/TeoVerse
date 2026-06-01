import { readFile } from 'node:fs/promises';
import { parseUsfmBook } from '../src/importers/usfm';

const fixturePath = new URL('../fixtures/usfm/spapddpt-genesis-1.usfm', import.meta.url);

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} Expected ${String(expected)}, got ${String(actual)}.`);
  }
}

async function verifyUsfmParser() {
  const fixture = await readFile(fixturePath, 'utf8');
  const parsed = parseUsfmBook(fixture);

  assertEqual(parsed.book.id, 'GEN', 'Expected parser to read the USFM book id.');
  assertEqual(parsed.book.toc1, 'Génesis', 'Expected parser to read toc1.');
  assertEqual(parsed.book.toc2, 'Génesis', 'Expected parser to read toc2.');
  assertEqual(parsed.book.toc3, 'Gn', 'Expected parser to read toc3.');
  assertEqual(parsed.verses.length, 5, 'Expected parser to return the five fixture verses.');
  assertEqual(parsed.verses[0]?.chapter, 1, 'Expected first verse to be in chapter 1.');
  assertEqual(parsed.verses[0]?.verse, 1, 'Expected first verse number to be 1.');
  assertEqual(
    parsed.verses[0]?.text,
    'En un principio ʼElohim creó los cielos y la tierra.',
    'Expected parser to keep verse text.',
  );
  assertEqual(parsed.verses[4]?.verse, 5, 'Expected final fixture verse number to be 5.');

  const realistic = parseUsfmBook(String.raw`\id JHN
\toc1 Juan
\toc2 Juan
\toc3 Jn
\c 3
\p
\v 16 Porque de tal manera amó Dios al mundo\f + \ft nota omitida\f*, que dio a su Hijo unigénito,
\q1 para que todo el que cree en Él no perezca,
\q2 sino que tenga vida eterna. \wj Palabras limpias\wj*
\s1 Encabezado que no debe entrar al versículo
\v 17 Porque Dios no envió a su Hijo al mundo para condenar al mundo.`);

  assertEqual(realistic.book.id, 'JHN', 'Expected parser to read realistic USFM book id.');
  assertEqual(realistic.book.toc1, 'Juan', 'Expected parser to read realistic toc1.');
  assertEqual(realistic.verses.length, 2, 'Expected parser to join wrapped verse text without importing paragraph lines as verses.');
  assertEqual(realistic.verses[0]?.chapter, 3, 'Expected realistic first verse to stay in chapter 3.');
  assertEqual(realistic.verses[0]?.verse, 16, 'Expected realistic first verse number to be 16.');
  assertEqual(
    realistic.verses[0]?.text,
    'Porque de tal manera amó Dios al mundo, que dio a su Hijo unigénito, para que todo el que cree en Él no perezca, sino que tenga vida eterna. Palabras limpias',
    'Expected parser to strip footnotes and character markers while joining wrapped verse lines.',
  );
}

verifyUsfmParser().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
