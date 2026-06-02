export type UsfmToken = {
  posicion: number;
  palabra: string;
  codigoStrong: string | null;
};

export type UsfmVerseWithTokens = {
  chapter: number;
  verse: number;
  tokens: UsfmToken[];
};

export type ParsedUsfmBookInterlinear = {
  verses: UsfmVerseWithTokens[];
};

export type UsfmBookMetadata = {
  id: string;
  toc1: string;
  toc2: string;
  toc3: string;
};

export type UsfmVerse = {
  chapter: number;
  verse: number;
  text: string;
};

export type ParsedUsfmBook = {
  book: UsfmBookMetadata;
  verses: UsfmVerse[];
};

export function parseUsfmBook(usfm: string): ParsedUsfmBook {
  const book: Partial<UsfmBookMetadata> = {};
  const verses: UsfmVerse[] = [];
  let currentChapter: number | undefined;
  let currentVerse: UsfmVerse | undefined;

  for (const rawLine of usfm.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const idMatch = line.match(/^\\id\s+(\S+)/);
    if (idMatch) {
      book.id = idMatch[1];
      continue;
    }

    const tocMatch = line.match(/^\\(toc[123])\s+(.+)$/);
    if (tocMatch) {
      book[tocMatch[1] as 'toc1' | 'toc2' | 'toc3'] = normalizeText(tocMatch[2]);
      continue;
    }

    const chapterMatch = line.match(/^\\c\s+(\d+)/);
    if (chapterMatch) {
      currentChapter = Number(chapterMatch[1]);
      continue;
    }

    const verseMatch = line.match(/^\\v\s+(\d+)[a-z]?(?:-\d+)?\s*(.*)$/i);
    if (verseMatch) {
      if (currentChapter === undefined) {
        throw new Error(`USFM verse ${verseMatch[1]} appears before a chapter marker.`);
      }

      currentVerse = {
        chapter: currentChapter,
        verse: Number(verseMatch[1]),
        text: cleanUsfmText(verseMatch[2]),
      };
      verses.push(currentVerse);
      continue;
    }

    if (currentVerse && shouldAppendToVerse(line)) {
      const continuation = cleanUsfmText(line);
      if (continuation) {
        currentVerse.text = normalizeText(`${currentVerse.text} ${continuation}`);
      }
    }
  }

  if (!book.id) throw new Error('USFM book is missing an \\id marker.');
  if (!book.toc1) throw new Error('USFM book is missing a \\toc1 marker.');
  if (!book.toc2) throw new Error('USFM book is missing a \\toc2 marker.');
  if (!book.toc3) throw new Error('USFM book is missing a \\toc3 marker.');

  return {
    book: book as UsfmBookMetadata,
    verses,
  };
}

/**
 * Parses USFM source into per-verse interlinear token lists (word + Strong code).
 * Handles both \w and \+w variants (the latter appears inside \wj spans).
 *
 * ALL words of each verse are captured, in reading order:
 *   - posicion = 0-based word index within the verse across ALL words (tagged AND untagged).
 *   - Tagged words (\w surface|strong:CODE\w*) carry their codigoStrong.
 *   - Untagged words carry codigoStrong = null.
 *   - The ordered token stream (joined by spaces) reconstructs the verse plain text
 *     produced by cleanUsfmText — the reconstruction invariant.
 *
 * If a \w marker's surface text contains multiple whitespace-separated words, each word
 * becomes a separate token carrying the same codigoStrong (a single lexeme can span
 * multiple surface words in some editions).
 *
 * Does NOT modify cleanUsfmText — the plain-text import path is byte-identical.
 */
export function parseUsfmBookInterlinear(usfm: string): ParsedUsfmBookInterlinear {
  const verses: UsfmVerseWithTokens[] = [];
  let currentChapter: number | undefined;
  let currentVerse: UsfmVerseWithTokens | undefined;

  for (const rawLine of usfm.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const chapterMatch = line.match(/^\\c\s+(\d+)/);
    if (chapterMatch) {
      currentChapter = Number(chapterMatch[1]);
      currentVerse = undefined;
      continue;
    }

    const verseMatch = line.match(/^\\v\s+(\d+)[a-z]?(?:-\d+)?\s*(.*)/i);
    if (verseMatch) {
      if (currentChapter === undefined) continue;
      currentVerse = {
        chapter: currentChapter,
        verse: Number(verseMatch[1]),
        tokens: extractAllTokens(verseMatch[2]),
      };
      verses.push(currentVerse);
      continue;
    }

    // Continuation lines (poetry, paragraph markers) — append tokens with offset
    if (currentVerse && shouldAppendToVerse(line)) {
      const extra = extractAllTokens(line);
      if (extra.length > 0) {
        const offset = currentVerse.tokens.length;
        for (const token of extra) {
          currentVerse.tokens.push({ ...token, posicion: token.posicion + offset });
        }
      }
    }
  }

  return { verses };
}

