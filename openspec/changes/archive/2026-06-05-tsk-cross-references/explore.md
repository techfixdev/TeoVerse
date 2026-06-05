# Exploration: tsk-cross-references

> Treasury of Scripture Knowledge (TSK) cross-reference tool for TeoVerse.
> ~340,000+ verse-to-verse cross-references displayed inline with verse markers,
> following the Strong panel island pattern.

---

## 1. What Is TSK?

The **Treasury of Scripture Knowledge** is a public-domain cross-reference Bible study tool
created by R.A. Torrey circa 1900. It maps each Bible verse to related verses organized
by theme/topic. It is one of the most comprehensive cross-reference tools in the biblical
world (~500,000+ references in its original form; the OpenBible.info derivative has ~340,000
with quality filtering).

TSK is the reference standard used by e-Sword, Blue Letter Bible, BibleHub, and others.
The user specifically mentioned e-Sword's display: small superscript markers next to verse
text that show cross-references on interaction.

### Data Format

A typical cross-reference record looks like:

```
Source:  Genesis 1:1
References: Ps 33:6; Is 44:24; Jn 1:1-3; Heb 11:3; Job 38:4-7
```

Each source verse maps to N target verses, where targets can include verse ranges
(e.g., `Jn 1:1-3`).

---

## 2. Data Source

### Primary Recommendation: OpenBible.info Cross-References

| Attribute | Value |
|-----------|-------|
| **URL** | https://www.openbible.info/labs/cross-references/ |
| **Download** | https://a.openbible.info/data/cross-references.zip (2 MB) |
| **Format** | Tab-separated: `from_abbr\tfrom_chapter:from_verse\tto_abbr\tto_chapter:to_verse\trating` |
| **References** | ~340,000 (derived primarily from TSK + enhancements) |
| **License** | CC BY 4.0 (attribution) |
| **Versification** | KJV-based (standard Protestant canon) |

This dataset is based primarily on the TSK, enhanced with OpenBible.info's Topical Bible
and quality-vote data. It is the most widely-used machine-readable cross-reference dataset.

### Alternative: scrollmapper/bible_databases

| Attribute | Value |
|-----------|-------|
| **Repo** | https://github.com/scrollmapper/bible_databases |
| **Stars** | 1.6k, 524 forks |
| **Formats** | JSON, SQLite, CSV, PSQL, YAML, TXT |
| **License** | MIT |

The scrollmapper repo has cross-references as part of its much larger dataset. However,
the file paths for TSK-specific data were not found via direct raw URLs — the data
structure may have changed across versions. The OpenBible.info source is smaller, simpler,
and purpose-built for cross-references only.

### Versification Compatibility

**TeoVerse uses eBible.org/Scripture Earth USFM data** (Standard Protestant canon).
TSK was created with KJV versification. eBible.org follows standard versification,
so mismatches should be minimal. However:

- **Spanish version variances**: RVR1909, RVG, and PDPT may have slight verse numbering
  differences in Psalms (superscriptions counted as v1 vs v0) and some NT passages.
- **Mitigation**: Cross-references reference canonical verse positions (book + chapter + verse
  number), not version-specific verse IDs. As long as versification is standard, the
  references resolve correctly. Missing verses (e.g., a verse that exists in KJV but
  not in a Spanish version) should silently skip — show no reference marker for that verse.
- **Recommendation**: Validate with a spot-check script comparing a few known tricky
  passages (e.g., Psalm 3 title verse, Acts 19, Mark 16) between TSK data and PDPT versification.

---

## 3. Current Verse Rendering

### Chapter Page Structure

**File**: `src/pages/biblia/[version]/[libro]/[capitulo].astro`

The chapter page renders verses as an `<ol>` with each verse as:

```html
<li id="v{versiculo.numero}" class="grid grid-cols-[2rem_1fr] gap-3">
  <span class="pt-1 text-sm font-bold text-brand-cianDark">{versiculo.numero}</span>
  <span>
    <!-- Tokenized words with Strong markers (palabra-strong buttons for tagged words) -->
    <!-- or fallback: raw versiculo.texto (no tokens) -->
  </span>
</li>
```

