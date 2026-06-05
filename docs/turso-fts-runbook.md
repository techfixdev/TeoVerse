# FTS5 / Turso Deployment Runbook

> Run this BEFORE or SIMULTANEOUSLY with each Vercel production deploy for PR-1.
> Failing to run this leaves `versiculos_fts` absent from Turso — every prod search
> returns `{ results: [], error: 'search_unavailable' }`.

## Context

`build-fts.ts` is DB-target-agnostic: it reads `TURSO_CONNECTION_URL` from the environment
(same logic as `src/db/client.ts`). When that env var is set, it targets Turso. When absent,
it targets `file:local.db`.

The local `prepare-build-data.ts` pipeline runs `build:fts` as its last step automatically.
**You must run this runbook manually for Turso**, because `prepare-build-data.ts` exits early
when `TURSO_CONNECTION_URL` is set (it would otherwise try to reseed Turso, which is out-of-band).

## Prerequisites

`TURSO_CONNECTION_URL` and `TURSO_AUTH_TOKEN` must be set in your shell.

## Steps

```bash
# Step 1: Confirm env vars are set
echo $TURSO_CONNECTION_URL    # must not be empty
echo $TURSO_AUTH_TOKEN        # must not be empty

# Step 2: Populate FTS index on Turso
# This runs DROP + CREATE + rebuild against Turso.
# Turso versiculos must already be fully seeded (all Bible importers run).
pnpm build:fts

# Step 3: Verify row count
npx tsx -e "
import { client } from './src/db/client.ts';
const r = await client.execute('SELECT count(*) AS n FROM versiculos_fts');
console.log('FTS row count:', r.rows[0]);
client.close();
"
# Expect: n > 0 (should be ~124000)

# Step 4: MATCH smoke test (accent-insensitive — FTS-1)
npx tsx -e "
import { client } from './src/db/client.ts';
const r = await client.execute({ sql: 'SELECT count(*) AS n FROM versiculos_fts WHERE versiculos_fts MATCH ?', args: ['\"corazon\"'] });
console.log('MATCH corazon:', r.rows[0]);
client.close();
"
# Expect: n > 0

# Step 5: Deploy to Vercel (normal deploy process)

# Step 6: Verify prod endpoint
curl "https://<your-domain>/buscar.json?q=corazon&versiones=spapddpt"
# Expect: HTTP 200, results.length > 0, no "error" field in response body
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `pnpm build:fts` exits with "index is empty" | Turso versiculos not seeded | Run Bible importers against Turso first |
| `no such table: versiculos_fts` in prod | Runbook not run before deploy | Run this runbook, then redeploy |
| `results: [], error: 'search_unavailable'` in prod | FTS table missing or query error | Check Turso logs; rerun Step 2 |
| Row count much lower than ~124000 | Some importers failed | Rerun failed importers, then Step 2 |

## When to Re-run

Re-run steps 2–4 whenever:
- A new Bible version is imported to Turso
- Turso DB is reset/migrated
- PR-1 is deployed to a new environment
