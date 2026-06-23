---
"@savvy-web/github-action-builder": minor
---

## Features

### Worker bundle entries (`entries.workers`)

Adds `entries.workers` to the action config schema — a `Record<string, string>` mapping a bundle name to a source path. Each entry is emitted as `dist/<name>.js` alongside the standard lifecycle bundles (`main`, `pre`, `post`). Useful for declaring extra non-lifecycle scripts (e.g. a Node.js worker, a helper invoked via `node dist/cleanup.js`) without touching the lifecycle entry points.

- `entries.workers` — optional `Record<string, string>` in both `ActionConfig.entries` and the individual environment config blocks
- `WorkerEntryMissing` — new `@public` tagged error raised when a declared worker source file cannot be found on disk
- `WorkerEntryMissingBase` — exported base class for `WorkerEntryMissing` (follows the existing `*Base` pattern for tagged errors)
