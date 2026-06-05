import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';
import { db } from '../src/db/client';
import { tskReferencias, libros } from '../src/db/schema';
import { eq } from 'drizzle-orm';

const TSK_ZIP_URL = 'https://a.openbible.info/data/cross-references.zip';
const sourceDir = path.resolve('sources', 'tsk');
const zipPath = path.join(sourceDir, 'cross_references.zip');

/**
 * Static OSIS abbreviation → libro.slug mapping.
 * Covers all 66 canonical Protestant books.
 */
const OSIS_TO_SLUG: Record<string, string> = {
  // Old Testament
  Gen: 'genesis', Exo: 'exodo', Lev: 'levitico', Num: 'numeros', Deu: 'deuteronomio',
  Jos: 'josue', Jdg: 'jueces', Rut: 'rut',
  '1Sa': '1-samuel', '2Sa': '2-samuel', '1Ki': '1-reyes', '2Ki': '2-reyes',
  '1Ch': '1-cronicas', '2Ch': '2-cronicas',
  Ezr: 'esdras', Neh: 'nehemias', Est: 'ester', Job: 'job',
  Psa: 'salmos', Pro: 'proverbios', Ecc: 'eclesiastes', Sng: 'cantar-de-los-cantares',
  Isa: 'isaias', Jer: 'jeremias', Lam: 'lamentaciones', Eze: 'ezequiel', Dan: 'daniel',
  Hos: 'oseas', Jol: 'joel', Amo: 'amos', Oba: 'abdias', Jon: 'jonas',
  Mic: 'miqueas', Nah: 'nahum', Hab: 'habacuc', Zep: 'sofonias',
  Hag: 'hageo', Zec: 'zacarias', Mal: 'malaquias',
  // New Testament
  Mat: 'mateo', Mrk: 'marcos', Luk: 'lucas', Jhn: 'juan', Act: 'hechos',
  Rom: 'romanos', '1Co': '1-corintios', '2Co': '2-corintios', Gal: 'galatas',
  Eph: 'efesios', Php: 'filipenses', Col: 'colosenses',
  '1Th': '1-tesalonicenses', '2Th': '2-tesalonicenses',
  '1Ti': '1-timoteo', '2Ti': '2-timoteo', Tit: 'tito', Phm: 'filemon',
  Heb: 'hebreos', Jas: 'santiago', '1Pe': '1-pedro', '2Pe': '2-pedro',
  '1Jn': '1-juan', '2Jn': '2-juan', '3Jn': '3-juan', Jud: 'judas', Rev: 'apocalipsis',
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

export async function importTsk() {
  console.info('TSK: Downloading cross-references.zip from OpenBible.info...');
  const zip = await readOrDownloadZip();
  const entries = unzipSync(new Uint8Array(zip));

  // Find the cross-references text file in the zip
  const txtEntry = Object.keys(entries).find((name) => name.endsWith('.txt'));
  if (!txtEntry) throw new Error('TSK: no .txt file found in cross_references.zip.');

  const text = strFromU8(entries[txtEntry]);
  const lines = text.split('\n').filter((line) => line.trim().length > 0);

  console.info(`TSK: Parsing ${lines.length} reference lines...`);

  // Pre-load libro slug → id map from the database
  const allLibros = await db.select({ id: libros.id, slug: libros.slug }).from(libros);
  const slugToId = new Map(allLibros.map((l) => [l.slug, l.id]));

  // Track unmapped OSIS abbreviations for validation
  const unmapped = new Set<string>();

  const rows: TskImportRow[] = [];

  for (const line of lines) {
    const fields = line.split('\t');
    if (fields.length < 5) continue;

    const fromAbb = fields[0]?.trim();
    const [fromCh, fromVs] = fields[1]?.trim().split(':') ?? [];
    const toAbb = fields[2]?.trim();
    const [toCh, toVs] = fields[3]?.trim().split(':') ?? [];
    // field[4] is rating — we skip it

    // Map OSIS → slug
    const fromSlug = OSIS_TO_SLUG[fromAbb];
    const toSlug = OSIS_TO_SLUG[toAbb];

    if (!fromSlug) { unmapped.add(fromAbb); continue; }
    if (!toSlug) { unmapped.add(toAbb); continue; }

    const fromLibroId = slugToId.get(fromSlug);
    const toLibroId = slugToId.get(toSlug);

    if (!fromLibroId || !toLibroId) continue;

    const fromChapter = parseInt(fromCh, 10);
    const fromVerse = parseInt(fromVs, 10);
    const toChapter = parseInt(toCh, 10);

    if (isNaN(fromChapter) || isNaN(fromVerse) || isNaN(toChapter)) continue;

    // Parse target verse range (e.g., "1-3" or just "1")
    const [vsStart, vsEnd] = toVs.includes('-') ? toVs.split('-').map(Number) : [parseInt(toVs, 10), parseInt(toVs, 10)];
    if (isNaN(vsStart) || isNaN(vsEnd)) continue;

    rows.push({
      libroId: fromLibroId,
      capitulo: fromChapter,
      versiculo: fromVerse,
      refLibroId: toLibroId,
      refCapitulo: toChapter,
      refVersiculoStart: vsStart,
      refVersiculoEnd: vsEnd,
    });
  }

  if (unmapped.size > 0) {
    console.warn(`TSK: ${unmapped.size} unmapped OSIS abbreviations: ${[...unmapped].join(', ')}`);
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

// Self-executing when run directly
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  importTsk().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
