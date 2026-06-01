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
}

verifyUsfmParser().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
