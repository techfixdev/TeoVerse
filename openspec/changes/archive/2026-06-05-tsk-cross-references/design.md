# Design: TSK Cross-References

## Technical Approach

Mirror the Strong panel island pattern: import ~340K OpenBible.info references into SQLite, query and embed per-chapter at SSG build time as `data-tsk-refs` JSON on verse markers, then drive a TskPanel island via `$senalTsk` atom — zero runtime fetches. Mutual exclusion with Strong panel via workspace store.

## Architecture Decisions

| Decision | Option | Tradeoff | Chosen |
|----------|--------|----------|--------|
| Data embedding | `data-tsk-refs` JSON on marker | DB-at-build vs precomputed JSON files | `data-tsk-refs` — same pattern as Strong's `data-strong`, no extra build step |
| Table design | Standalone `tsk_referencias` with `libro_id` FK | vs `recursos`-scoped table | Standalone — TSK is version-agnostic, refs canonical positions |
| OSIS mapping | Static `Record<string, string>` in importer | vs `libros` table lookup by abbreviation | Static map — ~66 entries, avoids runtime DB lookup during import, matches importer pattern |
| Mutual exclusion | `TskClickProxy` sets `$senalStrong(null)` on click | vs workspace-level close logic | Click-proxy level — simpler, direct, mirrors that clicking one tool dismisses the other |
| Verse range refs | `ref_versiculo_start` + `ref_versiculo_end` columns | vs JSON array of verse numbers | Two integer columns — simpler index, smaller row, natural for SQL range queries |

## Data Flow

```
OpenBible.info zip ──→ import-tsk.ts ──→ SQLite tsk_referencias
                                                │
                              ┌───────────────────┘
                              ▼
              listTskForChapter() (build-time, getStaticPaths)
                              │
                              ▼
              Astro.props → data-tsk-refs={JSON} on <button class="tsk-marker">
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
    TskClickProxy.astro              TskPanel.astro
    (event delegation,              (subscribes to $senalTsk,
     $senalTsk.set)                  reads DOM data-tsk-refs,
                                     renders clickable links)
              │                               │
              └──── $senalTsk atom ───────────┘
                         │
              actualizarModulo('tsk', …) ──→ html.ws-tsk-open
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `drizzle/0003_tsk_referencias.sql` | Create | `tsk_referencias` table + `tsk_ref_source_idx` |
| `src/db/schema.ts` | Modify | Drizzle definition for `tskReferencias` table |
| `src/db/queries.ts` | Modify | `listTskForChapter()` query + `TskReference` type |
| `scripts/import-tsk.ts` | Create | Download → parse TSV → map OSIS → batch INSERT (chunk 350) |
| `scripts/prepare-build-data.ts` | Modify | Add `import:tsk` step after `import:mensaje` |
| `package.json` | Modify | Add `"import:tsk": "tsx scripts/import-tsk.ts"` script |
| `src/pages/biblia/[...capitulo].astro` | Modify | Query TSK, embed `data-tsk-refs`, render `.tsk-marker` buttons |
| `src/components/workspace/TskClickProxy.astro` | Create | Event delegation — `[data-tsk-refs]` click → `$senalTsk` |
| `src/components/modules/TskPanel.astro` | Create | Panel island — reads DOM, renders ref links |
| `src/stores/referencia.ts` | Modify | Add `SenalTsk` type + `$senalTsk` atom |
| `src/modules/contrato.ts` | Modify | Add `'tsk'` to `ModuloTipo` union |
| `src/layouts/WorkspaceLayout.astro` | Modify | Mount TskClickProxy + TskPanel in panels slot |
| `src/components/workspace/bootstrap.ts` | Modify | Handle `ws-tsk-open`/`ws-tsk-closed` CSS class logic |
| `src/styles/global.css` | Modify | `.tsk-marker`, `.tsk-panel`, `html.ws-tsk-open` — mirror `.strong-panel` |
| `sources/tsk/` | Create | Cached `cross_references.zip` |

## Interfaces / Contracts

```typescript
// src/db/queries.ts — new types + query
type TskRefTarget = {
  libro: string; libro_slug: string;
  capitulo: number; versiculo_start: number; versiculo_end: number;
};
type TskReference = { versiculo: number; referencias: TskRefTarget[] };
function listTskForChapter(libro: string, capitulo: number): Promise<TskReference[]>;

// src/stores/referencia.ts — new atom
interface SenalTsk { versiculo: number; referencias: TskRefTarget[] }
const $senalTsk = atom<SenalTsk | null>(null);

// src/modules/contrato.ts — union extension
type ModuloTipo = 'lectura' | 'strong' | 'diccionario' | 'comparar' | 'notas' | 'tsk';
```

**Schema** (Drizzle): `tskReferencias` table — `libro_id`, `capitulo`, `versiculo` (INTEGER FK → libros), `ref_libro_id`, `ref_capitulo`, `ref_versiculo_start`, `ref_versiculo_end`. Index: `(libro_id, capitulo, versiculo)`.

## Testing Strategy

| Layer | What | How |
|-------|------|------|
| Import | OSIS→slug mapping completeness | Assert all 66 books resolve; spot-check Gen 1:1 ref count |
| Query | `listTskForChapter` returns grouped results | Verify Gen 1:1 has ≥5 refs, Psalm 119 has dense coverage |
| Panel | Click marker → panel renders refs | DOM integration test: click `[data-tsk-refs]`, assert `.tsk-panel` visible |
| CSS | Mobile bottom sheet + desktop side column at 320–1440px | Visual regression (manual + automated screenshot) |
| Build | `pnpm verify` exits 0 | Full pipeline: import + build + query checks |

## Size Budget

| Metric | Estimate | Threshold | Status |
|--------|----------|-----------|--------|
| DB rows (tsk_referencias) | ~340K | N/A | Within limits |
| DB file growth | +12–15 MB | <25 MB total acceptable | 20–23 MB total |
| Per-chapter payload | 0–5 KB JSON (Psalm 119: ~5 KB) | <10 KB per chapter | OK |
| Build time per chapter | ~0.5ms (indexed query) | <30s total for 4759 chapters | ~2.4s total |
| Import time | <30s | 60s | Expected 15–20s |

## Migration / Rollout

No data migration required — DB is ephemeral and rebuilt every `prepare-build-data`. Rollback: remove `import:tsk` from pipeline, drop table migration, delete 4 new files, revert 8 modified files.

## Open Questions

None — all architectural decisions resolved in exploration phase.
