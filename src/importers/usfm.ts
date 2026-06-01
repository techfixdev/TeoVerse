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
 * Words without a strong= attribute yield codigoStrong: null.
 * Does NOT modify cleanUsfmText — the plain-text import path is byte-identical.
 */
export function parseUsfmBookInterlinear(usfm: string): ParsedUsfmBookInterlinear {
  const verses: UsfmVerseWithTokens[] = [];
  let currentChapter: number | undefined;
  let currentVerse: UsfmVerseWithTokens | undefined;

  // Regex captures \w or \+w markers with their surface text and optional attributes.
  // Format: \w surface|strong="HXXXX"\w*  or  \+w surface|strong="HXXXX"\+w*
  const wTokenRe = /\\\+?w\s+([^|\\]+?)(?:\|([^\\]*))?\\\+?w\*/g;

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
        tokens: extractTokens(verseMatch[2], wTokenRe),
      };
      verses.push(currentVerse);
      continue;
    }

    // Continuation lines (poetry, paragraph markers) — append tokens
    if (currentVerse && shouldAppendToVerse(line)) {
      const extra = extractTokens(line, wTokenRe);
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

function extractTokens(text: string, re: RegExp): UsfmToken[] {
  re.lastIndex = 0;
  const tokens: UsfmToken[] = [];
  let posicion = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const palabra = match[1].trim();
    const attrs = match[2] ?? '';
    // Attribute format: strong="H7225" (may also be strong:H7225 in some editions)
    const strongMatch = attrs.match(/strong[=:"]+([A-Za-z][0-9]+)/);
    const codigoStrong = strongMatch ? strongMatch[1] : null;
    if (palabra) {
      tokens.push({ posicion, palabra, codigoStrong });
      posicion++;
    }
  }

  return tokens;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function cleanUsfmText(text: string): string {
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
