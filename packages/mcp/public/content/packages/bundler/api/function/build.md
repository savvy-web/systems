---
id: packages/bundler/api/function/build
title: "build — bundler function"
summary: "Sugar front door: define + run in one call, deriving `cwd`/`argv` from process globals. `cwd` is the directory of the entry script (`process.argv[1]`) — the fa…"
tier: packages
source: generated
tags: [bundler, api]
priority: 0.3
related: []
---

# build

Sugar front door: define + run in one call, deriving `cwd`/`argv` from process globals. `cwd` is the directory of the entry script (`process.argv[1]`) — the faithful equivalent of the old `import.meta.dirname`, correct even when invoked by an explicit path from another directory. `argv` is `process.argv.slice(2)`, so `--target` and friends are read internally; the package.json [build](silk://packages/bundler/api/function/build) scripts stay `node savvy.build.ts --target <t>`. `overrides` merges last as the test/advanced IO seam (the same injectables as [RunOptions](silk://packages/bundler/api/interface/runoptions)).

```ts
function build(input?: BuildConfigInput, overrides?: Partial<RunOptions>): Promise<void>;
```
