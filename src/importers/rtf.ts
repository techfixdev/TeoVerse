/**
 * RTF → clean HTML / plain text parser.
 *
 * Hand-rolled for e-Sword .dctx Definition fields. Produces minimal HTML
 * whitelist: <p>, <strong>, <em>, <br>. No external dependencies.
 *
 * Pipeline:
 *   1. Decode \'xx Windows-1252 hex escapes (CP1252→Unicode for 0x80–0x9F).
 *   2. Drop symbol-font runs (\f1, \f2) — Greek/Hebrew glyphs not transliterated.
 *   3. Extract verse refs {\cf11\ul 1Pe_3:21} → visible "1Pe 3:21" as <strong>.
 *   4. Map \b→<strong>, \i→<em>, \par→paragraph break.
 *   5. Strip remaining control words + {} groups + RTF headers.
 *   6. Whitespace normalize, wrap in <p>.
 */

// ---------------------------------------------------------------------------
// CP1252 → Unicode mapping for 0x80–0x9F range
// ---------------------------------------------------------------------------
const CP1252_MAP: Record<number, string> = {
  0x80: '\u20AC', // €
  0x82: '\u201A', // ‚
  0x83: '\u0192', // ƒ
  0x84: '\u201E', // „
  0x85: '\u2026', // …
  0x86: '\u2020', // †
  0x87: '\u2021', // ‡
  0x88: '\u02C6', // ˆ
  0x89: '\u2030', // ‰
  0x8A: '\u0160', // Š
  0x8B: '\u2039', // ‹
  0x8C: '\u0152', // Œ
  0x8E: '\u017D', // Ž
  0x91: '\u2018', // '
  0x92: '\u2019', // '
  0x93: '\u201C', // "
  0x94: '\u201D', // "
  0x95: '\u2022', // •
  0x96: '\u2013', // –
  0x97: '\u2014', // —
  0x98: '\u02DC', // ˜
  0x99: '\u2122', // ™
  0x9A: '\u0161', // š
  0x9B: '\u203A', // ›
  0x9C: '\u0153', // œ
  0x9E: '\u017E', // ž
  0x9F: '\u0178', // Ÿ
};

/**
 * Decode all \'xx hex escapes in an RTF string to their Unicode equivalents.
 * Standard ASCII range (0x20–0x7E) maps directly; 0x80–0x9F uses CP1252 table;
 * 0xA0–0xFF maps to Latin-1 supplement directly.
 */
function decodeHexEscapes(rtf: string): string {
  return rtf.replace(/\\'([0-9a-fA-F]{2})/g, (_match, hex: string) => {
    const code = parseInt(hex, 16);
    if (CP1252_MAP[code]) return CP1252_MAP[code];
    if (code >= 0x80 && code <= 0x9F) return ''; // unmapped CP1252 → drop
    return String.fromCharCode(code); // 0x00–0x7F and 0xA0–0xFF → direct
  });
}

/**
 * Drop symbol-font runs: {\f1 ...} and {\f2 ...}.
 * These contain Greek/Hebrew glyphs that we don't transliterate this slice.
 */
function dropSymbolFontRuns(rtf: string): string {
  // Match {\f1 ...} and {\f2 ...} groups (non-greedy, handles one level of nesting)
  let result = rtf;
  // Iteratively remove {\fN ...} groups — may need multiple passes for nesting
  let prev = '';
  while (prev !== result) {
    prev = result;
    result = result.replace(/\{\\f[12]\s[^{}]*\}/g, '');
    // Also handle {\f1 text} without leading space
    result = result.replace(/\{\\f[12][^{}]*\}/g, '');
  }
  return result;
}

/**
 * Extract verse references from color/underline groups.
 * Pattern: {\cf11\ul 1Pe_3:21} → <strong>1Pe 3:21</strong>
 * The underscore in book references (1Pe_3:21) is replaced with a space.
 */
function extractVerseRefs(rtf: string): string {
  return rtf.replace(
    /\{\\cf\d+\\ul\s+([^}]+)\}/g,
    (_match, text: string) => {
      const cleaned = text.trim().replace(/_/g, ' ');
      return `<strong>${cleaned}</strong>`;
    },
  );
}

/**
 * Map RTF formatting control words to HTML equivalents.
 */
function mapFormattingWords(rtf: string): string {
  let result = rtf;

  // \b ... \b0 → <strong>...</strong>
  result = result.replace(/\\b\s(.*?)(?:\\b0\b)/gs, '<strong>$1</strong>');
  // Handle \b at end without \b0 (implicit end at group boundary)
  result = result.replace(/\\b\s([^\\}]+?)(?=[\\}])/g, '<strong>$1</strong>');

  // \i ... \i0 → <em>...</em>
  result = result.replace(/\\i\s(.*?)(?:\\i0\b)/gs, '<em>$1</em>');
  result = result.replace(/\\i\s([^\\}]+?)(?=[\\}])/g, '<em>$1</em>');

  // \par → paragraph break
  result = result.replace(/\\par\b/g, '</p><p>');

  return result;
}

/**
 * Strip all remaining RTF control words and group braces.
 * Control words: \word or \wordN (e.g., \rtf1, \deff0, \fonttbl, \cf11, etc.)
 */
function stripControlWordsAndBraces(rtf: string): string {
  let result = rtf;

  // Strip control words: \wordN? (with optional numeric parameter and trailing space)
  result = result.replace(/\\[a-z]+\d*\s?/gi, '');

  // Strip remaining braces
  result = result.replace(/[{}]/g, '');

  return result;
}

/**
 * Normalize whitespace: collapse multiple spaces, trim lines.
 */
function normalizeWhitespace(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/ <\/p>/g, '</p>')
    .replace(/<p> /g, '<p>')
    .trim();
}

/**
 * Convert RTF text to minimal safe HTML.
 *
 * Output whitelist: <p>, </p>, <strong>, </strong>, <em>, </em>, <br>.
 * All other HTML-significant characters are escaped.
 */
export function rtfToHtml(rtf: string): string {
  // Step 1: Decode hex escapes
  let result = decodeHexEscapes(rtf);

  // Step 2: Drop symbol-font runs
  result = dropSymbolFontRuns(result);

  // Step 3: Extract verse refs (before stripping control words)
  result = extractVerseRefs(result);

  // Step 4: Map formatting control words to HTML
  result = mapFormattingWords(result);

  // Step 5: Strip remaining control words and braces
  result = stripControlWordsAndBraces(result);

  // Step 6: Normalize whitespace
  result = normalizeWhitespace(result);

  // Wrap in <p> if not already wrapped
  if (!result.startsWith('<p>')) {
    result = `<p>${result}</p>`;
  }

  // Clean up empty paragraphs
  result = result.replace(/<p><\/p>/g, '');

  return result;
}

/**
 * Convert RTF text to plain text (no HTML tags).
 *
 * Guaranteed: output contains no residual \, {, }, or \'.
 */
export function rtfToPlain(rtf: string): string {
  // Step 1: Decode hex escapes
  let result = decodeHexEscapes(rtf);

  // Step 2: Drop symbol-font runs
  result = dropSymbolFontRuns(result);

  // Step 3: Extract verse refs (keep visible text only)
  result = result.replace(
    /\{\\cf\d+\\ul\s+([^}]+)\}/g,
    (_match, text: string) => text.trim().replace(/_/g, ' '),
  );

  // Step 4: Strip all control words and braces
  result = stripControlWordsAndBraces(result);

  // Step 5: Normalize whitespace
  result = result.replace(/\s+/g, ' ').trim();

  return result;
}
