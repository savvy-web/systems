# @savvy-web/github-action-effects

`@savvy-web/github-action-effects` is an Effect-based library that replaces `@actions/*` with schema-validated services for building GitHub Actions. Built via `@savvy-web/bundler`.

## Key surface

- 37 schema-validated Effect services covering the GitHub Actions runtime surface.
- All Effect code uses class-based `Context.Tag`, `Schema.Class`/`Schema.TaggedClass`, `Data.TaggedError`.

## Design

Load for the service inventory, layer composition, errors/schemas, integration points, and testing strategy (six docs):
→ `@../../.claude/design/github-action-effects/index.md`
Load when adding a service, composing layers, or building a GitHub Action on these services.
