// El Mensaje (paráfrasis contemporánea de Eugene H. Peterson), edición Ríos de Vida.
//
// A diferencia de sparvg / sparv1909 / spapddpt (que importan USFM versiculado desde
// eBible.org), esta fuente es un único HTML exportado por Ríos de Vida. El texto está
// agrupado en PÁRRAFOS con rango de versículos al inicio ("1-2", "3-5"), sin numeración
// 1:1 y sin códigos Strong (es una paráfrasis, no una traducción interlineal).
//
// La fuente trae nombres de libro corruptos por traducción automática del inglés
// ("Trabajo"=Job, "John"=Juan, "Piedad"=Rut, "Micah"=Miqueas, "Tiago"=Santiago, etc.).
// Por eso cada libro lleva `aliases`: las variantes EXACTAS, normalizadas
// (MAYÚSCULAS, sin acentos ni espacios), tal como aparecen como <h2 class="heading-title">
// en el cuerpo del HTML. El parser ancla los límites de libro por ORDEN canónico fijo:
// recorre el documento buscando el alias del siguiente libro esperado.

export const MENSAJE_SOURCE = {
  slug: 'mensaje',
  name: 'El Mensaje',
  language: 'es',
  // El Mensaje (The Message) es una paráfrasis de Eugene H. Peterson; el texto original
  // tiene derechos de NavPress. Esta es una traducción contemporánea al español de
  // distribución de Ríos de Vida. REVISAR derechos antes de publicar.
  license:
    'El Mensaje, paráfrasis de Eugene H. Peterson. Edición contemporánea en español de Ríos de Vida. Uso sujeto a los derechos del autor/editor original (NavPress).',
  source: 'Ríos de Vida — El Mensaje (texto completo, exportación HTML)',
  htmlFile: 'el-mensaje.html',
} as const;

export type MensajeBook = {
  id: string;
  testament: 'AT' | 'NT';
  name: string;
  slug: string;
  abbreviation: string;
  order: number;
  // Variantes normalizadas (MAYÚSCULAS, sin acentos ni símbolos) del nombre del libro
  // tal como aparece como heading-title en el HTML fuente.
  aliases: string[];
};

