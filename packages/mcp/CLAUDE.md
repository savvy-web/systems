# @savvy-web/mcp

`@savvy-web/mcp` is the spawnable `savvy-mcp` server — a standalone tools-only MCP server (not a discovery host) exposing Silk tooling over silk-effects. No resource/corpus layer. Built via `@savvy-web/bundler`.

## Key surface

- Tools (ten): seven read-only — `workspace_info` (structured workspace analysis: linked/fixed package groups + resolved registry targets), `turbo_inspect` (mode cache|graph|affected over `turbo --dry`), `changeset_inspect` (mode branch|config|classify), `changeset_validate` (validates `.changeset/` files), `changeset_preview` (non-destructive release render over `Changesets.ReleasePlanner.preview`), `changeset_deps_detect` (detects dependency drift over `Changesets.DepsRegen`), `repos_inspect` (mode status|config over `Repos.ReposManager`/`Repos.ReposConfigStore`; markdown escapes every repo-derived string since vendored-repo content is untrusted input) — plus three mutating tools, the sanctioned exceptions to the read-only convention: `biome_check` (runs Biome with `--reporter=gitlab`, mode check|lint, `write`/`unsafe` to apply fixes), `changeset_deps_regen` (regenerates dependency changesets over `Changesets.DepsRegen`), and `repos_manage` (action sync|pin|add|note over `Repos.ReposManager`; flat wire args decode into an internal `Schema.TaggedStruct` request union that names the missing field per action on failure; the pin markdown surfaces `commitMessage` and `staleNoteIds` as the review/commit cue).
- `repos_manage` `sync`/`add`/`pin` are also where the vendored-tree permissions boundary is applied: `ReposManager` brackets their git mutations in `Repos.ReposLockdown` and leaves `.repos/**` OS-level read-only (files `0444`, dirs `0555`), which is why `runtime.ts` provides `Repos.ReposLockdown.layer` to `ReposManager.layer` and `Repos.ReposLockdownError` is in the tool's error union. The silk plugin's guards are early warning in front of that boundary, not the boundary; `repos_inspect` is unaffected, since reading a locked tree needs no write permission.
- All tools are backed by the same `silk-effects` services the `savvy` CLI uses.
- Depends only on `@savvy-web/silk-effects` within the repo; must NOT import `@savvy-web/cli` or `@savvy-web/silk`. Kit surfaces (`ToolDiscovery` from `@effected/commands`, `Workspaces`) are imported directly.
- The runtime is built once per process: `ToolDiscovery.layer` over `Workspaces.localExecLayer({ cwd })` gives ONE probe cache for the server's whole lifetime, and the same lifetime holds one `DepsRegen`/`ConfigInspector` — which is why config caches are refreshed per call rather than per layer build (#229).
- NO `peerDependencies` block: the Effect closure is sealed as regular `dependencies` (same posture as cli and tsdown-plugins, #228). When adding a new `@effect/*` dep, declare its required peers as regular deps too.

## Design

Load for the runtime layer and the tool implementations:
→ `@../../.claude/design/mcp/architecture.md`
Load when adding a tool, changing the runtime layer, or touching `__test__/runtime.smoke.test.ts` — the runtime is root-bound at layer build, which makes that suite the repo's canonical suite-boundary `layer(...)` case with two ordering constraints (fixture in `beforeAll`, layer wrapped in `Layer.suspend`).
