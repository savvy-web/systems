---
id: packages/tsdown-plugins/api/function/syncpublicdir
title: "syncPublicDir — tsdown-plugins function"
summary: "Mirror `sourceDir` into `targetDir`, idempotently. Replaces tsdown's built-in `copy`, whose non-recursive mkdir throws `EEXIST` when the target already exists…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# syncPublicDir

Mirror `sourceDir` into `targetDir`, idempotently. Replaces tsdown's built-in `copy`, whose non-recursive mkdir throws `EEXIST` when the target already exists (re-builds, `prepare`-on-install, concurrent turbo invocations). Behavior: - source absent: no-op. - target absent: copy `sourceDir` wholesale. - target present: copy only files that are new or whose bytes differ, then delete target files that no longer exist in the source and prune the directories left empty. The byte-diff keeps unchanged files (and their timestamps) untouched, so a large copied asset tree — e.g. the mcp markdown corpus — is not rewritten on every build.

```ts
function syncPublicDir(sourceDir: string, targetDir: string): void;
```
