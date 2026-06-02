---
id: packages/github-action-effects/api/interface/githubcontentteststate
title: "GitHubContentTestState — github-action-effects interface"
summary: "Test state for GitHubContent."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GitHubContentTestState

Test state for [GitHubContent](silk://packages/github-action-effects/api/class/githubcontent).

```ts
interface GitHubContentTestState
```

## Members

### files

```ts
readonly files: Map<string, string>;
```

File contents (already decoded) returned by `getFile`, keyed by `${ref ?? ""}:${path}`. Seed with the decoded text, e.g. `files.set("base-sha:pkg/package.json", JSON.stringify({ version: "1.0.0" }))`.
