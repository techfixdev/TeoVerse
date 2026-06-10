/**
 * Lexicon adapter interfaces and Strong code extraction.
 *
 * Defines the canonical types that all lexicon sources (Vine, Strong-ESP, etc.)
 * normalize to before DB insertion. Also provides the regex-based Strong code
 * extractor used by dctx-based adapters.
 */

/** A single lexicon entry normalized for DB insertion. */
export interface CanonicalLexiconEntry {
  codigoStrong: string;
  lema: string;
  definicion: string; // Cleaned HTML or plain text
}

/** Describes a lexicon source (files, attribution, etc.). */
export interface LexiconSource {
  slug: string;
  nombre: string;
  idioma: string;
  licencia: string;
  fuente: string;
  files: string[];
  attribution: string;
}

/** Adapter interface: parse a source file into canonical entries. */
export interface LexiconAdapter {
  parse(filePath: string): CanonicalLexiconEntry[];
}

/**
 * Extract all Strong codes from an RTF Definition field.
 *
 * Pattern: codes appear in parenthetical groups like `(ver, H430)` or `(G25)`.
 * The regex matches `, H####)` or `, G####)` — comma + optional space + code + closing paren.
 * Also matches standalone `(H####)` and `(G####)`.
 *
 * @returns Deduplicated array of codes in order of first appearance.
 */
export function extractStrongCodes(rawDefinition: string): string[] {
  // Match codes in patterns like: (H430), (G25), , H430), , G25)
  const regex = /(?:^|[(,])\s*([GH]\d+)/g;
  const seen = new Set<string>();
  const codes: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(rawDefinition)) !== null) {
    const code = match[1];
    if (!seen.has(code)) {
      seen.add(code);
      codes.push(code);
    }
  }

  return codes;
}