export const MENSAJE_BOOKS: MensajeBook[] = [
  { id: 'GEN', testament: 'AT', name: 'Génesis', slug: 'genesis', abbreviation: 'Gn', order: 1, aliases: ['GENESIS'] },
  { id: 'EXO', testament: 'AT', name: 'Éxodo', slug: 'exodo', abbreviation: 'Ex', order: 2, aliases: ['EXODO'] },
  { id: 'LEV', testament: 'AT', name: 'Levítico', slug: 'levitico', abbreviation: 'Lv', order: 3, aliases: ['LEVITICIO', 'LEVITICO'] },
  { id: 'NUM', testament: 'AT', name: 'Números', slug: 'numeros', abbreviation: 'Nm', order: 4, aliases: ['NUMEROS'] },
  { id: 'DEU', testament: 'AT', name: 'Deuteronomio', slug: 'deuteronomio', abbreviation: 'Dt', order: 5, aliases: ['DEUTERONOMIO'] },
  { id: 'JOS', testament: 'AT', name: 'Josué', slug: 'josue', abbreviation: 'Jos', order: 6, aliases: ['JOSUE'] },
  { id: 'JDG', testament: 'AT', name: 'Jueces', slug: 'jueces', abbreviation: 'Jue', order: 7, aliases: ['JUECES'] },
  { id: 'RUT', testament: 'AT', name: 'Rut', slug: 'rut', abbreviation: 'Rt', order: 8, aliases: ['PIEDAD', 'RUT'] },
  { id: '1SA', testament: 'AT', name: '1 Samuel', slug: '1-samuel', abbreviation: '1 S', order: 9, aliases: ['1SAMUEL'] },
  { id: '2SA', testament: 'AT', name: '2 Samuel', slug: '2-samuel', abbreviation: '2 S', order: 10, aliases: ['2SAMUEL'] },
  { id: '1KI', testament: 'AT', name: '1 Reyes', slug: '1-reyes', abbreviation: '1 R', order: 11, aliases: ['1REYES'] },
  { id: '2KI', testament: 'AT', name: '2 Reyes', slug: '2-reyes', abbreviation: '2 R', order: 12, aliases: ['2REYES'] },
  { id: '1CH', testament: 'AT', name: '1 Crónicas', slug: '1-cronicas', abbreviation: '1 Cr', order: 13, aliases: ['1CRONICAS'] },
  { id: '2CH', testament: 'AT', name: '2 Crónicas', slug: '2-cronicas', abbreviation: '2 Cr', order: 14, aliases: ['2CRONICAS'] },
  { id: 'EZR', testament: 'AT', name: 'Esdras', slug: 'esdras', abbreviation: 'Esd', order: 15, aliases: ['ESDRAS'] },
  { id: 'NEH', testament: 'AT', name: 'Nehemías', slug: 'nehemias', abbreviation: 'Neh', order: 16, aliases: ['NEHEMIAS'] },
  { id: 'EST', testament: 'AT', name: 'Ester', slug: 'ester', abbreviation: 'Est', order: 17, aliases: ['ESTER'] },
  { id: 'JOB', testament: 'AT', name: 'Job', slug: 'job', abbreviation: 'Job', order: 18, aliases: ['TRABAJO', 'JOB'] },
  { id: 'PSA', testament: 'AT', name: 'Salmos', slug: 'salmos', abbreviation: 'Sal', order: 19, aliases: ['SALMOS'] },
  { id: 'PRO', testament: 'AT', name: 'Proverbios', slug: 'proverbios', abbreviation: 'Pr', order: 20, aliases: ['PROVERBIOS'] },
  { id: 'ECC', testament: 'AT', name: 'Eclesiastés', slug: 'eclesiastes', abbreviation: 'Ec', order: 21, aliases: ['ECLESIASTES'] },
  { id: 'SNG', testament: 'AT', name: 'Cantar de los Cantares', slug: 'cantar-de-los-cantares', abbreviation: 'Cnt', order: 22, aliases: ['CANTARDELOSCANTARES'] },
  { id: 'ISA', testament: 'AT', name: 'Isaías', slug: 'isaias', abbreviation: 'Is', order: 23, aliases: ['ISAIAS'] },
  { id: 'JER', testament: 'AT', name: 'Jeremías', slug: 'jeremias', abbreviation: 'Jer', order: 24, aliases: ['JEREMIAS'] },
  { id: 'LAM', testament: 'AT', name: 'Lamentaciones', slug: 'lamentaciones', abbreviation: 'Lm', order: 25, aliases: ['LAMENTACIONES'] },
  { id: 'EZK', testament: 'AT', name: 'Ezequiel', slug: 'ezequiel', abbreviation: 'Ez', order: 26, aliases: ['EZEQUIEL'] },
  { id: 'DAN', testament: 'AT', name: 'Daniel', slug: 'daniel', abbreviation: 'Dn', order: 27, aliases: ['DANIEL'] },
  { id: 'HOS', testament: 'AT', name: 'Oseas', slug: 'oseas', abbreviation: 'Os', order: 28, aliases: ['OSEAS'] },
  { id: 'JOL', testament: 'AT', name: 'Joel', slug: 'joel', abbreviation: 'Jl', order: 29, aliases: ['JOEL'] },
  { id: 'AMO', testament: 'AT', name: 'Amós', slug: 'amos', abbreviation: 'Am', order: 30, aliases: ['AMOS'] },
  { id: 'OBA', testament: 'AT', name: 'Abdías', slug: 'abdias', abbreviation: 'Abd', order: 31, aliases: ['ABDIAS'] },
  { id: 'JON', testament: 'AT', name: 'Jonás', slug: 'jonas', abbreviation: 'Jon', order: 32, aliases: ['JONAS'] },
  { id: 'MIC', testament: 'AT', name: 'Miqueas', slug: 'miqueas', abbreviation: 'Mi', order: 33, aliases: ['MIQUEAS', 'MICAH'] },
  { id: 'NAM', testament: 'AT', name: 'Nahúm', slug: 'nahum', abbreviation: 'Nah', order: 34, aliases: ['NAHUM'] },
  { id: 'HAB', testament: 'AT', name: 'Habacuc', slug: 'habacuc', abbreviation: 'Hab', order: 35, aliases: ['HABACUC'] },
  { id: 'ZEP', testament: 'AT', name: 'Sofonías', slug: 'sofonias', abbreviation: 'Sof', order: 36, aliases: ['SOFONIAS'] },
  { id: 'HAG', testament: 'AT', name: 'Hageo', slug: 'hageo', abbreviation: 'Hag', order: 37, aliases: ['HAGEO'] },
  { id: 'ZEC', testament: 'AT', name: 'Zacarías', slug: 'zacarias', abbreviation: 'Zac', order: 38, aliases: ['ZACARIAS'] },
  { id: 'MAL', testament: 'AT', name: 'Malaquías', slug: 'malaquias', abbreviation: 'Mal', order: 39, aliases: ['MALAQUIAS'] },
  { id: 'MAT', testament: 'NT', name: 'Mateo', slug: 'mateo', abbreviation: 'Mt', order: 40, aliases: ['MATEO'] },
  { id: 'MRK', testament: 'NT', name: 'Marcos', slug: 'marcos', abbreviation: 'Mr', order: 41, aliases: ['MARCOS'] },
  { id: 'LUK', testament: 'NT', name: 'Lucas', slug: 'lucas', abbreviation: 'Lc', order: 42, aliases: ['LUCAS'] },
  { id: 'JHN', testament: 'NT', name: 'Juan', slug: 'juan', abbreviation: 'Jn', order: 43, aliases: ['JOHN', 'JUAN'] },
  { id: 'ACT', testament: 'NT', name: 'Hechos', slug: 'hechos', abbreviation: 'Hch', order: 44, aliases: ['HECHOS'] },
  { id: 'ROM', testament: 'NT', name: 'Romanos', slug: 'romanos', abbreviation: 'Ro', order: 45, aliases: ['ROMANOS'] },
  { id: '1CO', testament: 'NT', name: '1 Corintios', slug: '1-corintios', abbreviation: '1 Co', order: 46, aliases: ['1CORINTIOS'] },
  { id: '2CO', testament: 'NT', name: '2 Corintios', slug: '2-corintios', abbreviation: '2 Co', order: 47, aliases: ['2CORINTIOS'] },
  { id: 'GAL', testament: 'NT', name: 'Gálatas', slug: 'galatas', abbreviation: 'Ga', order: 48, aliases: ['GALATAS'] },
  { id: 'EPH', testament: 'NT', name: 'Efesios', slug: 'efesios', abbreviation: 'Ef', order: 49, aliases: ['EFESIOS'] },
  { id: 'PHP', testament: 'NT', name: 'Filipenses', slug: 'filipenses', abbreviation: 'Fil', order: 50, aliases: ['FILIPENSES'] },
  { id: 'COL', testament: 'NT', name: 'Colosenses', slug: 'colosenses', abbreviation: 'Col', order: 51, aliases: ['COLOSENSES'] },
  { id: '1TH', testament: 'NT', name: '1 Tesalonicenses', slug: '1-tesalonicenses', abbreviation: '1 Ts', order: 52, aliases: ['1TESALONICENSES'] },
  { id: '2TH', testament: 'NT', name: '2 Tesalonicenses', slug: '2-tesalonicenses', abbreviation: '2 Ts', order: 53, aliases: ['2TESALONICENSES'] },
  { id: '1TI', testament: 'NT', name: '1 Timoteo', slug: '1-timoteo', abbreviation: '1 Ti', order: 54, aliases: ['1TIMOTEO'] },
  { id: '2TI', testament: 'NT', name: '2 Timoteo', slug: '2-timoteo', abbreviation: '2 Ti', order: 55, aliases: ['2TIMOTEO'] },
  { id: 'TIT', testament: 'NT', name: 'Tito', slug: 'tito', abbreviation: 'Tit', order: 56, aliases: ['TITO'] },
  { id: 'PHM', testament: 'NT', name: 'Filemón', slug: 'filemon', abbreviation: 'Flm', order: 57, aliases: ['FILEMON', 'FILEMA'] },
  { id: 'HEB', testament: 'NT', name: 'Hebreos', slug: 'hebreos', abbreviation: 'Heb', order: 58, aliases: ['HEBREOS'] },
  { id: 'JAS', testament: 'NT', name: 'Santiago', slug: 'santiago', abbreviation: 'Stg', order: 59, aliases: ['TIAGO', 'SANTIAGO'] },
  { id: '1PE', testament: 'NT', name: '1 Pedro', slug: '1-pedro', abbreviation: '1 P', order: 60, aliases: ['1PEDRO'] },
  { id: '2PE', testament: 'NT', name: '2 Pedro', slug: '2-pedro', abbreviation: '2 P', order: 61, aliases: ['2PEDRO'] },
  { id: '1JN', testament: 'NT', name: '1 Juan', slug: '1-juan', abbreviation: '1 Jn', order: 62, aliases: ['1JUAN', '1JOAN'] },
  { id: '2JN', testament: 'NT', name: '2 Juan', slug: '2-juan', abbreviation: '2 Jn', order: 63, aliases: ['2JOAN', '2JUAN'] },
  { id: '3JN', testament: 'NT', name: '3 Juan', slug: '3-juan', abbreviation: '3 Jn', order: 64, aliases: ['3JOAN', '3JUAN'] },
  { id: 'JUD', testament: 'NT', name: 'Judas', slug: 'judas', abbreviation: 'Jud', order: 65, aliases: ['JUDAS'] },
  { id: 'REV', testament: 'NT', name: 'Apocalipsis', slug: 'apocalipsis', abbreviation: 'Ap', order: 66, aliases: ['APOCALIPSIS'] },
];
