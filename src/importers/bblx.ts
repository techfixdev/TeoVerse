import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';

export type ParsedBblxVerse = {
  book: number;
  chapter: number;
  verse: number;
  text: string;
};

export type BblxMetadata = {
  description: string;
  abbreviation: string;
  hasOT: boolean;
  hasNT: boolean;
};

export type ParsedBblx = {
  verses: ParsedBblxVerse[];
  metadata: BblxMetadata;
};

type BibleRow = {
  Book: number;
  Chapter: number;
  Verse: number;
  Scripture: string;
};

type DetailsRow = {
  Title?: string;
  Abbreviation?: string;
  Description?: string;
  OT?: number;
  NT?: number;
};

/**
 * Parses an e-Sword `.bblx` SQLite file into structured verse data and metadata.
 *
 * The parser is version-agnostic — it reads any `.bblx` file and returns
 * typed verse arrays with `*` footnote markers stripped from scripture text.
 * All version-specific data (book names, slugs, etc.) must be provided by
 * the caller via a separate manifest.
 */
export function parseBblx(filePath: string): ParsedBblx {
  if (!existsSync(filePath)) {
    throw new Error(`[bblx] File not found: ${filePath}`);
  }

  let db: Database.Database;
  try {
    db = new Database(filePath, { readonly: true, fileMustExist: true });
  } catch {
    throw new Error(`[bblx] Not a valid SQLite database: ${filePath}`);
  }

  try {
    const tableNames = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row) => (row as { name: string }).name);

    if (!tableNames.includes('Bible')) {
      throw new Error(`[bblx] Missing required 'Bible' table in: ${filePath}`);
    }

    const verses = readVerses(db);
    const metadata = readMetadata(db, tableNames);

    validateBookCoverage(verses);

    return { verses, metadata };
  } finally {
    db.close();
  }
}

function readVerses(db: Database.Database): ParsedBblxVerse[] {
  const rows = db
    .prepare('SELECT Book, Chapter, Verse, Scripture FROM Bible')
    .all() as BibleRow[];

  return rows.map((row) => ({
    book: row.Book,
    chapter: row.Chapter,
    verse: row.Verse,
    text: stripFootnoteMarkers(row.Scripture),
  }));
}

function stripFootnoteMarkers(text: string): string {
  return text.replace(/\*/g, '');
}

function readMetadata(db: Database.Database, tableNames: string[]): BblxMetadata {
  const empty: BblxMetadata = {
    description: '',
    abbreviation: '',
    hasOT: false,
    hasNT: false,
  };

  if (!tableNames.includes('Details')) {
    console.warn('[bblx] No Details table found — returning empty metadata.');
    return empty;
  }

  const row = db.prepare('SELECT * FROM Details LIMIT 1').get() as DetailsRow | undefined;
  if (!row) return empty;

  return {
    description: row.Title ?? row.Description ?? '',
    abbreviation: row.Abbreviation ?? '',
    hasOT: row.OT === 1,
    hasNT: row.NT === 1,
  };
}

function validateBookCoverage(verses: ParsedBblxVerse[]): void {
  const books = new Set(verses.map((v) => v.book));
  const missing: number[] = [];

  for (let i = 1; i <= 66; i++) {
    if (!books.has(i)) missing.push(i);
  }

  if (missing.length > 0) {
    console.warn(`[bblx] Book count does not cover 1–66. Missing books: ${missing.join(', ')}`);
  }
}
