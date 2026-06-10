/**
 * .dctx (e-Sword dictionary) SQLite reader.
 *
 * Mirrors the bblx.ts pattern: opens a readonly better-sqlite3 connection,
 * guards the required Dictionary table, reads Topic+Definition rows, and
 * closes the connection in a finally block.
 *
 * No RTF processing here — that is the caller's responsibility.
 */
import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';

export type DctxRow = {
  Topic: string;
  Definition: string;
};

export type ParsedDctx = {
  rows: DctxRow[];
};

/**
 * Parse an e-Sword `.dctx` SQLite file, reading the Dictionary table.
 *
 * @param filePath - Absolute or relative path to the .dctx file.
 * @returns All (Topic, Definition) rows from the Dictionary table.
 * @throws If the file is missing, not a valid SQLite DB, or lacks the Dictionary table.
 */
export function parseDctx(filePath: string): ParsedDctx {
  if (!existsSync(filePath)) {
    throw new Error(`[dctx] File not found: ${filePath}`);
  }

  let db: Database.Database;
  try {
    db = new Database(filePath, { readonly: true, fileMustExist: true });
  } catch {
    throw new Error(`[dctx] Not a valid SQLite database: ${filePath}`);
  }

  try {
    const tableNames = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((row) => (row as { name: string }).name);

    if (!tableNames.includes('Dictionary')) {
      throw new Error(`[dctx] Missing required 'Dictionary' table in: ${filePath}`);
    }

    // Guard: verify Topic and Definition columns exist
    const columns = db
      .prepare("PRAGMA table_info('Dictionary')")
      .all()
      .map((row) => (row as { name: string }).name);

    if (!columns.includes('Topic') || !columns.includes('Definition')) {
      throw new Error(
        `[dctx] Dictionary table missing Topic or Definition columns. Found: ${columns.join(', ')}`,
      );
    }

    const rows = db
      .prepare('SELECT Topic, Definition FROM Dictionary')
      .all() as DctxRow[];

    return { rows };
  } finally {
    db.close();
  }
}
