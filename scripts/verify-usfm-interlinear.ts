import { readFile } from 'node:fs/promises';
import { parseUsfmBookInterlinear } from '../src/importers/usfm';

// Genesis 1:1 from spapddpt has:
//   \w principio|strong="H7225"\w*  →  codigoStrong = "H7225", palabra = "principio"
//   \w cielos|strong="H8064"\w*     →  codigoStrong = "H8064", palabra = "cielos"

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

async function verifyUsfmInterlinear(): Promise<void> {
  // Test 1: inline USFM snippet — standard \w marker
  const snippet = `\\id GEN
\\toc1 Génesis
\\toc2 Génesis
\\toc3 Gn
\\c 1
\\v 1 En un \\w principio|strong="H7225"\\w* \\nd ʼElohim\\nd* creó los \\w cielos|strong="H8064"\\w* y la tierra.
\\v 2 Palabra \\w sin|strong="H1234"\\w* \\w código\\w* extra.
`;

  const result = parseUsfmBookInterlinear(snippet);
  assert(result.verses.length === 2, 'Expected 2 verses parsed from snippet.');

  const v1 = result.verses[0];
  assert(v1 !== undefined, 'Expected verse 1 to be defined.');
  assert(v1.chapter === 1, 'Expected verse to be in chapter 1.');
  assert(v1.verse === 1, 'Expected verse number 1.');
  assert(v1.tokens.length === 2, `Expected 2 tokens in v1, got ${v1.tokens.length}.`);

  const t0 = v1.tokens[0];
  assert(t0 !== undefined, 'Expected first token to be defined.');
  assert(t0.palabra === 'principio', `Expected primera palabra "principio", got "${t0.palabra}".`);
  assert(t0.codigoStrong === 'H7225', `Expected codigoStrong "H7225", got "${t0.codigoStrong}".`);
  assert(t0.posicion === 0, `Expected posicion 0, got ${t0.posicion}.`);

  const t1 = v1.tokens[1];
  assert(t1 !== undefined, 'Expected second token to be defined.');
  assert(t1.palabra === 'cielos', `Expected segunda palabra "cielos", got "${t1.palabra}".`);
  assert(t1.codigoStrong === 'H8064', `Expected codigoStrong "H8064", got "${t1.codigoStrong}".`);
  assert(t1.posicion === 1, `Expected posicion 1, got ${t1.posicion}.`);

  // Test 2: word with no strong code should yield codigoStrong null
  const v2 = result.verses[1];
  assert(v2 !== undefined, 'Expected verse 2 to be defined.');
  assert(v2.tokens.length === 2, `Expected 2 tokens in v2 (sin + código), got ${v2.tokens.length}.`);
  const noStrong = v2.tokens[1];
  assert(noStrong !== undefined, 'Expected second token in v2 to be defined.');
  assert(noStrong.codigoStrong === null, `Expected null codigoStrong for word without strong code, got "${noStrong.codigoStrong}".`);

  // Test 3: \+w variant (inside \wj spans) — used in the spapddpt source
  const wjSnippet = `\\id GEN
\\toc1 Génesis
\\toc2 Génesis
\\toc3 Gn
\\c 1
\\v 3 Entonces \\nd ʼElohim\\nd* dijo: \\wj \\+w Haya|strong="H1961"\\+w* luz.\\wj*
`;

  const wjResult = parseUsfmBookInterlinear(wjSnippet);
  assert(wjResult.verses.length === 1, 'Expected 1 verse from \\+w snippet.');
  const wjVerse = wjResult.verses[0];
  assert(wjVerse !== undefined, 'Expected wjVerse to be defined.');
  assert(wjVerse.tokens.length === 1, `Expected 1 token from \\+w variant, got ${wjVerse.tokens.length}.`);
  const wjToken = wjVerse.tokens[0];
  assert(wjToken !== undefined, 'Expected wjToken to be defined.');
  assert(wjToken.palabra === 'Haya', `Expected "Haya" from \\+w variant, got "${wjToken.palabra}".`);
  assert(wjToken.codigoStrong === 'H1961', `Expected codigoStrong "H1961" from \\+w variant, got "${wjToken.codigoStrong}".`);

  // Test 4: parse the actual spapddpt Genesis file from zip (integration smoke test)
  const fixturePath = new URL('../fixtures/usfm/spapddpt-genesis-1.usfm', import.meta.url);
  const fixtureUsfm = await readFile(fixturePath, 'utf8');
  const fixtureResult = parseUsfmBookInterlinear(fixtureUsfm);

  // The fixture has no \w markers (it's a simplified fixture), so we just check it doesn't crash
  assert(Array.isArray(fixtureResult.verses), 'Expected verses array from fixture parse.');
  // Fixture has 5 verses, none have \w tokens, so token arrays should be empty
  for (const verse of fixtureResult.verses) {
    assert(Array.isArray(verse.tokens), `Expected tokens array on verse ${verse.chapter}:${verse.verse}.`);
  }

  console.info('verify:usfm-interlinear PASSED — parser handles \\w, \\+w, null codes, and fixture.');
}

verifyUsfmInterlinear().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
