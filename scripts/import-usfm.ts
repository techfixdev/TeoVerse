import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { biblias, libros, versiculos } from '../src/db/schema';
import { parseUsfmBook } from '../src/importers/usfm';

type Testament = 'AT' | 'NT';

export type ImportUsfmBookInput = {
  filePath: string | URL;
  bible: {
    slug: string;
    name: string;
    language: string;
    license: string;
    source: string;
  };
  book: {
    testament: Testament;
    name: string;
    slug: string;
    abbreviation: string;
    order: number;
  };
};

export type ImportUsfmBookResult = {
  bibleSlug: string;
  bookSlug: string;
  verseCount: number;
};

export async function importUsfmBook(input: ImportUsfmBookInput): Promise<ImportUsfmBookResult> {
  validateInput(input);

  const usfm = await readFile(input.filePath, 'utf8');
  const parsed = parseUsfmBook(usfm);

  if (parsed.verses.length === 0) {
    throw new Error('USFM import requires at least one parsed verse.');
  }

  const [createdBiblia] = await db
    .insert(biblias)
    .values({
      slug: input.bible.slug,
      nombre: input.bible.name,
      idioma: input.bible.language,
      licencia: input.bible.license,
      fuente: input.bible.source,
    })
    .onConflictDoNothing()
    .returning();

  const biblia = createdBiblia ?? (await db.select().from(biblias).where(eq(biblias.slug, input.bible.slug)).get());
  if (!biblia) throw new Error(`Could not create or load Bible ${input.bible.slug}.`);

  const [createdLibro] = await db
    .insert(libros)
    .values({
      testamento: input.book.testament,
      nombre: input.book.name,
      slug: input.book.slug,
      abreviatura: input.book.abbreviation,
      orden: input.book.order,
    })
    .onConflictDoNothing()
    .returning();

  const libro = createdLibro ?? (await db.select().from(libros).where(eq(libros.slug, input.book.slug)).get());
  if (!libro) throw new Error(`Could not create or load book ${input.book.slug}.`);

  await db
    .insert(versiculos)
    .values(
      parsed.verses.map((verse) => ({
        bibliaId: biblia.id,
        libroId: libro.id,
        capitulo: verse.chapter,
        versiculo: verse.verse,
        texto: verse.text,
      })),
    )
    .onConflictDoNothing();

  return {
    bibleSlug: biblia.slug,
    bookSlug: libro.slug,
    verseCount: parsed.verses.length,
  };
}

function validateInput(input: ImportUsfmBookInput) {
  const requiredValues = [
    ['bible.slug', input.bible.slug],
    ['bible.name', input.bible.name],
    ['bible.language', input.bible.language],
    ['bible.license', input.bible.license],
    ['bible.source', input.bible.source],
    ['book.testament', input.book.testament],
    ['book.name', input.book.name],
    ['book.slug', input.book.slug],
    ['book.abbreviation', input.book.abbreviation],
  ] as const;

  for (const [name, value] of requiredValues) {
    if (value.trim().length === 0) throw new Error(`USFM import requires ${name}.`);
  }

  if (input.book.testament !== 'AT' && input.book.testament !== 'NT') {
    throw new Error('USFM import requires book.testament to be AT or NT.');
  }

  if (!Number.isInteger(input.book.order) || input.book.order < 1) {
    throw new Error('USFM import requires book.order to be a positive integer.');
  }
}

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function runCli() {
  const filePath = getArg('file');
  const bibleSlug = getArg('bible-slug');
  const bibleName = getArg('bible-name');
  const bibleLanguage = getArg('bible-language');
  const bibleLicense = getArg('bible-license');
  const bibleSource = getArg('bible-source');
  const bookTestament = getArg('book-testament') as Testament | undefined;
  const bookName = getArg('book-name');
  const bookSlug = getArg('book-slug');
  const bookAbbreviation = getArg('book-abbreviation');
  const bookOrder = Number(getArg('book-order'));

  if (
    !filePath ||
    !bibleSlug ||
    !bibleName ||
    !bibleLanguage ||
    !bibleLicense ||
    !bibleSource ||
    !bookTestament ||
    !bookName ||
    !bookSlug ||
    !bookAbbreviation ||
    !Number.isInteger(bookOrder)
  ) {
    throw new Error(
      'Usage: pnpm tsx scripts/import-usfm.ts --file=path/to/book.usfm --bible-slug=spapddpt --bible-name="Palabra de Dios para ti" --bible-language=es --bible-license="Creative Commons Attribution 4.0 International (CC BY 4.0)" --bible-source="eBible.org - https://ebible.org/find/details.php?id=spapddpt" --book-testament=AT --book-name=Génesis --book-slug=genesis --book-abbreviation=Gn --book-order=1',
    );
  }

  const result = await importUsfmBook({
    filePath,
    bible: {
      slug: bibleSlug,
      name: bibleName,
      language: bibleLanguage,
      license: bibleLicense,
      source: bibleSource,
    },
    book: {
      testament: bookTestament,
      name: bookName,
      slug: bookSlug,
      abbreviation: bookAbbreviation,
      order: bookOrder,
    },
  });

  console.info(`Imported ${result.verseCount} verses for ${result.bibleSlug}/${result.bookSlug}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
