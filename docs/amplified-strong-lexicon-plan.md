# TeoVerse — Amplified Strong Lexicon: Plan & Context

> Handoff document to resume this change on another machine. Last updated: 2026-06-09.
> Engram-backed (project `teoverse`). Topic key prefix: `sdd/amplified-strong-lexicon/*`.

## Goal

Build the **"amplified effect"** (e-Sword style): tap a word in the Bible reader → its
Strong number → a **Spanish** lexicon definition in the side panel. Plus: render
**cross-reference (TSK) target verses as cards** showing the verse text, and Strong
numbers inside those cards.

## Hard constraints & decisions (do NOT relitigate)

- **Spanish is required.** English definitions were explicitly rejected as a final state
  (useless as a study tool). Source data must be **licensed Spanish**, not free English.
- **No machine translation, ever** (derivative-work + quality problem).
- **Multi-lexicon-per-Strong-code** is a first-class architecture invariant: a
  source-agnostic importer + pluggable per-source adapters; multiple lexicon *resources*
  can define the same Strong code (modeled as rows under different `recursos`, NOT a new
  column — no schema change).
- Project has **no unit test runner** (`strict_tdd: false`). TDD = **failing-first
  verification scripts**; quality gate is `pnpm verify`.
- Code/identifiers/UI-copy/comments/commits/PRs in **English**; DB identifiers stay
  Spanish (project convention); lexicon **content** is Spanish (the data).
- Delivery: **stacked-to-main chained PRs**, automatic mode, **judgment-day** at the end.

## Licensed data sources (⚠️ GITIGNORED — they do NOT travel via git)

| Source | Coverage | Keying | File (gitignored) | Original |
|---|---|---|---|---|
| **Diccionario Strong (Esp)** | FULL ~14,198 codes | `Topic` = Strong code (`H1`,`G25`) — 1 code/row, simple | `sources/strong-esp/strong-esp.dctx` (3.4 MB) | `C:\Users\CharlyDev\Downloads\Strong (Esp) Diccionario Strong en Español.dctx` |
| **Diccionario Vine AT** | partial, expository | `Topic` = Spanish word; codes embedded in RTF prose; multiple/entry | `sources/vine/vine-at.dctx` (7.8 MB, 1101) | `C:\Program Files (x86)\e-Sword\Diccionario Vine ... Antiguo Testamento ... .dctx` |
| **Diccionario Vine NT** | partial, expository | same as AT | `sources/vine/vine-nt.dctx` (24 MB, 8203) | `C:\Program Files (x86)\e-Sword\Diccionario Vine ... Nuevo Testamento ... .dctx` |

- All three are **e-Sword `.dctx` = SQLite**, table `Dictionary(Topic TEXT, Definition TEXT)`.
- `Definition` is **RTF**: Windows-1252 hex escapes (`\'f3`=ó), control words (`\b \i \par`),
  symbol-font original Greek/Hebrew (`\f1`/`\f2`, dropped in v1), see-also cross-refs
  (`{\cf14\ul H1}`), verse refs (`{\cf11\ul 1Pe_3:21}`).
- **Licensing**: publisher rights confirmed (Vine + Strong-esp); the legal/attribution
  document is pending and will be loaded at the END. Attribution must be visible in UI.
- **To resume elsewhere you MUST copy these `.dctx` files manually** into `sources/vine/`
  and `sources/strong-esp/` — `.gitignore` excludes `sources/` (except `tsk/` and `ntv/`).

## Why Strong was "broken" (diagnosis — it was missing DATA, not a UI bug)

- Strong tokens (`versiculos_tokens`): **393,984** Strong-coded, ALL in version `spapddpt`
  (other versions have 0). Click→panel plumbing already works.
- Lexicon (`diccionario_entradas`, slug `strong-es`): only **2** hand-seeded entries → every
  click showed "Sin definición". **The fix = import a real Spanish lexicon.**
- Cross-references (`tsk_referencias`): **344,799** present; rendered as bare links (no card).

## Architecture / design (8 decisions)

1. **RTF→clean text**: hand-rolled `src/importers/rtf.ts` → minimal-HTML whitelist
   (`<p> <strong> <em> <br>`). Decode CP1252 `\'xx`; map `\b`→strong, `\i`→em, `\par`→para;
   verse refs → visible text (not linkified v1); DROP `\f1`/`\f2` glyph runs; strip rest.
   Exports `rtfToHtml()` + `rtfToPlain()`.
2. **Strong extraction**: Vine → regex `/,\s*([GH]\d+)\)/g` (multiple/entry → N rows, same
   definicion, lema=Topic). Strong-esp → `codigo = Topic` directly (trivial).
