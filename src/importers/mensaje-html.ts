// Parser del HTML "El Mensaje" (Ríos de Vida) → versículos expandidos.
//
// La fuente NO es USFM: es un único HTML cuyo cuerpo intercala
//   <h2 class="heading-title">NOMBRE DE LIBRO</h2>   (también subtítulos de perícopa)
//   <div class="chapter-num">Capítulo N</div>
//   <p class="text-p">1-2 texto del versículo…</p>    (rango o número único al inicio)
//
// Estrategia (validada contra el canon de capítulos de los 66 libros): se ancla por
// ORDEN canónico. Se recorre el documento en orden y, en cada heading-title, se comprueba
// si coincide con un alias del SIGUIENTE libro esperado. Así los subtítulos de perícopa
// (que también van en mayúsculas) se ignoran, y los nombres corruptos por traducción
// automática ("Trabajo"=Job, "Piedad"=Rut, "Tiago"=Santiago…) se resuelven vía `aliases`.
//
// El Mensaje agrupa versículos en rangos ("1-2"). Cada rango se EXPANDE: el texto del
// párrafo se asigna a cada versículo del rango (v1 y v2 reciben el mismo texto), para que
// cualquier referencia a un versículo individual resuelva contra el schema versiculado.

import { MENSAJE_BOOKS, type MensajeBook } from './mensaje-manifest';

export type MensajeVerse = {
  bookId: string;
  chapter: number;
  verse: number;
  text: string;
};

export type ParseResult = {
  verses: MensajeVerse[];
  booksFound: string[]; // ids de libros efectivamente detectados, en orden
};

// Normaliza un encabezado a la forma de los alias: MAYÚSCULAS, sin acentos ni símbolos.
export function normalizeHeading(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&aacute;/gi, 'á').replace(/&eacute;/gi, 'é').replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó').replace(/&uacute;/gi, 'ú').replace(/&ntilde;/gi, 'ñ')
    .replace(/&ldquo;|&rdquo;/g, '"').replace(/&lsquo;|&rsquo;/g, "'")
    .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&hellip;/g, '…')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// Limpia el contenido interno de un elemento: quita tags, decodifica entidades, colapsa espacios.
function cleanInner(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// Versículo inicial de un párrafo: "1-2 …", "3 …", "10–12 …". Devuelve [start, end, resto] o null.
function parseVerseLead(text: string): { start: number; end: number; rest: string } | null {
  const m = text.match(/^\s*(\d+)\s*(?:[-–—]\s*(\d+))?[.\s]\s*(.*)$/s);
  if (!m) return null;
  const start = Number(m[1]);
  let end = m[2] ? Number(m[2]) : start;
  // Rango inválido o desmesurado → tratar como versículo único.
  if (end < start || end - start > 60) end = start;
  return { start, end, rest: m[3] ?? '' };
}

type Pending = { start: number; end: number; parts: string[] };

export function parseMensajeHtml(html: string): ParseResult {
  // Secuencia lineal de elementos estructurales en orden de aparición.
  const elementRe = /<(?:h2|div|p)[^>]*class="(heading-title|chapter-num|text-p)"[^>]*>([\s\S]*?)<\/(?:h2|div|p)>/g;

  const verses: MensajeVerse[] = [];
  const booksFound: string[] = [];

  let bookIndex = -1; // índice del libro abierto en MENSAJE_BOOKS
  let expectedNext = 0; // próximo libro esperado por orden canónico
  let currentBook: MensajeBook | null = null;
  let currentChapter: number | null = null;
  let pending: Pending | null = null;

  const flush = () => {
    if (!currentBook || currentChapter === null || !pending) {
      pending = null;
      return;
    }
    const text = pending.parts.join(' ').replace(/\s+/g, ' ').trim();
    if (text.length > 0) {
      for (let v = pending.start; v <= pending.end; v++) {
        verses.push({ bookId: currentBook.id, chapter: currentChapter, verse: v, text });
      }
    }
    pending = null;
  };

  let match: RegExpExecArray | null;
  while ((match = elementRe.exec(html)) !== null) {
    const kind = match[1];
    const inner = cleanInner(match[2]);
    if (inner.length === 0) continue;

    if (kind === 'heading-title') {
      if (expectedNext < MENSAJE_BOOKS.length) {
        const norm = normalizeHeading(inner);
        if (MENSAJE_BOOKS[expectedNext].aliases.includes(norm)) {
          flush();
          bookIndex = expectedNext;
          currentBook = MENSAJE_BOOKS[bookIndex];
          currentChapter = null;
          booksFound.push(currentBook.id);
          expectedNext++;
        }
      }
      continue;
    }

    if (kind === 'chapter-num') {
      const m = inner.match(/Cap[ií]tulo\s+(\d+)/i);
      if (m && currentBook) {
        flush();
        currentChapter = Number(m[1]);
      }
      continue;
    }

    // kind === 'text-p'
    if (!currentBook || currentChapter === null) continue;
    const lead = parseVerseLead(inner);
    if (lead) {
      flush();
      pending = { start: lead.start, end: lead.end, parts: lead.rest ? [lead.rest] : [] };
    } else if (pending) {
      // Párrafo sin número: continuación (poesía / prosa) del rango actual.
      pending.parts.push(inner);
    }
  }
  flush();

  return { verses, booksFound };
}
