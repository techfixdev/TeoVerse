# Importador USFM

La version inicial de lectura usa `spapddpt` (Palabra de Dios para ti) desde eBible.org bajo CC BY 4.0. El proyecto solo guarda un fixture minimo con los 5 versiculos ya seedados de Genesis 1 para validar parser e importador sin commitear una Biblia completa.

## Verificacion local

1. Mantener el archivo USFM aprobado fuera del repo si contiene texto completo.
2. Validar el parser con el fixture chico incluido.
3. Validar el importador con el mismo fixture chico en la DB local.

```bash
pnpm verify:usfm-parser
pnpm verify:usfm-importer
```

El parser vive en `src/importers/usfm.ts` y expone `parseUsfmBook(usfm)`. Normaliza un archivo de libro individual con estos marcadores:

| Marcador | Salida |
| --- | --- |
| `\\id` | `book.id` |
| `\\toc1` | `book.toc1` |
| `\\toc2` | `book.toc2` |
| `\\toc3` | `book.toc3` |
| `\\c` | `verse.chapter` |
| `\\v` | `verse.verse` y `verse.text` |

El importador vive en `scripts/import-usfm.ts` y expone `importUsfmBook(input)`. Tambien se puede ejecutar por CLI con metadata explicita:

```bash
pnpm tsx scripts/import-usfm.ts \
  --file=../fuentes-aprobadas/spapddpt/01-GEN.usfm \
  --bible-slug=spapddpt \
  --bible-name="Palabra de Dios para ti" \
  --bible-language=es \
  --bible-license="Creative Commons Attribution 4.0 International (CC BY 4.0)" \
  --bible-source="eBible.org - https://ebible.org/find/details.php?id=spapddpt" \
  --book-testament=AT \
  --book-name="Genesis" \
  --book-slug=genesis \
  --book-abbreviation=Gn \
  --book-order=1
```

Para el fixture seguro incluido en el repo, el verificador usa slugs separados para no tocar la version principal:

```bash
pnpm verify:usfm-importer
```

Ese comando importa `fixtures/usfm/spapddpt-genesis-1.usfm` como `spapddpt-fixture` / `genesis-fixture` y comprueba que repetir el import no duplique versiculos.

## Restricciones

- Usar solo archivos USFM locales de una fuente aprobada manualmente.
- Preservar la atribucion visible de `spapddpt`: Palabra de Dios para ti, CC BY 4.0, eBible.org.
- No descargar texto biblico completo durante `build`, `verify` ni runtime.
- No commitear una Biblia completa en el repositorio.
- No commitear archivos USFM completos descargados; mantenerlos fuera del repo.
- No importar desde PDF.
- No hacer scraping.
- No usar DEMO ni RVR1960.
- `spaRV1909` queda fuera del import inicial; solo sirve como comparacion historica futura.

## Comportamiento de escritura

- El importador requiere metadata explicita de Biblia y libro; no infiere licencia, fuente ni slugs desde el USFM.
- Inserta en `biblias`, `libros` y `versiculos` con Drizzle.
- Usa `onConflictDoNothing()` sobre los indices unicos existentes para evitar duplicados.
- No reemplaza texto existente. Si hace falta reimportar corrigiendo datos, borrar primero los registros afectados o agregar un modo de reemplazo explicito.
- Las paginas de lectura siguen siendo SSG/static: pueden consultar Drizzle en build, pero no dependen de DB en runtime.
