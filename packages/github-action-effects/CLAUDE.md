# @savvy-web/github-action-effects

`@savvy-web/github-action-effects` is an Effect-based library that replaces `@actions/*` with schema-validated services for building GitHub Actions. Built via `@savvy-web/bundler`.

## Key surface

- 39 schema-validated Effect services covering the GitHub Actions runtime surface.
- All Effect code uses class-based `Context.Tag`, `Schema.Class`/`Schema.TaggedClass`, `Data.TaggedError`.
- Library posture: `@effect/*` stays devDependencies + `peerDependencies` (consumers provide the Effect runtime) — deliberate; do NOT seal the closure as regular deps like cli/mcp/tsdown-plugins do.
- `GitHubClient`'s `rest`/`paginate`/`paginateStream` octokit callback parameters are typed `any` (with a `biome-ignore`) DELIBERATELY: the layer implementations still annotate theirs `unknown`, and TS parameter contravariance rejects a narrower type against them. `any` is what lets a caller annotate the parameter as the exported `GitHubOctokit` (`@octokit/rest`'s `Octokit` with the rest-endpoint-methods + paginate plugins) instead of hand-rolling a cast interface. Do not "fix" it back to `unknown`; tighten it only in the per-layer pass that retypes the implementations.
- Domain error wrappers may ENRICH, not just rename — add a discriminant rather than making callers re-query the API. `GitBranchError`'s optional `status` + `alreadyExists` (set for the benign 422/409 ref-create race) is the reference case; route every failure path through the shared `mapError` so no branch constructs the error bare.

## Design

Load for the service inventory, layer composition, errors/schemas, integration points, and testing strategy (six docs):
→ `@../../.claude/design/github-action-effects/index.md`
Load when adding a service, composing layers, or building a GitHub Action on these services.
