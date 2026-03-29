# Silk Suite

Open-source tooling for building and deploying JavaScript/TypeScript modules and applications,
maintained by [Savvy Web Systems](https://savvyweb.systems).

Silk Suite provides a complete development lifecycle: build systems, testing infrastructure,
commit validation, changelog formatting, and a multi-phase release pipeline that publishes
to npm, GitHub Packages, and JSR with provenance attestations.

## Project Tracking

Development is tracked in the [Silk Suite](https://github.com/orgs/savvy-web/projects/1) GitHub Project.

Current focus: building the Silk Deployment System v2, a composable release pipeline
replacing the monolithic v1 system with focused, independently testable GitHub Actions
built on [Effect](https://effect.website).

## Claude Code Plugin Marketplace

Silk Suite includes a plugin marketplace for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).
Install plugins from this marketplace:

```bash
claude plugin add marketplace savvy-web/systems
```

### Available Plugins

- **changesets** -- Companion plugin for `@savvy-web/changesets` that helps write
  well-structured changeset files for GitHub release documentation

More plugins coming soon. See the [marketplace manifest](.claude-plugin/marketplace.json)
for the full listing.

## Ecosystem

Silk Suite spans 30+ packages across the `@savvy-web` npm scope and `savvy-web` GitHub org.

### Build Systems

- [@savvy-web/rslib-builder](https://github.com/savvy-web/rslib-builder) --
  TypeScript library builder using RSlib/Rsbuild with auto entry detection and API Extractor
- [@savvy-web/bun-builder](https://github.com/savvy-web/bun-builder) --
  Bun-native builder with lifecycle-phase architecture
- [@savvy-web/github-action-builder](https://github.com/savvy-web/github-action-builder) --
  Zero-config GitHub Action builder for Node.js 24

### Developer Experience

- [@savvy-web/lint-staged](https://github.com/savvy-web/lint-staged) --
  Composable pre-commit handlers (Biome, markdown, TypeScript, YAML)
- [@savvy-web/commitlint](https://github.com/savvy-web/commitlint) --
  Dynamic commitlint configuration with auto-detection
- [@savvy-web/vitest](https://github.com/savvy-web/vitest) --
  Zero-config monorepo test discovery and coverage presets
- [@savvy-web/changesets](https://github.com/savvy-web/changesets) --
  Structured changelog formatting with 13-category sections

### Package Management

- [@savvy-web/pnpm-plugin-silk](https://github.com/savvy-web/pnpm-plugin-silk) --
  Centralized dependency catalogs and version management via pnpm config dependencies
- [@savvy-web/github-action-effects](https://github.com/savvy-web/github-action-effects) --
  Effect-based services for GitHub Actions replacing `@actions/*`

### CI/CD Pipeline

- [silk-router-action](https://github.com/savvy-web/silk-router-action) --
  Release pipeline entry point: phase detection and release plan computation
- [workflow-release-action](https://github.com/savvy-web/workflow-release-action) --
  Release engine: branch management, validation, multi-registry publishing
- [workflow-runtime-action](https://github.com/savvy-web/workflow-runtime-action) --
  Runtime setup from `devEngines` with smart caching
- [silk-sync-action](https://github.com/savvy-web/silk-sync-action) --
  Organization-wide repo settings and label synchronization

### Templates

- [pnpm-module-template](https://github.com/savvy-web/pnpm-module-template) --
  Single package starter with full Silk Suite integration
- [pnpm-monorepo-template](https://github.com/savvy-web/pnpm-monorepo-template) --
  Multi-package monorepo scaffold

## Requirements

- Node.js 24+
- pnpm 10+

## License

[MIT](LICENSE)