Each verse `<li>` has `id="v{n}"` which acts as both:
1. A CSS scroll-margin anchor (`scroll-margin-top: var(--header-h)`)
2. A deep-link target (`/biblia/{v}/{b}/{ch}/#v{n}`)

### Verse Identification

Verses are identified by the compound key: `(recurso_id, libro_id, capitulo, versiculo)`.
At query time, the query uses `(version_slug, libro_slug, capitulo, versiculo)` via JOINs
through `recursos` and `libros`.

### Existing Panel Pattern (Strong)

The Strong panel (PR #9 feat/strong-panel) established the island pattern:

1. **StrongClickProxy** (`src/components/workspace/StrongClickProxy.astro`): event-delegation
   listener on `main.module-lectura`. When a `[data-strong]` element is clicked,
   `$senalStrong.set({ codigoStrong, palabra })`.

2. **StrongPanel** (`src/components/modules/StrongPanel.astro`): subscribes to `$senalStrong`,
   fetches `/datos/strong/{lexicon}/{codigo}.json`, renders definition.

3. **Panel slot**: Both components mounted in `WorkspaceLayout`'s `<slot name="panels">`.

4. **Mobile/Desktop**: Mobile shows a fixed bottom sheet (max 60vh); desktop (≥1024px)
   shows a sticky side column (360px wide) in the `.workspace-panels` aside.

5. **Open/close**: Controlled via `$workspace` store → CSS classes on `<html>`
   (`ws-strong-open`, `ws-strong-closed`) applied by `bootstrap.ts` pre-paint.

### Workspace Grid

```
Mobile:  single column — reading fills width, panel overlays as bottom sheet
Desktop: grid-template-columns: minmax(0, 1fr) 360px — reading + side panel
```

### Build Time Context

- **SSG** (`output: 'static'`): All pages are pre-rendered at build time.
- **Database**: SQLite (`local.db`) or Turso/libSQL remote. `prepare-build-data` re-seeds
  the DB from USFM sources at every build.
- **Query timing**: `getChapter()` and `listTokensForChapter()` run at build time
  during `getStaticPaths()`. The TSK query would run at the same phase.
- **No client-side DB**: All data must be available at build time in the DB or pre-generated
  as static files.

---

## 4. Integration Approach

### 4.1 Data Model

**New table**: `tsk_referencias` in the SQLite database.

```sql
CREATE TABLE tsk_referencias (
  id            INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  libro_id      INTEGER NOT NULL REFERENCES libros(id),
  capitulo      INTEGER NOT NULL,
  versiculo     INTEGER NOT NULL,
  ref_libro_id  INTEGER NOT NULL REFERENCES libros(id),
  ref_capitulo  INTEGER NOT NULL,
  ref_versiculo_start INTEGER NOT NULL,
  ref_versiculo_end   INTEGER NOT NULL
);

-- Fast lookup: "get all cross-references for a given chapter"
CREATE INDEX tsk_ref_source_idx ON tsk_referencias (libro_id, capitulo, versiculo);
```

**Why a separate table (not in `recursos`)?**
- TSK is version-agnostic — it references canonical verse positions (book + chapter + verse).
- TSK is a study tool, not a Bible version. It doesn't fit the `recursos` → `versiculos`
  pattern (which requires `recurso_id`).
- The `libro_id` foreign key maps to the canonical `libros` table, which is shared across
  all Bible versions.

**Why not JSON per chapter?**
- A JSON file per chapter (e.g., `datos/tsk/genesis/1.json`) would be ~240 KB for a
  large chapter like Psalm 119. Most chapters are much smaller.
- SQLite query at build time is simpler: one query per chapter, joins to resolve book names.
- The existing pattern (Strong lexicon) uses DB queries at build time → pre-rendered HTML.
  This should follow suit.

**Alternative considered: Pre-computed JSON files per chapter during `prepare-build-data`**
- This would decouple TSK from the DB query at build time.
- But it adds build complexity (another file generation step) for minimal benefit.
- Verdict: **Start with DB queries at build time**. If build time becomes problematic
  (>30% increase), switch to pre-computed JSON.

### 4.2 Import Script

New script: `scripts/import-tsk.ts`

```
Flow:
1. Download cross_references.zip from OpenBible.info (cache in sources/tsk/)
2. Unzip, read cross_references.txt
3. Parse tab-separated lines: from_book_abbr | from_c:v | to_book_abbr | to_c:v | rating
4. Map OSIS abbreviations (Gen, Exo, Lev...) to libro.slug (genesis, exodo, levitico...)
5. Batch INSERT into tsk_referencias
6. Add to prepare-build-data.ts pipeline
```

**Book abbreviation mapping**: The OpenBible.info dataset uses standard OSIS abbreviations
(e.g., `Gen`, `Exo`, `Lev`, `Num`, `Deu`, `Jos`, `Jdg`, `Rut`, `1Sa`, `2Sa`, `1Ki`, `2Ki`...).
The importer needs a static map from OSIS → `libro.slug`.

**Pipeline integration**: Add `import:tsk` script and include in `prepare-build-data`.

### 4.3 Query at Build Time

New query in `src/db/queries.ts`:

```typescript
type TskReference = {
  versiculo: number;
  referencias: Array<{
    libro: string;          // book name (e.g., "Salmos")
    libro_slug: string;     // book slug (e.g., "salmos")
    capitulo: number;
    versiculo_start: number;
    versiculo_end: number;
  }>;
};

async function listTskForChapter(libro: string, capitulo: number): Promise<TskReference[]>
```

Groups references by source verse number, ordered by book canon order + chapter + verse.

### 4.4 Render at Build Time

In the chapter page, add:

```astro
const tskRefs = await listTskForChapter({ libro: libro!, capitulo: Number(capitulo) });
const tskByVerse = new Map(tskRefs.map(r => [r.versiculo, r.referencias]));
```

Then in the verse `<li>`, render a superscript marker if `tskByVerse` has entries:

```html
<li id={`v${versiculo.numero}`}>
  <span>{versiculo.numero}</span>
  <span>
    {tokens...}
    {tskByVerse.has(versiculo.numero) ? (
      <button class="tsk-marker" data-tsk-refs={JSON.stringify(tskByVerse.get(versiculo.numero))}>
        {/* superscript icon or number */}
      </button>
    ) : null}
  </span>
</li>
```

The reference data is embedded in `data-tsk-refs` as serialized JSON so the TSK panel
can read it without a fetch call.

### 4.5 UI Components (e-Sword Style)

Following the Strong panel pattern:

1. **TskMarker** — inline inside each verse, a small superscript element:
   ```
   ...la tierra.ⁿ  (where n is the count of cross-references for this verse)
   ```
   Clicking it fires a signal to the TSK panel.

2. **TskClickProxy** — event delegation on `.module-lectura`, listens for clicks on
   `[data-tsk-refs]`, sets `$senalTsk`.

3. **TskPanel** — subscribes to `$senalTsk`, reads `data-tsk-refs` JSON, renders the
   list of cross-reference links. Each link navigates to the target verse.
   Uses the same panel slot and workspace grid.

4. **Store**: New `$senalTsk` atom in `src/stores/referencia.ts` or a new store file.

**Panel content for each reference**:
```
Génesis 1:1  →  Salmos 33:6; 102:25
                 Isaías 44:24
                 Juan 1:1-3
                 Hebreos 11:3
                 Job 38:4-7
```

Each target is a clickable `<a>` link to `/biblia/{current-version}/{book-slug}/{chapter}/#v{verse}`.

### 4.6 Mobile/Desktop Layout

Same as Strong panel:
- **Mobile**: Fixed bottom sheet (using `html.ws-tsk-open` class, analogous to `ws-strong-open`).
- **Desktop**: Side column in `.workspace-panels` aside (360px).

The TSK and Strong panels can coexist — they are separate panels, and the workspace
grid supports one panel at a time. If both are open simultaneously, the mobile layout
could stack or the user toggles between them. For simplicity, opening the TSK panel
closes the Strong panel and vice versa.

---

## 5. UI Approach

### Recommended: Inline Superscript Markers + Side/Bottom Panel

```
┌─────────────────────────────────────────────────────────┐
│ 1 En un principio ʼElohim creó los cielos y la tierra. ᛦ │  ← marker = count of refs
│                                                         │
│ ┌─ Panel lateral (desktop) ───────────────────────────┐│
│ │ Referencias Cruzadas   ✕                             ││
│ │ ─────────────────────                                ││
│ │ Génesis 1:1                                          ││
│ │                                                      ││
│ │ Salmos 33:6; 102:25                                  ││
│ │ Isaías 44:24                                         ││
│ │ Juan 1:1-3                                           ││
│ │ Hebreos 11:3                                         ││
│ │ Job 38:4-7                                           ││
│ └──────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

**Why this pattern:**
1. Matches the user's e-Sword reference ("marcado en cada versículo")
2. Follows the established Strong panel island pattern (consistency)
3. Mimics e-Sword's behavior where cross-references appear on click
4. Uses the existing `.workspace-panels` slot — no layout changes needed
5. Data is prerendered (embedded in data attributes) — no fetch calls, SSG-compatible

### Alternative Considered: Inline Expansion

Cross-references expand inline below the verse text (like a `<details>` element).

| Pros | Cons |
|------|------|
| No panel needed | Clutters the reading flow |
| Works on all devices | Long lists break verse rhythm |
| | Doesn't match e-Sword UX |
| | Violates the Strong panel pattern |

**Verdict**: Rejected. Panel pattern is better for the study workflow — reading
on the left, study tools on the right.

---

## 6. Risks

### 6.1 Build Time Impact

| Factor | Assessment |
|--------|-----------|
| **DB query per chapter** | One additional SQLite query per chapter page at build time. `listTskForChapter()` joins `tsk_referencias` with `libros`. With proper index (`tsk_ref_source_idx`), each query is sub-millisecond. |
| **4759 chapter pages** | Each page runs the TSK query during `getStaticPaths()`. 4759 queries * ~0.5ms = ~2.4 seconds total. **Negligible**. |
| **JSON serialization** | `data-tsk-refs` embeds reference arrays. Psalm 119 (176 verses, dense refs) might produce ~5KB of JSON. Most chapters produce < 500 bytes. |

### 6.2 Database Size

| Factor | Assessment |
|--------|-----------|
| **TSK data rows** | ~340,000 rows in `tsk_referencias` |
| **SQLite storage** | Estimated ~12-15 MB (with indexes). Acceptable for an ephemeral build DB. |
| **local.db growth** | Currently ~8 MB (4 Bibles + Strong). Adding TSK → ~20-23 MB. Still well within limits. |

### 6.3 Versification Mismatches

| Risk | Mitigation |
|------|-----------|
| Spanish Bibles may split verses differently than KJV | TSK references canonical positions. If the user's Bible has a different versification for a particular passage, the marker simply won't render for that verse. No error, no broken links. |
| Books with different names | Map TSK operates on canonical `libro_id` (shared across all versions), not version-specific book mappings. |
| Verse ranges out of bounds | If TSK references a verse that doesn't exist in the current version (e.g., missing verses), the reference is filtered out during rendering. |

### 6.4 SSG Constraints

| Constraint | Handling |
|-----------|----------|
| No client-side DB access | All TSK data is queried at build time and embedded in HTML as `data-tsk-refs` attributes. |
| No client-side fetch | The panel reads from the DOM, not from an API endpoint. Zero network calls. |
| Panel persist across navigation | Each page load is a fresh request — the panel resets. This is acceptable for a static site. |

### 6.5 UX Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Verse has 50+ references | Panel scrolls internally (`overflow-y: auto`). Limit display to first 30 with "Mostrar más" expand/collapse. |
| Verse has 0 references | No marker rendered (most common case — most verses have no TSK refs). |
| Panel open + navigate to new chapter | Panel closes on navigation (full page load). |
| Two panels open (Strong + TSK) | Mutually exclusive — opening one closes the other. |
| Mobile: panel covers verse | Bottom sheet pattern (max 60vh) already tested with Strong panel. |

---

## 7. Affected Areas

| File | Impact | Why |
|------|--------|-----|
| `drizzle/` | **New migration** | `tsk_referencias` table creation |
| `src/db/schema.ts` | **Modify** | Add tskReferencias table definition + Drizzle relations |
| `src/db/queries.ts` | **Modify** | Add `listTskForChapter()`, `TskReference` type |
| `scripts/import-tsk.ts` | **Create** | Download, parse, and import TSK data |
| `scripts/prepare-build-data.ts` | **Modify** | Add `import:tsk` to build pipeline |
| `src/pages/biblia/[version]/[libro]/[capitulo].astro` | **Modify** | Query TSK data, pass to verse list, add tsk-marker buttons |
| `src/components/workspace/TskClickProxy.astro` | **Create** | Event delegation for TSK marker clicks |
| `src/components/modules/TskPanel.astro` | **Create** | Panel island with reference list |
| `src/stores/referencia.ts` | **Modify** | Add `$senalTsk` atom + `SenalTsk` type |
| `src/stores/workspace.ts` | **Modify** | Add `'tsk'` to module state (habilitado/modo) |
| `src/styles/global.css` | **Modify** | Add `.tsk-panel`, `.tsk-marker`, `html.ws-tsk-open` styles (following Strong panel pattern) |
| `src/components/workspace/bootstrap.ts` | **Modify** | Add TSK panel class handling in bootstrap |
| `src/layouts/WorkspaceLayout.astro` | **Modify** | Add TskClickProxy + TskPanel to panels slot |
| `src/modules/contrato.ts` | **Minimal** | Add `'tsk'` to `ModuloTipo` union type |
| `package.json` | **Modify** | Add `import:tsk` script |
| `sources/tsk/` | **Create** | Cached cross_references.zip |

---

## 8. Recommendations

### Recommendation: Phase 1 — Inline Markers + Panel (e-Sword pattern)

**Concrete steps:**

1. **Create migration**: `drizzle/0003_tsk_referencias.sql` — `tsk_referencias` table with indexes.
2. **Create import script**: `scripts/import-tsk.ts` — download from OpenBible.info, parse tab-separated format, map OSIS → libro slugs, batch insert.
3. **Add query**: `listTskForChapter()` in `queries.ts` — grouped by verse, ordered by book canon order.
4. **Add store + proxy**: `$senalTsk` atom + `TskClickProxy.astro` — same delegation pattern as Strong.
5. **Add panel**: `TskPanel.astro` — renders reference list from `data-tsk-refs`, with clickable links.
6. **Wire chapter page**: Query TSK data, embed in `data-tsk-refs`, render superscript markers.
7. **Add CSS**: `.tsk-marker`, `.tsk-panel`, `html.ws-tsk-open` classes (mirror Strong panel styles).
8. **Wire workspace**: Bootstrap script handles `ws-tsk-open`/`ws-tsk-closed`; workspace store tracks module state.
9. **Add to build pipeline**: `import:tsk` in `prepare-build-data.ts`.
10. **Verify**: Spot-check 12-15 known verse references against e-Sword/BibleHub.

### What to defer

- **Scoping TSK to a specific Bible version**: Currently TSK is version-agnostic. Future
  work could filter references to show only those available in the currently-selected Bible.
- **TSK panel with multiple reference categories**: TSK groups references by theme/phrase
  within a verse (using letters: a, b, c...). The OpenBible.info dataset does not preserve
  these groupings. The original TSK formatting could be imported later if needed.
- **User notes/highlights on references**: Separate feature.

---

## 9. Ready for Proposal

**Yes**. The exploration is complete. The recommended approach (OpenBible.info data → SQLite
import → build-time query → prerendered data attributes → panel island following Strong
panel pattern) fits the existing architecture perfectly and is low-risk.

**Next phase**: `sdd-propose` — define formal proposal with scope, approach, delivery
strategy, and rollback plan.
