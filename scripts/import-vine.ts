/**
 * import-vine.ts — Orchestrator script for the Vine lexicon import.
 *
 * Mirrors import-ntv.ts patterns:
 *   - Graceful skip if source files are missing (CI without gitignored sources)
 *   - Upsert recurso vine-es (onConflictDoNothing + load-back)
 *   - Idempotent: delete existing vine-es entries, then batch-insert (350/chunk)
 *   - Cross-file dedup: AT processed first, NT second; first-wins on code collision
 *
 * Each .dctx article may reference multiple Strong codes → emits N rows,
 * one per code, all sharing the same cleaned definition HTML.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { recursos, diccionarioEntradas } from '../src/db/schema';
import { VINE_SOURCE } from '../src/importers/vine-manifest';
import { parseDctx } from '../src/importers/dctx';
import { rtfToHtml } from '../src/importers/rtf';
import { extractStrongCodes } from '../src/importers/lexicon';
import type { CanonicalLexiconEntry } from '../src/importers/lexicon';

const sourceDir = path.resolve('sources', VINE_SOURCE.sourceDir);

function resolveSourceFile(filename: string): string {
  return path.join(sourceDir, filename);
}

/**
 * Parse a single .dctx file into canonical lexicon entries.
 * Each article may yield multiple entries (one per Strong code found).
 */
function parseDctxToEntries(filePath: string): CanonicalLexiconEntry[] {
  const { rows } = parseDctx(filePath);
  const entries: CanonicalLexiconEntry[] = [];
  let skippedArticles = 0;

  for (const row of rows) {
    const codes = extractStrongCodes(row.Definition);
    if (codes.length === 0) {
      skippedArticles++;
      continue;
    }

    const cleanedHtml = rtfToHtml(row.Definition);
    const lema = row.Topic.trim() || codes[0];

    for (const code of codes) {
      entries.push({
        codigoStrong: code,
        lema,
        definicion: cleanedHtml,
      });
    }
  }

  if (skippedArticles > 0) {
    console.info(`  [${path.basename(filePath)}] Skipped ${skippedArticles} articles with no Strong codes.`);
  }

  return entries;
}

export async function importVine(): Promise<void> {
  // Resolve source files
  const files = VINE_SOURCE.files.map(resolveSourceFile);
  const existingFiles = files.filter(existsSync);

  // Graceful skip: no source files available
  if (existingFiles.length === 0) {
    console.warn(
      `[import:vine] No source files found in ${sourceDir}\n` +
        `Skipping Vine import. Copy .dctx files to sources/vine/ to enable.`,
    );
    return;
  }

  console.info(`[import:vine] Found ${existingFiles.length}/${files.length} source files.`);

  // Parse all files, deduplicating across files (first-wins, AT before NT)
  const seenCodes = new Set<string>();
  const allEntries: CanonicalLexiconEntry[] = [];

  for (const filePath of existingFiles) {
    console.info(`  Parsing ${path.basename(filePath)}...`);
    const entries = parseDctxToEntries(filePath);
    console.info(`  → ${entries.length} entries from ${path.basename(filePath)}`);

    for (const entry of entries) {
      if (!seenCodes.has(entry.codigoStrong)) {
        seenCodes.add(entry.codigoStrong);
        allEntries.push(entry);
      }
    }
  }

  console.info(`[import:vine] ${allEntries.length} unique entries after cross-file dedup.`);

  // Upsert recurso vine-es
  const [createdRecurso] = await db
    .insert(recursos)
    .values({
      tipo: 'diccionario',
      slug: VINE_SOURCE.slug,
      nombre: VINE_SOURCE.nombre,
      idioma: VINE_SOURCE.idioma,
      licencia: VINE_SOURCE.licencia,
      fuente: VINE_SOURCE.fuente,
    })
    .onConflictDoNothing()
    .returning();

  const recurso =
    createdRecurso ??
    (await db.select().from(recursos).where(eq(recursos.slug, VINE_SOURCE.slug)).get());

  if (!recurso) {
    throw new Error(`[import:vine] Could not create or load recurso ${VINE_SOURCE.slug}.`);
  }

  // Update metadata on existing recurso
  await db
    .update(recursos)
    .set({
      nombre: VINE_SOURCE.nombre,
      idioma: VINE_SOURCE.idioma,
      licencia: VINE_SOURCE.licencia,
      fuente: VINE_SOURCE.fuente,
    })
    .where(eq(recursos.id, recurso.id));

  // Idempotent: delete existing vine-es entries
  await db.delete(diccionarioEntradas).where(eq(diccionarioEntradas.recursoId, recurso.id));

  // Batch insert (350 per chunk) with onConflictDoNothing
  const CHUNK_SIZE = 350;
  let inserted = 0;

  for (let i = 0; i < allEntries.length; i += CHUNK_SIZE) {
    const chunk = allEntries.slice(i, i + CHUNK_SIZE);
    await db
      .insert(diccionarioEntradas)
      .values(
        chunk.map((entry) => ({
          recursoId: recurso.id,
          codigoStrong: entry.codigoStrong,
          lema: entry.lema,
          definicion: entry.definicion,
        })),
      )
      .onConflictDoNothing();

    inserted += chunk.length;
  }

  console.info(`[import:vine] Inserted ${inserted} entries into vine-es (recurso id=${recurso.id}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  importVine().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
