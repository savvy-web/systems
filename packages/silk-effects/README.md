# @savvy-web/silk-effects

[![npm version](https://img.shields.io/npm/v/@savvy-web/silk-effects)](https://www.npmjs.com/package/@savvy-web/silk-effects)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Shared [Effect](https://effect.website/) library providing Silk Suite conventions for publishability detection, versioning strategy, tag formatting, managed sections, config discovery, and Biome schema synchronization. Platform-agnostic: consumers provide their own runtime layer (Node.js, Bun, etc.).

## Features

- Resolve publish targets from shorthand strings, URLs, or objects with sensible defaults
- Detect versioning strategy (single, fixed-group, independent) from changeset config
- Format git tags consistently based on workspace structure
- Manage tool-owned sections inside user-editable files without clobbering user content
- Discover config files using a priority-based search convention
- Keep Biome `$schema` URLs in sync across config files

## Installation

```bash
pnpm add @savvy-web/silk-effects effect @effect/platform @effect/platform-node
```

`effect` is a peer dependency -- install it alongside the package.

## Quick Start

```typescript
import { Effect } from "effect";
import { TargetResolver, TargetResolverLive } from "@savvy-web/silk-effects/publish";

const targets = await Effect.runPromise(
  Effect.gen(function* () {
    const resolver = yield* TargetResolver;
    return yield* resolver.resolve(["npm", "github"]);
  }).pipe(Effect.provide(TargetResolverLive)),
);
```

Modules that access the filesystem require a platform layer:

```typescript
import { NodeContext } from "@effect/platform-node";
import { ManagedSection, ManagedSectionLive } from "@savvy-web/silk-effects/hooks";

await Effect.runPromise(
  Effect.gen(function* () {
    const section = yield* ManagedSection;
    yield* section.write(".husky/pre-commit", "silk", "\nnpx lint-staged\n");
  }).pipe(
    Effect.provide(ManagedSectionLive),
    Effect.provide(NodeContext.layer),
  ),
);
```

## Modules

Each module has its own entry point -- import only what you need:

| Module | Entry Point | Platform Layer | Docs |
| ------ | ----------- | -------------- | ---- |
| Publish | `@savvy-web/silk-effects/publish` | No | [docs/publish.md](./docs/publish.md) |
| Versioning | `@savvy-web/silk-effects/versioning` | Yes | [docs/versioning.md](./docs/versioning.md) |
| Tags | `@savvy-web/silk-effects/tags` | No | [docs/tags.md](./docs/tags.md) |
| Hooks | `@savvy-web/silk-effects/hooks` | Yes | [docs/hooks.md](./docs/hooks.md) |
| Config | `@savvy-web/silk-effects/config` | Yes | [docs/config.md](./docs/config.md) |
| Biome | `@savvy-web/silk-effects/biome` | Yes | [docs/biome.md](./docs/biome.md) |

## Documentation

For service API reference, schemas, error types, and advanced usage, see [docs/](./docs/).

## License

[MIT](./LICENSE)
