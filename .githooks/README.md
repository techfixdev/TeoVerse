# `.githooks/`

Local git hooks for the TeoVerse repo. To activate in a fresh clone:

```bash
git config core.hooksPath .githooks
```

## `post-commit`

After every commit, pushes Engram Cloud (the team's persistent memory at
`http://192.168.100.20:18080`) for the `teoverse` project.

The hook is silent on failure — an Engram outage must never block a commit.
If the `ENGRAM_CLOUD_TOKEN` env var is not set (User or Process scope), the
hook no-ops without erroring.

The hook lives in this directory and is tracked by git so that any clone +
`git config core.hooksPath .githooks` gets the automation for free.

**Last verified**: 2026-06-04 — end-to-end test with a sentinel observation
pushed to the cloud via this hook. Log: `~/.engram/post-commit.log`.
