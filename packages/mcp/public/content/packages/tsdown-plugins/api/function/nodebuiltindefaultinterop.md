---
id: packages/tsdown-plugins/api/function/nodebuiltindefaultinterop
title: "nodeBuiltinDefaultInterop — tsdown-plugins function"
summary: "Rewrite a default import / default re-export of a Node built-in into the equivalent NAMESPACE form, so rolldown's CJS codegen produces correct interop. Why thi…"
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# nodeBuiltinDefaultInterop

Rewrite a default import / default re-export of a Node built-in into the equivalent NAMESPACE form, so rolldown's CJS codegen produces correct interop. Why this exists — a rolldown 1.1.0 codegen defect (verified against the latest published rolldown 1.1.0 / tsdown 0.22.2, with no newer release to upgrade to): For a default import of an EXTERNAL Node builtin, rolldown emits a bare `require("node:x")` WITHOUT its `__toESM` interop wrapper, yet still accesses `.default` — which is `undefined` on a builtin's CJS export object, so the call throws `Cannot read properties of undefined (reading 'cwd')` at runtime. NAMED imports are unaffected (`(0, node_process.cwd)()` reads a real property), and a NAMESPACE import is handled correctly: rolldown wraps it as `node_process = __toESM(require("node:process"), 1)`, which synthesizes `.default` and copies every own property, so member access works. This transform converts the broken default form into the working namespace form BEFORE codegen, so it is immune to minification and applies identically to per-module and bundled output. rolldown exposes no Rollup-style `output.interop` knob to fix this at the output layer, which is why the correction happens here on the source. Rewrites (the two static forms that occur in practice, anchored to statement start): The namespace binding NAME carries the builtin's named exports (`NAME.cwd`, `NAME.join`, ...), which is exactly how a default import of a builtin is consumed in practice. ESM output is unaffected at runtime (a namespace import of a builtin resolves to the same members), so the plugin is safe to attach to dual builds.

```ts
function nodeBuiltinDefaultInterop(): Plugin;
```
