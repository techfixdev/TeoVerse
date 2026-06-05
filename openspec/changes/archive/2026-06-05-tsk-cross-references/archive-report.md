## Archive Report: tsk-cross-references

**Change**: tsk-cross-references
**Project**: teoverse
**Archived**: 2026-06-05
**Mode**: hybrid (engram + openspec)
**Archive location**: `openspec/changes/archive/2026-06-05-tsk-cross-references/`

### Verdict
**PASS WITH WARNINGS** — 22/22 tasks complete, build gate passes (4759 pages, astro check 0 errors). No CRITICAL issues. Two non-blocking warnings:

- **#W-01 — Target canon ordering deviation (XR-02 partial)**: `listTskForChapter()` doesn't include target `libros.id` in ORDER BY. References within a verse may not appear in canonical order.
- **#W-02 — Malformed drizzle journal JSON**: `drizzle/meta/_journal.json` has duplicate fragment after closing bracket. Future drizzle-kit operations may fail.

### Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| cross-references | Created (new domain) | 10 functional requirements, 6 non-functional, 8 edge cases, 5 build-time verification gates |

Source of truth: `openspec/specs/cross-references/spec.md`

### Lineage (Engram Observation IDs)

| Artifact | ID | Topic Key |
|----------|----|-----------|
| explore | #1111 | (manual save) |
| proposal | #1112 | sdd/tsk-cross-references/proposal |
| spec | #1113 | sdd/tsk-cross-references/spec |
| design | #1114 | sdd/tsk-cross-references/design |
| tasks | #1115 | sdd/tsk-cross-references/tasks |
| apply-progress | #1116 | sdd/tsk-cross-references/apply-progress |
| verify-report | #1117 | sdd/tsk-cross-references/verify-report |

### Implementation Summary

- **Slice 1 (DB + Import)**: `tsk_referencias` table + index, `import-tsk.ts` script, 344,799 rows imported. Commits: `ee03f80`, `149874a`, `2409707`.
- **Slice 2 (Query + Prerender)**: `listTskForChapter()` query + inline tsk-marker superscript badges with `data-tsk-refs` JSON embed. Commit: `bf812b5`.
- **Slice 3 (UI Components)**: TskClickProxy (event delegation), TskPanel (reference list + "Mostrar todas" toggle), CSS styles (mobile bottom sheet / desktop side column). Commit: `1aa97fa`.
- **Slice 4 (Workspace Wiring)**: `$senalTsk` atom, `ModuloTipo` union extended, WorkspaceLayout mounts, mutual exclusion (TSK ↔ Strong). Commit: `73b1add`.

### Key Discoveries
- OpenBible.info dataset uses dot-separated 3-field TSV (`Gen.1.1`), not tab-separated 5-field format
- OpenBible-specific abbreviations differ from standard OSIS — required complete mapping rewrite
- Bootstrap script handles new module IDs generically — no changes needed for `'tsk'` module

### Archive Contents
- ✅ proposal.md — Intent, scope, approach, risks, rollback plan
- ✅ specs/cross-references/spec.md — 10 functional + 6 non-functional requirements
- ✅ design.md — Architecture decisions, data flow, contracts, file changes
- ✅ tasks.md — 22 tasks across 5 phases, all marked [x]
- ✅ apply-progress.md — Per-slice commits, files, results, discoveries
- ✅ verify-report.md — Build/tests passed, 13/16 spec scenarios compliant
- ✅ explore.md — Exploration analysis

### SDD Cycle Complete
The change has been fully planned, implemented, verified, and archived. Ready for the next change.
