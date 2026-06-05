import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';
import { db } from '../src/db/client';
import { tskReferencias, libros } from '../src/db/schema';

const TSK_ZIP_URL = 'https://a.openbible.info/data/cross-references.zip';
const sourceDir = path.resolve('sources', 'tsk');
const zipPath = path.join(sourceDir, 'cross_references.zip');

/**
 * Static OpenBible.info abbreviation → libro.slug mapping.
 * These are the exact abbreviations used in the cross_references.txt dataset.
 * Covers all 66 canonical Protestant books.
 */
const ABBR_TO_SLUG: Record<string, string> = {
  // Old Testament
  Gen: 'genesis', Exod: 'exodo', Lev: 'levitico', Num: 'numeros', Deut: 'deuteronomio',
  Josh: 'josue', Judg: 'jueces', Ruth: 'rut',
  '1Sam': '1-samuel', '2Sam': '2-samuel', '1Kgs': '1-reyes', '2Kgs': '2-reyes',
  '1Chr': '1-cronicas', '2Chr': '2-cronicas',
  Ezra: 'esdras', Neh: 'nehemias', Esth: 'ester', Job: 'job',
  Ps: 'salmos', Prov: 'proverbios', Eccl: 'eclesiastes', Song: 'cantar-de-los-cantares',
  Isa: 'isaias', Jer: 'jeremias', Lam: 'lamentaciones', Ezek: 'ezequiel', Dan: 'daniel',
  Hos: 'oseas', Joel: 'joel', Amos: 'amos', Obad: 'abdias', Jonah: 'jonas',
  Mic: 'miqueas', Nah: 'nahum', Hab: 'habacuc', Zeph: 'sofonias',
  Hag: 'hageo', Zech: 'zacarias', Mal: 'malaquias',
  // New Testament
  Matt: 'mateo', Mark: 'marcos', Luke: 'lucas', John: 'juan', Acts: 'hechos',
  Rom: 'romanos', '1Cor': '1-corintios', '2Cor': '2-corintios', Gal: 'galatas',
  Eph: 'efesios', Phil: 'filipenses', Col: 'colosenses',
  '1Thess': '1-tesalonicenses', '2Thess': '2-tesalonicenses',
  '1Tim': '1-timoteo', '2Tim': '2-timoteo', Titus: 'tito', Phlm: 'filemon',
  Heb: 'hebreos', Jas: 'santiago', '1Pet': '1-pedro', '2Pet': '2-pedro',
  '1John': '1-juan', '2John': '2-juan', '3John': '3-juan', Jude: 'judas', Rev: 'apocalipsis',
};

interface TskImportRow {
  libroId: number;
  capitulo: number;
  versiculo: number;
  refLibroId: number;
  refCapitulo: number;
  refVersiculoStart: number;
  refVersiculoEnd: number;
}

/** Parse "Gen.1.1" → { abbr: "Gen", chapter: 1, verse: 1 } */
function parseVerseRef(raw: string): { abbr: string; chapter: number; verse: number } | null {
  const parts = raw.split('.');
  if (parts.length < 3) return null;
  const abbr = parts[0];
  const chapter = parseInt(parts[1], 10);
  const verse = parseInt(parts[2], 10);
  if (isNaN(chapter) || isNaN(verse)) return null;
  return { abbr, chapter, verse };
}

export async function importTsk() {
  console.info('TSK: Reading cross-references.zip...');
  const zip = await readOrDownloadZip();
  const entries = unzipSync(new Uint8Array(zip));

  const txtEntry = Object.keys(entries).find((name) => name.endsWith('.txt'));
  if (!txtEntry) throw new Error('TSK: no .txt file found in cross_references.zip.');

  const text = strFromU8(entries[txtEntry]);
  const lines = text.split('\n').filter((line) => line.trim().length > 0);

  console.info(`TSK: Parsing ${lines.length} reference lines...`);

  // Pre-load libro slug → id map from the database
  const allLibros = await db.select({ id: libros.id, slug: libros.slug }).from(libros);
  const slugToId = new Map(allLibros.map((l) => [l.slug, l.id]));
  console.info(`TSK: Loaded ${slugToId.size} libros from database.`);

  const unmapped = new Set<string>();
  const rows: TskImportRow[] = [];

  for (const line of lines) {
    const fields = line.split('\t');
    if (fields.length < 3) continue;

    const fromRaw = fields[0]?.trim();
    const toRaw = fields[1]?.trim();
    // fields[2] is votes, fields[3] is comment — both ignored

    if (!fromRaw || !toRaw) continue;

    // Parse source verse
    const fromRef = parseVerseRef(fromRaw);
    if (!fromRef) continue;

    const fromSlug = ABBR_TO_SLUG[fromRef.abbr];
    if (!fromSlug) { unmapped.add(fromRef.abbr); continue; }
    const fromLibroId = slugToId.get(fromSlug);
    if (!fromLibroId) continue;

    // Target can be a single verse or a range (e.g., "Ps.148.4-Ps.148.5")
    // For cross-book ranges, only the first verse is used
    const toParts = toRaw.split('-');
    const toRef = parseVerseRef(toParts[0]);
    if (!toRef) continue;

    const toSlug = ABBR_TO_SLUG[toRef.abbr];
    if (!toSlug) { unmapped.add(toRef.abbr); continue; }
    const toLibroId = slugToId.get(toSlug);
    if (!toLibroId) continue;

    // Determine end verse: if range, use second part; otherwise same as start
    let refVersiculoEnd = toRef.verse;
    if (toParts.length > 1) {
      const toRefEnd = parseVerseRef(toParts[1]);
      if (toRefEnd && toRefEnd.chapter === toRef.chapter && toRefEnd.abbr === toRef.abbr) {
        refVersiculoEnd = toRefEnd.verse;
      }
    }

    rows.push({
      libroId: fromLibroId,
      capitulo: fromRef.chapter,
      versiculo: fromRef.verse,
      refLibroId: toLibroId,
      refCapitulo: toRef.chapter,
      refVersiculoStart: toRef.verse,
      refVersiculoEnd,
    });
  }

  if (unmapped.size > 0) {
    console.warn(`TSK: ${unmapped.size} unmapped abbreviations: ${[...unmapped].sort().join(', ')}`);
  }

  console.info(`TSK: Inserting ${rows.length} cross-references in batches of 350...`);

  // Clear existing TSK data before re-import
  await db.delete(tskReferencias);

  for (const chunk of chunkArray(rows, 350)) {
    await db.insert(tskReferencias).values(chunk);
  }

  console.info(`TSK: Import complete — ${rows.length} cross-references loaded.`);
}

async function readOrDownloadZip(): Promise<Buffer> {
  try {
    return await readFile(zipPath);
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
  }

  console.info('TSK: Downloading from OpenBible.info...');
  const response = await fetch(TSK_ZIP_URL);
  if (!response.ok) {
    throw new Error(`TSK: Failed to download ${TSK_ZIP_URL}: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(sourceDir, { recursive: true });
  await writeFile(zipPath, buffer);
  console.info('TSK: Download cached in sources/tsk/cross_references.zip.');
  return buffer;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  importTsk().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