/**
 * Extracts ALL words from a USFM text segment (one verse line or continuation) as tokens,
 * preserving reading order. Uses the same cleaning rules as cleanUsfmText so that
 * joining the returned token surfaces (in posicion order) equals the plain text produced
 * by cleanUsfmText for the same segment.
 *
 * Strategy:
 *   1. Scan the raw text for \w/\+w markers in left-to-right order, collecting each tagged
 *      surface and its Strong code into a queue.
 *   2. Compute the clean word list by calling cleanUsfmText (the same function used by the
 *      plain-text import path), which handles all punctuation adjacency, marker removal, and
 *      whitespace normalisation correctly.
 *   3. Walk the clean words in order and assign Strong codes by matching each clean word
 *      against the front of the tagged queue: a clean word matches the next tagged surface
 *      when it CONTAINS that surface as a substring (punctuation may be glued before or after
 *      the surface by cleanUsfmText). Unmatched words get codigoStrong = null.
 *
 * This approach guarantees the reconstruction invariant by construction — the token surfaces
 * ARE the clean words — and is immune to adjacent-punctuation issues because the punctuation
 * attachment is delegated entirely to cleanUsfmText.
 */
function extractAllTokens(text: string): UsfmToken[] {
  // Step 1: collect tagged surfaces in document order
  const taggedQueue: Array<{ surface: string; codigoStrong: string | null }> = [];

  const wTagRe = /\\\+?w\s+([^|\\]+?)(?:\|([^\\]*))?\\\+?w\*/g;
  for (const match of text.matchAll(wTagRe)) {
    const surface = match[1].trim();
    const attrs = match[2] ?? '';
    const strongMatch = attrs.match(/strong[=:"]+([A-Za-z][0-9]+)/);
    const codigoStrong = strongMatch ? strongMatch[1] : null;
    // A \w span can cover multiple whitespace-separated surface words; each becomes its own token
    for (const word of surface.split(/\s+/).filter(Boolean)) {
      taggedQueue.push({ surface: word, codigoStrong });
    }
  }

  // Step 2: obtain the authoritative clean word list via cleanUsfmText
  const cleanText = cleanUsfmText(text);
  if (!cleanText) return [];
  const cleanWords = cleanText.split(/\s+/).filter(Boolean);

  // Step 3: assign Strong codes — each clean word is checked against the next tagged surface
  const tokens: UsfmToken[] = [];
  let tagIndex = 0;

  for (let posicion = 0; posicion < cleanWords.length; posicion++) {
    const palabra = cleanWords[posicion];
    if (tagIndex < taggedQueue.length && palabra.includes(taggedQueue[tagIndex].surface)) {
      tokens.push({ posicion, palabra, codigoStrong: taggedQueue[tagIndex].codigoStrong });
      tagIndex++;
    } else {
      tokens.push({ posicion, palabra, codigoStrong: null });
    }
  }

  return tokens;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function cleanUsfmText(text: string): string {
  return normalizeText(
    text
      .replace(/\\f\s[\s\S]*?\\f\*/g, '')
      .replace(/\\x\s[\s\S]*?\\x\*/g, '')
      .replace(/\\\+?w\s+([^|\\]+)(?:\|[^\\]*)?\\\+?w\*/g, '$1')
      .replace(/\\\+?(?:wj|add|it|bd|em|nd|sc|qt)\s+/g, '')
      .replace(/\\\+?(?:wj|add|it|bd|em|nd|sc|qt)\*/g, '')
      .replace(/\\[a-z0-9+]+\*?/gi, ''),
  );
}

function shouldAppendToVerse(line: string): boolean {
  if (!line.startsWith('\\')) return true;
  return /^\\(?:q\d*|m|mi|nb|pi\d*|li\d*)\b/.test(line);
}
