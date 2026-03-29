# Contributing

Thank you for considering contributing to the Silk Suite Systems repo. This document explains how to set up your environment and submit changes.

## Prerequisites

- **Node.js** 24.11.0 (see `devEngines` in `package.json`)
- **pnpm** 10.33.0 (enforced via `packageManager` field)
- **Git** with commit signing configured (recommended)

## Setup

```bash
git clone https://github.com/savvy-web/systems.git
cd systems
pnpm install
```

## Development Commands

| Command | Description |
| --- | --- |
| `pnpm build` | Build all packages |
| `pnpm test` | Run tests |
| `pnpm typecheck` | Type-check all packages via Turbo |
| `pnpm lint` | Run Biome checks (no auto-fix) |
| `pnpm lint:fix` | Run Biome with auto-fix (safe fixes only) |
| `pnpm lint:md` | Lint markdown files |

## Code Quality Standards

- **Formatter:** Biome -- tabs, no trailing commas
- **Linting:** Biome with strict rules including `useNodejsImportProtocol`
- **TypeScript:** Strict mode, ES modules with `.js` extensions required
- **Testing:** Vitest via `@savvy-web/vitest`
- **Imports:** Use `node:` protocol for Node.js built-ins; separate type imports

## Pre-commit Hooks

The repository uses Husky with lint-staged. When you commit:

- TypeScript/JavaScript files are checked and fixed with Biome
- `package.json` files are sorted and formatted
- Markdown files are linted with `markdownlint-cli2`
- YAML files are formatted and validated
- TypeScript changes trigger a full typecheck

## Contribution Process

1. **Fork and branch** -- Create a feature branch from `main`
2. **Make changes** -- Follow the code quality standards above
3. **Add a changeset** -- Run `pnpm changeset` to describe your change
4. **Test** -- Run `pnpm test` and ensure all tests pass
5. **Commit** -- Use [Conventional Commits](https://www.conventionalcommits.org/) format (enforced by commitlint)
6. **Submit a PR** -- PR titles must also follow Conventional Commits format

## Developer Certificate of Origin (DCO)

All commits must be signed off to certify that you have the right to submit the contribution under the project's license. Add `Signed-off-by` to your commits:

```bash
git commit -s -m "feat: add new feature"
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
