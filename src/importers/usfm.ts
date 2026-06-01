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

    const verseMatch = line.match(/^\\v\s+(\d+)\s+(.+)$/);
    if (verseMatch) {
      if (currentChapter === undefined) {
        throw new Error(`USFM verse ${verseMatch[1]} appears before a chapter marker.`);
      }

      verses.push({
        chapter: currentChapter,
        verse: Number(verseMatch[1]),
        text: normalizeText(verseMatch[2]),
      });
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

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
