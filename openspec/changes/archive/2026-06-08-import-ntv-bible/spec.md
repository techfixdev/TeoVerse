# BBLX Importer Specification

## Purpose

Defines the generic e-Sword `.bblx` parser and its first consumer — the NTV (Nueva Traducción Viviente) Bible import into TeoVerse. The parser is version-agnostic; NTV-specific data lives in a separate manifest.

---

## Requirements

### Requirement: Generic BBLX Parsing

The system MUST read a `.bblx` SQLite file and extract all verses from the `Bible` table as structured data. Each verse MUST include book number (1–66), chapter, verse number, and scripture text. The system MUST strip inline `*` footnote markers from scripture text before returning results. The system MUST read the `Details` table to extract version metadata (title, abbreviation, language).

#### Scenario: Parse valid .bblx file

- GIVEN a valid `.bblx` file with a `Bible` table containing 31,080 rows
- WHEN the parser reads the file
- THEN it returns 31,080 typed verse records with book, chapter, verse, and cleaned text fields

#### Scenario: Strip footnote markers

- GIVEN a verse whose `Scripture` field contains `text* marker* more text`
- WHEN the parser processes the verse
- THEN the returned text is `text marker more text` with all `*` characters removed

#### Scenario: Extract metadata from Details table

- GIVEN a `.bblx` file with a `Details` table containing title and abbreviation
- WHEN the parser reads metadata
- THEN it returns the version title, abbreviation, and language code

#### Scenario: Reject invalid file

- GIVEN a file that is not a valid SQLite database or lacks a `Bible` table
- WHEN the parser attempts to read it
- THEN it throws a descriptive error indicating the file is not a valid `.bblx`

### Requirement: NTV Version Manifest

The system MUST define a manifest containing NTV-specific data: 66 book entries with Spanish display names, URL-compatible slugs (matching existing `SPAPDDPT_BOOKS` slug order), and license/source metadata.

#### Scenario: Manifest covers all 66 books

- GIVEN the NTV manifest
- WHEN its book entries are enumerated
- THEN exactly 66 entries exist with book numbers 1–66 in canonical order

#### Scenario: Slugs match existing Spanish Bible order

- GIVEN the NTV manifest slugs and the `SPAPDDPT_BOOKS` slugs
- WHEN compared positionally
- THEN every slug at position N in NTV matches the slug at position N in SPAPDDPT

### Requirement: NTV Import Orchestration

The system MUST provide a CLI script that reads the NTV `.bblx` source file, invokes the generic parser, and inserts all verses into the TeoVerse database using the existing `recursos`/`libros`/`versiculos` schema. The import step MUST be registered in the build pipeline (`prepare-build-data.ts`) and exposed as `import:ntv` in `package.json`. The NTV abbreviation MUST be registered in `VERSION_ABBREVIATURES`.

#### Scenario: Full import via CLI

- GIVEN `sources/ntv/NTV.bblx` exists and the database is initialized
- WHEN `pnpm import:ntv` is executed
- THEN 31,080 verses across 66 books are inserted into the database with version `ntv`

#### Scenario: Build pipeline includes NTV

- GIVEN `prepare-build-data.ts` runs all import steps
- WHEN the pipeline reaches the NTV step
- THEN it executes `import:ntv` after `import:mensaje` and before `import:tsk`

#### Scenario: Missing source file

- GIVEN `sources/ntv/NTV.bblx` does not exist
- WHEN `pnpm import:ntv` is executed
- THEN the script exits with a descriptive error pointing to the expected file path

### Requirement: Parser Reusability Contract

The generic parser module MUST NOT contain any NTV-specific logic, book names, or hardcoded paths. All version-specific data MUST be provided by the caller via the manifest.

#### Scenario: Parser accepts any .bblx file

- GIVEN a different `.bblx` file (e.g., NVI or RV1960) and a corresponding manifest
- WHEN the parser is invoked with that file and manifest
- THEN it produces correct verse data without code changes to the parser module

#### Scenario: No hardcoded paths in parser

- GIVEN the parser module source code
- WHEN inspected for file paths or version identifiers
- THEN no NTV-specific paths, names, or identifiers are found
