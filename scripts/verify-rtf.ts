/**
 * verify:rtf — PURE/CI-safe assertions for the RTF→HTML/plain parser.
 *
 * No DB, no source files required. Runs in any environment.
 * Tests rtfToHtml() and rtfToPlain() from src/importers/rtf.ts.
 */
import { rtfToHtml, rtfToPlain } from '../src/importers/rtf';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Windows-1252 hex decode: \'xx → Unicode character
// ---------------------------------------------------------------------------
{
  const html = rtfToHtml("{\\rtf1 caf\\'e9");
  assert(html.includes('é'), `Expected \\'e9 → é in HTML output, got: ${html}`);
}
{
  const plain = rtfToPlain("{\\rtf1 caf\\'e9");
  assert(plain.includes('é'), `Expected \\'e9 → é in plain output, got: ${plain}`);
}

// ---------------------------------------------------------------------------
// 2. CP1252 0x80–0x9F range sample (smart quotes, dashes, etc.)
// ---------------------------------------------------------------------------
{
  // 0x93 = left double quote, 0x94 = right double quote, 0x96 = en-dash
  const html = rtfToHtml("{\\rtf1 \\'93hola\\'94 \\'96 mundo");
  assert(html.includes('\u201C'), `Expected \\x93 → left double quote, got: ${html}`);
  assert(html.includes('\u201D'), `Expected \\x94 → right double quote, got: ${html}`);
  assert(html.includes('\u2013'), `Expected \\x96 → en-dash, got: ${html}`);
}

// ---------------------------------------------------------------------------
// 3. Control word mapping: \b → <strong>, \i → <em>, \par → paragraph
// ---------------------------------------------------------------------------
{
  const html = rtfToHtml('{\\rtf1 texto \\b negrita\\b0  normal \\i cursiva\\i0  fin');
  assert(html.includes('<strong>'), `Expected \\b → <strong>, got: ${html}`);
  assert(html.includes('</strong>'), `Expected \\b0 → </strong>, got: ${html}`);
  assert(html.includes('<em>'), `Expected \\i → <em>, got: ${html}`);
  assert(html.includes('</em>'), `Expected \\i0 → </em>, got: ${html}`);
}
{
  const html = rtfToHtml('{\\rtf1 para uno\\par para dos\\par para tres}');
  // \par should produce paragraph breaks (multiple <p> or <br>)
  const pCount = (html.match(/<p>/g) || []).length;
  const brCount = (html.match(/<br>/g) || []).length;
  assert(
    pCount >= 2 || brCount >= 2,
    `Expected \\par to produce paragraphs/br, got ${pCount} <p> and ${brCount} <br> in: ${html}`,
  );
}

// ---------------------------------------------------------------------------
// 4. Verse references: {\cf11\ul 1Pe_3:21} → visible "1Pe 3:21" (bold)
// ---------------------------------------------------------------------------
{
  const html = rtfToHtml('{\\rtf1 ver {\\cf11\\ul 1Pe_3:21} aqui}');
  assert(
    html.includes('1Pe') && html.includes('3:21'),
    `Expected verse ref "1Pe 3:21" visible in output, got: ${html}`,
  );
  // Underscore in ref should be replaced with space
  assert(
    !html.includes('1Pe_3'),
    `Expected underscore removed in verse ref, got: ${html}`,
  );
}

// ---------------------------------------------------------------------------
// 5. Symbol-font runs (\f1, \f2) dropped — Greek/Hebrew glyphs removed
// ---------------------------------------------------------------------------
{
  const html = rtfToHtml('{\\rtf1 antes {\\f1 abcdef} despues}');
  assert(
    html.includes('antes') && html.includes('despues'),
    `Expected surrounding text preserved when \\f1 dropped, got: ${html}`,
  );
  // The symbol font glyphs should NOT appear
  assert(
    !html.includes('abcdef'),
    `Expected \\f1 symbol glyphs dropped, got: ${html}`,
  );
}

// ---------------------------------------------------------------------------
// 6. Strip remaining control words and {} groups
// ---------------------------------------------------------------------------
{
  const html = rtfToHtml('{\\rtf1\\deff0{\\fonttbl{\\f0 Arial;}} texto simple}');
  assert(
    html.includes('texto simple'),
    `Expected "texto simple" preserved, got: ${html}`,
  );
  assert(
    !html.includes('\\deff0') && !html.includes('\\fonttbl'),
    `Expected control words stripped, got: ${html}`,
  );
}

// ---------------------------------------------------------------------------
// 7. rtfToPlain cleanliness: no residual \, {, }, \'
// ---------------------------------------------------------------------------
{
  const plain = rtfToPlain(
    "{\\rtf1\\deff0{\\fonttbl{\\f0 Arial;}}{\\cf11\\ul 1Pe_3:21} caf\\'e9 \\b bold\\b0 }",
  );
  assert(!plain.includes('\\'), `rtfToPlain has residual backslash: ${plain}`);
  assert(!plain.includes('{'), `rtfToPlain has residual opening brace: ${plain}`);
  assert(!plain.includes('}'), `rtfToPlain has residual closing brace: ${plain}`);
  assert(!plain.includes("'"), `rtfToPlain has residual quote mark from \\'xx: ${plain}`);
}

// ---------------------------------------------------------------------------
// 8. Multi-code extraction helper (used by lexicon adapter)
// ---------------------------------------------------------------------------
{
  // The RTF parser should handle text with multiple Strong codes in parens
  const html = rtfToHtml('{\\rtf1 palabra (ver, H430, G25) otra}');
  assert(
    html.includes('H430') && html.includes('G25'),
    `Expected Strong codes preserved in HTML, got: ${html}`,
  );
}

console.info('verify:rtf PASSED.');
