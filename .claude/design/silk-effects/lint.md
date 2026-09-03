---
module: silk-effects
category: architecture
status: current
completeness: 90
created: 2026-09-03
updated: 2026-09-03
last-synced: 2026-09-03
related:
  - ./architecture.md
  - ./hook-sections.md
  - ../cli/architecture.md
  - ../silk/architecture.md
---

# Lint namespace

## Table of Contents

- [Overview](#overview)
- [Current state](#current-state)
- [Topology](#topology)
- [Two entry points, one formatting step](#two-entry-points-one-formatting-step)
- [The YAML handler](#the-yaml-handler)
- [Rationale](#rationale)
- [Related documentation](#related-documentation)

## Overview

`Lint` (`src/lint/`, `export * as Lint`) holds the business logic of the former `@savvy-web/lint-staged` package: one handler per file kind (`Biome`, `Markdown`, `PackageJson`, `PnpmWorkspace`, `ShellScripts`, `TypeScript`, `Yaml`), the `Preset`/`createConfig` lint-staged configuration builders, the `Command`/`Filter` workspace utilities and the markdownlint template plus the `SAVVY-LINT` managed-section id the CLI installs.

## Current state

Implemented and consumed by `@savvy-web/cli` (`savvy lint …`) and `@savvy-web/silk` (the `lint` config shim). YAML formatting runs entirely on `@effected/yaml`; Prettier and `yaml-lint` are gone from the package.

## Topology

`src/lint/index.ts` is the authoritative listing. `Handler.ts` is the base every handler extends; `handlers/` holds the per-tool classes; `config/` the preset and config builders; `utils/` the command, filter and workspace helpers; `cli/` the pieces the CLI needs (`sections.ts` for the `SAVVY-LINT` section id — uppercase, see [Shared hook sections](./hook-sections.md) — and `templates/markdownlint.gen.ts`, the generated markdownlint config that `ConfigInspector`'s template-mirror table also knows about).

## Two entry points, one formatting step

Every handler is reachable two ways — as a lint-staged handler (`<Handler>.create()`) and as a `savvy lint fmt <name>` CLI subcommand — and a formatting step that lives inside only one of them silently rewrites a file differently depending on which path ran. So **a handler's byte-format step is a public static that both entry points call**, and the operation must be idempotent. `Lint.PnpmWorkspace.formatContent` (`handlers/PnpmWorkspace.ts`) is the worked example: it stringifies the sorted content through `@effected/yaml` with the options that reproduce the repo's canonical byte format, and both `create()` and the CLI subcommand route through it. `Lint.PackageJson.sortContent` is the same invariant over `@effected/package-json`'s tolerant text formatter. `__test__/lint/index.test.ts` pins the shapes.

**A shared static is necessary but not sufficient once the step takes options.** The `fmt` subcommand runs in its own process, so per-call options reach the formatter only if they are serialized onto the emitted command line. `Lint.Yaml` is the worked example: `fmtCommand` encodes `options.format` through `Yaml.encodeFormatOptions` into a `--format` flag and `savvy lint fmt yaml` decodes it with `Yaml.parseFormatOptions` before calling `formatFile`. Skip that hop and the two entry points write different bytes for the same configuration. Add a byte-parity regression test for any handler whose format step grows an options parameter.

## The YAML handler

`Lint.Yaml` (`handlers/Yaml.ts`, every `**/*.{yml,yaml}` except the two pnpm files, which have their own handlers) formats user-authored YAML where comment fidelity matters. Four properties are load-bearing:

- **The statics are synchronous.** `@effected/yaml` is a pure IO-free tier, so the only IO is the handler's own read and write; the handler that `create()` returns *throws* on invalid YAML rather than rejecting, and a test must use `toThrow`, not `rejects`.
- **`validateFile` gates on the whole stream** (`parseAllResult`, not a single-document parse), so a file whose second document is invalid fails rather than passing silently.
- **There is no config-file tier and none is planned.** `@effected/yaml` loads nothing from disk; formatting is configured in code through `YamlOptions.format`, defaulting to double quotes and indented sequences.
- **`indentSequences` is the option that matters; `quoteStyle` is inert on this path.** `quoteStyle` governs only scalars the stringifier creates and never re-quotes existing ones; it is set for consistency with `PnpmWorkspace`, not for effect.

## Rationale

### Why the handlers hold the formatting rather than the CLI

The CLI's `fmt` subcommands own argument parsing only (`../cli/architecture.md`). If a formatting step lived in the subcommand, lint-staged — which calls the handler directly — would produce different bytes from a manual `savvy lint fmt`, and the pre-commit hook would fight the developer.

## Related documentation

- [Architecture overview](./architecture.md)
- [Shared hook sections](./hook-sections.md) — the uppercase section-id guard
- [`../cli/architecture.md`](../cli/architecture.md) — the `savvy lint` commands
- [`../silk/architecture.md`](../silk/architecture.md) — the `lint` config shim
