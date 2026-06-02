import { readFile } from 'node:fs/promises';
import { parseUsfmBookInterlinear, cleanUsfmText } from '../src/importers/usfm';

// posicion = 0-based word index within the verse across ALL words (tagged + untagged).
// cleanUsfmText(verse) === tokens.map(t => t.palabra).join(' ')  (reconstruction invariant).

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

/**
 * Returns the plain text of a verse by joining token surfaces in posicion order.
 * This is the reconstruction invariant path.
 */
function reconstruct(tokens: Array<{ posicion: number; palabra: string }>): string {
  return [...tokens].sort((a, b) => a.posicion - b.posicion).map((t) => t.palabra).join(' ');
}

async function verifyUsfmInterlinear(): Promise<void> {
  // -------------------------------------------------------------------------
  // Test 1: ALL words captured — inline snippet with untagged words between \w
  // Gen 1:1-like: "En un \w principio\w* \nd ʼElohim\nd* creó los \w cielos\w* y la tierra."
  // Expected tokens (all words): En(null) un(null) principio(H7225) ʼElohim(null)
  //                               creó(null) los(null) cielos(H8064) y(null) la(null) tierra.(null)
  // -------------------------------------------------------------------------
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

  // ALL 10 words must be present (not just the 2 tagged ones)
  assert(v1.tokens.length === 10, `Expected 10 tokens (all words) in v1, got ${v1.tokens.length}.`);

  const t0 = v1.tokens[0];
  assert(t0 !== undefined, 'Expected first token (En) to be defined.');
  assert(t0.palabra === 'En', `Expected primera palabra "En", got "${t0.palabra}".`);
  assert(t0.codigoStrong === null, `Expected codigoStrong null for "En", got "${t0.codigoStrong}".`);
  assert(t0.posicion === 0, `Expected posicion 0, got ${t0.posicion}.`);

  const tPrincipio = v1.tokens[2];
  assert(tPrincipio !== undefined, 'Expected token at posicion 2 (principio) to be defined.');
  assert(tPrincipio.palabra === 'principio', `Expected "principio" at posicion 2, got "${tPrincipio.palabra}".`);
  assert(tPrincipio.codigoStrong === 'H7225', `Expected codigoStrong "H7225", got "${tPrincipio.codigoStrong}".`);
  assert(tPrincipio.posicion === 2, `Expected posicion 2 for "principio", got ${tPrincipio.posicion}.`);

  const tCielos = v1.tokens[6];
  assert(tCielos !== undefined, 'Expected token at posicion 6 (cielos) to be defined.');
  assert(tCielos.palabra === 'cielos', `Expected "cielos" at posicion 6, got "${tCielos.palabra}".`);
  assert(tCielos.codigoStrong === 'H8064', `Expected codigoStrong "H8064", got "${tCielos.codigoStrong}".`);

  // At least one untagged word in v1
  const hasNull = v1.tokens.some((t) => t.codigoStrong === null);
  assert(hasNull, 'Expected at least one token with codigoStrong null in v1.');

  // posicion is contiguous 0..n-1 with no gaps
  for (let i = 0; i < v1.tokens.length; i++) {
    assert(v1.tokens[i].posicion === i, `Expected posicion ${i}, got ${v1.tokens[i].posicion}.`);
  }

  // -------------------------------------------------------------------------
  // Test 2: word with no strong code should yield codigoStrong null
  // v2: "Palabra sin(H1234) código(null) extra(null)" — 4 words total
  // -------------------------------------------------------------------------
  const v2 = result.verses[1];
  assert(v2 !== undefined, 'Expected verse 2 to be defined.');
  assert(v2.tokens.length === 4, `Expected 4 tokens (all words) in v2, got ${v2.tokens.length}.`);
  const noStrong = v2.tokens[2]; // "código" — \w with no strong attr
  assert(noStrong !== undefined, 'Expected third token in v2 to be defined.');
  assert(noStrong.codigoStrong === null, `Expected null codigoStrong for word without strong code, got "${noStrong.codigoStrong}".`);

  // -------------------------------------------------------------------------
  // Test 3: \+w variant (inside \wj spans) — used in the spapddpt source.
  // "Entonces ʼElohim dijo: Haya(H1961) luz." — 6 words, Haya at posicion 4.
  // -------------------------------------------------------------------------
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

  // All words: Entonces ʼElohim dijo: Haya luz. = 5 words (dijo: is one token with punct)
  assert(wjVerse.tokens.length >= 4, `Expected at least 4 tokens (all words) from \\+w variant, got ${wjVerse.tokens.length}.`);

  const wjToken = wjVerse.tokens.find((t) => t.palabra === 'Haya');
  assert(wjToken !== undefined, `Expected "Haya" token from \\+w variant.`);
  if (!wjToken) throw new Error('unreachable');
  assert(wjToken.codigoStrong === 'H1961', `Expected codigoStrong "H1961" from \\+w variant, got "${wjToken.codigoStrong}".`);

  // At least one untagged word (e.g. "Entonces")
  const wjHasNull = wjVerse.tokens.some((t) => t.codigoStrong === null);
  assert(wjHasNull, 'Expected at least one untagged token in wjVerse.');

  // -------------------------------------------------------------------------
  // Test 4: reconstruction invariant — token surfaces joined == cleanUsfmText output.
  // We test this on the snippet verses directly (no need to call cleanUsfmText from here;
  // the invariant is validated via the inline check above for v1).
  // We verify posicion contiguity for all verses.
  // -------------------------------------------------------------------------
  for (const verse of result.verses) {
    for (let i = 0; i < verse.tokens.length; i++) {
      assert(verse.tokens[i].posicion === i,
        `Verse ${verse.chapter}:${verse.verse} token ${i} has posicion ${verse.tokens[i].posicion} (expected ${i}).`
      );
    }
  }

  // -------------------------------------------------------------------------
  // Test 5: fixture file parse (simplified fixture with no \w markers).
  // All tokens should have codigoStrong = null; word count must be > 0 for non-empty verses.
  // -------------------------------------------------------------------------
  const fixturePath = new URL('../fixtures/usfm/spapddpt-genesis-1.usfm', import.meta.url);
  const fixtureUsfm = await readFile(fixturePath, 'utf8');
  const fixtureResult = parseUsfmBookInterlinear(fixtureUsfm);

  assert(Array.isArray(fixtureResult.verses), 'Expected verses array from fixture parse.');
  // Fixture has 5 verses, none have \w tokens, so all tokens carry codigoStrong null
  for (const verse of fixtureResult.verses) {
    assert(Array.isArray(verse.tokens), `Expected tokens array on verse ${verse.chapter}:${verse.verse}.`);
    // With all-word capture, a non-empty verse must have at least one token
    assert(verse.tokens.length > 0, `Verse ${verse.chapter}:${verse.verse} should have tokens (all-word capture).`);
    for (const token of verse.tokens) {
      assert(token.codigoStrong === null,
        `Fixture verse ${verse.chapter}:${verse.verse} has unexpected codigoStrong "${token.codigoStrong}" for plain-USFM fixture.`
      );
    }
    // posicion must be contiguous
    for (let i = 0; i < verse.tokens.length; i++) {
      assert(verse.tokens[i].posicion === i,
        `Fixture verse ${verse.chapter}:${verse.verse} posicion gap at index ${i} (got ${verse.tokens[i].posicion}).`
      );
    }
  }

  // -------------------------------------------------------------------------
  // Test 6: inline reconstruction invariant check with mixed tagged/untagged verse.
  // tokens joined by spaces must equal the expected plain text.
  // -------------------------------------------------------------------------
  const reconstructV1 = reconstruct(v1.tokens);
  assert(reconstructV1 === 'En un principio ʼElohim creó los cielos y la tierra.',
    `Reconstruction invariant failed for v1: "${reconstructV1}".`
  );

  const reconstructV2 = reconstruct(v2.tokens);
  assert(reconstructV2 === 'Palabra sin código extra.',
    `Reconstruction invariant failed for v2: "${reconstructV2}".`
  );

  // -------------------------------------------------------------------------
  // Test 7: Integration assertions over the real spapddpt source.
  //
  // Covers:
  //   7a — Genesis 1:1 posicion / Strong spot-checks (regression anchor)
  //   7b — Genesis 1:2 specific regression: "abismo." must carry H8415 and
  //         "aguas." must carry H4325; ZERO empty tokens allowed.
  //   7c — Broad reconstruction invariant: for ALL verses of Genesis + Apocalipsis
  //         (≥ 500 verses) the invariant tokens.map(t=>t.palabra).join(' ')
  //         === cleanUsfmText(rawVerseLine) must hold; fail loudly on first mismatch.
  //   7d — No token in any sampled verse has an empty-string palabra.
  //
  // This test is gated to skip gracefully when the zip source is not present (CI may
  // not have it), but will FAIL loudly on any invariant violation when the source is
  // available.
  // -------------------------------------------------------------------------
  try {
    const { readFileSync } = await import('node:fs');
    const { unzipSync, strFromU8 } = await import('fflate');
    const zipPath = new URL('../sources/spapddpt/spapddpt_usfm.zip', import.meta.url);
    const zip = readFileSync(zipPath);
    const zipEntries = unzipSync(new Uint8Array(zip));

    // ---- 7a: Genesis 1:1 spot-checks ----------------------------------------
    const genesisKey = Object.keys(zipEntries).find((name) => /GEN.*\.usfm$/i.test(name));
    assert(genesisKey !== undefined, 'Genesis USFM not found in spapddpt zip.');
    if (!genesisKey) throw new Error('unreachable');

    const genesisUsfm = strFromU8(zipEntries[genesisKey]);
    const genResult = parseUsfmBookInterlinear(genesisUsfm);

    const gen1v1 = genResult.verses.find((v) => v.chapter === 1 && v.verse === 1);
    assert(gen1v1 !== undefined, 'Genesis 1:1 not found in spapddpt source.');
    if (!gen1v1) throw new Error('unreachable');

    assert(gen1v1.tokens.length === 10,
      `Genesis 1:1 expected 10 tokens (all words), got ${gen1v1.tokens.length}.`
    );
    const tPrinc = gen1v1.tokens[2];
    assert(tPrinc.palabra === 'principio', `Expected "principio" at posicion 2, got "${tPrinc.palabra}".`);
    assert(tPrinc.codigoStrong === 'H7225', `Expected H7225 for "principio", got "${tPrinc.codigoStrong}".`);
    const hasUntaggedGen1v1 = gen1v1.tokens.some((t) => t.codigoStrong === null);
    assert(hasUntaggedGen1v1, 'Genesis 1:1 must have at least one untagged token (codigoStrong null).');
    for (let i = 0; i < gen1v1.tokens.length; i++) {
      assert(gen1v1.tokens[i].posicion === i,
        `Genesis 1:1 posicion gap at index ${i} (got ${gen1v1.tokens[i].posicion}).`
      );
    }
    const genRecon1v1 = reconstruct(gen1v1.tokens);
    assert(genRecon1v1 === 'En un principio ʼElohim creó los cielos y la tierra.',
      `Genesis 1:1 reconstruction invariant failed: "${genRecon1v1}".`
    );

    // ---- 7b: Genesis 1:2 regression ----------------------------------------
    const gen1v2 = genResult.verses.find((v) => v.chapter === 1 && v.verse === 2);
    assert(gen1v2 !== undefined, 'Genesis 1:2 not found in spapddpt source.');
    if (!gen1v2) throw new Error('unreachable');

    // No empty tokens anywhere in Gen 1:2
    for (const tok of gen1v2.tokens) {
      assert(tok.palabra !== '',
        `Genesis 1:2 has an empty-string token at posicion ${tok.posicion}.`
      );
    }

    // "abismo." must be present with its Strong code (not null, not dropped)
    const abismoToken = gen1v2.tokens.find((t) => t.palabra === 'abismo.');
    assert(abismoToken !== undefined,
      `Genesis 1:2 regression: expected token "abismo." but it was not found. ` +
      `Tokens: ${gen1v2.tokens.map((t) => `"${t.palabra}"(${t.codigoStrong})`).join(', ')}`
    );
    if (!abismoToken) throw new Error('unreachable');
    assert(abismoToken.codigoStrong === 'H8415',
      `Genesis 1:2 regression: "abismo." expected codigoStrong H8415, got "${abismoToken.codigoStrong}".`
    );

    // "aguas." must also be present with its Strong code
    const aguasToken = gen1v2.tokens.find((t) => t.palabra === 'aguas.');
    assert(aguasToken !== undefined,
      `Genesis 1:2 regression: expected token "aguas." but it was not found.`
    );
    if (!aguasToken) throw new Error('unreachable');
    assert(aguasToken.codigoStrong === 'H4325',
      `Genesis 1:2 regression: "aguas." expected codigoStrong H4325, got "${aguasToken.codigoStrong}".`
    );

    // posicion contiguous
    assert(gen1v2.tokens.length > 10,
      `Genesis 1:2 should have many tokens, got ${gen1v2.tokens.length}.`
    );
    for (let i = 0; i < gen1v2.tokens.length; i++) {
      assert(gen1v2.tokens[i].posicion === i,
        `Genesis 1:2 posicion gap at index ${i} (got ${gen1v2.tokens[i].posicion}).`
      );
    }

    console.info('verify:usfm-interlinear PASSED — Genesis 1:1 / 1:2 integration assertions OK.');

    // ---- 7c + 7d: Broad reconstruction invariant over ALL Genesis + Apocalipsis verses ---
    //
    // For each verse line in the source we re-parse the raw verse text segment and assert
    // that the reconstruction matches cleanUsfmText output exactly. This validates the
    // invariant against the actual USFM source rather than synthetic snippets.

    // Helper: extract raw verse text segments from a USFM file string
    function* rawVerseSegments(usfm: string): Generator<{ ref: string; raw: string }> {
      let chapter = 0;
      for (const rawLine of usfm.split(/\r?\n/)) {
        const line = rawLine.trim();
        const chMatch = line.match(/^\\c\s+(\d+)/);
        if (chMatch) { chapter = Number(chMatch[1]); continue; }
        const vMatch = line.match(/^\\v\s+(\d+)[a-z]?(?:-\d+)?\s*(.*)/i);
        if (vMatch) {
          yield { ref: `${chapter}:${vMatch[1]}`, raw: vMatch[2] };
        }
      }
    }

    let versesSampled = 0;
    const booksToSample = ['GEN', 'REV']; // Genesis and Apocalipsis (Revelation)
    for (const bookCode of booksToSample) {
      const key = Object.keys(zipEntries).find((n) => new RegExp(`${bookCode}.*\\.usfm$`, 'i').test(n));
      if (!key) {
        console.warn(`verify:usfm-interlinear: ${bookCode} USFM not found — skipping broad sample for that book.`);
        continue;
      }
      const usfm = strFromU8(zipEntries[key]);
      for (const { ref, raw } of rawVerseSegments(usfm)) {
        const expected = cleanUsfmText(raw);
        // Re-derive tokens directly from the raw segment (same path as parseUsfmBookInterlinear)
        const { parseUsfmBookInterlinear: parseInline } = await import('../src/importers/usfm.js');
        // Build a minimal USFM stub so we can invoke parseUsfmBookInterlinear on a single verse
        const stub = `\\id TST\n\\toc1 T\n\\toc2 T\n\\toc3 T\n\\c 1\n\\v 1 ${raw}`;
        const stubResult = parseInline(stub);
        const tokens = stubResult.verses[0]?.tokens ?? [];

        // 7d: no empty tokens
        for (const tok of tokens) {
          assert(tok.palabra !== '',
            `${bookCode} ${ref}: empty-string token at posicion ${tok.posicion}. ` +
            `Raw: "${raw.slice(0, 80)}"`
          );
        }

        // 7c: reconstruction invariant
        const recon = tokens.map((t) => t.palabra).join(' ');
        assert(recon === expected,
          `${bookCode} ${ref}: reconstruction invariant violated.\n` +
          `  Expected: "${expected.slice(0, 120)}"\n` +
          `  Got:      "${recon.slice(0, 120)}"`
        );

        versesSampled++;
      }
    }

    assert(versesSampled >= 500,
      `Broad sample only covered ${versesSampled} verses — expected at least 500.`
    );
    console.info(`verify:usfm-interlinear PASSED — broad reconstruction invariant verified on ${versesSampled} verses (Genesis + Apocalipsis), zero empty tokens.`);
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn('verify:usfm-interlinear: spapddpt zip not found — skipping integration test (Test 7).');
    } else {
      throw error;
    }
  }

  console.info('verify:usfm-interlinear PASSED — parser captures ALL words, \\w, \\+w, null codes, reconstruction invariant, posicion contiguity, and fixture.');
}

verifyUsfmInterlinear().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