3. **Resource modeling**: `strong-esp` → resource slug **`strong-es`** (full coverage,
   replaces the 2 seeds). Vine → resource slug **`vine-es`** (depth). They coexist per code.
   Panel aggregates both via `getEntradasParaCodigo(code)` + new endpoint
   `src/pages/datos/strong/[codigo].json.ts` (keep existing `[lexiconSlug]/[codigo].json.ts`).
4. **Importer**: `src/importers/{dctx,lexicon,rtf}.ts` (pure) + `scripts/import-*.ts`
   orchestrators mirroring `scripts/import-ntv.ts` (graceful-skip if source absent,
   idempotent delete+batch-insert 350, dedupe). `LexiconAdapter` interface; two adapters
   (code-keyed for Strong-esp, prose-keyed for Vine) share `rtf.ts` + `dctx.ts`.
5. **VerseCard**: extract inline `<li class="verso-card">` (`[capitulo].astro`) →
   `src/components/biblia/VerseCard.astro`, reused by reader; `TskPanel` renders target
   verse cards via a client-side template reusing `.verso-card` CSS (NOT the .astro in the
   island).
6. **versiculo=0 fix**: `TskClickProxy.astro` derive verse from `closest('[data-verso]')`
   `.split(':')[2]` (works multi-verse).
7. **Verify scripts (TDD)**: `verify-rtf.ts` (pure, CI-safe, failing-first driver),
   `verify-vine-lexicon.ts` + `verify-lexicon-aggregate.ts` (DB, guarded for absent sources),
   `verify-verse-card.ts` (PR1). Wire into `verify` chain in `package.json`.
8. **Build scale**: aggregate endpoint emits ~thousands of static JSON (one/distinct code);
   within Astro tolerance; `getStaticPaths` uses one `listAllLexiconCodes()` query.

## PR plan (stacked-to-main) & status

- **PR1 — Cross-reference verse cards** (`feat/crossref-verse-cards`): VerseCard extraction,
  `versiculo=0` fix, TSK target verse cards. **STATUS: COMMITTED & PUSHED** (5 commits,
  `650aaeb..aa77c02`, as of 2026-06-09). `pnpm verify` was started on the CarlosCarabajal
  machine but the session ended before it finished — **re-run `pnpm verify` to confirm
  green before opening the PR**. Files: `scripts/verify-verse-card.ts`,
  `src/components/biblia/VerseCard.astro`, `[capitulo].astro`, `TskClickProxy.astro`,
  `src/db/queries.ts`, `TskPanel.astro`, `package.json`.
- **PR2 — Spanish Vine + Strong-esp lexicon** (`feat/spanish-strong-lexicon`): rtf.ts,
  dctx.ts, lexicon.ts, manifests, `import-strong-esp.ts` (full coverage — do FIRST, high
  value, simple) + `import-vine.ts` (depth), `getEntradasParaCodigo`/`listAllLexiconCodes`,
  aggregate endpoint, `fetchEntradas`, StrongPanel multi-lexicon list + attribution, build
  wiring, 3 verify scripts. **STATUS: not started.**
- **PR3 (later)**: linkify see-also cross-refs between lexicon entries; map symbol-font
  original-language glyphs; optionally extend Strong tokens to sparvg/RV1909 if their USFM
  has `\w strong:` tags (likely absent).

Review workload forecast: ~1,100–1,400 changed lines → chained PRs (confirmed).

## How to resume on another machine

1. `git pull` (repo + this doc travel via git).
2. `pnpm install` (pnpm 11.x, Node 24).
3. **Copy the licensed `.dctx` files** into `sources/vine/` and `sources/strong-esp/`
   (they are gitignored — get them from the licensed originals listed above).
4. If Engram is available, the full context is under project `teoverse`, topic keys:
   `sdd/amplified-strong-lexicon/{explore,proposal,spec,design,tasks}` +
   `/lexicon-language-decision`, `/vine-source`, `/strong-esp-source`.
5. Resume: re-run `pnpm verify` for PR1 (code already committed/pushed), then PR2
   (start with Strong-esp full-coverage import — **blocked until the `.dctx` files are
   copied; they are NOT present on the CarlosCarabajal machine as of 2026-06-09**), then
   judgment-day on the full diff, then push + open the stacked PRs, then load the
   licensing/attribution document.

## Session config (cached)

Execution: **automatic** · Artifact store: **engram** · Delivery: **auto-chain** ·
Chain: **stacked-to-main** · TDD: failing-first verify scripts · Judgment-day at end.
