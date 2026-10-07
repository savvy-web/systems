# SEA executables

`build()` compiles Node.js Single Executable Applications when the config has an `exe` field; driven by `@tsdown/exe` under the hood.

## Minimal example

```ts
import { build } from "@savvy-web/bundler";

await build({ exe: { fileName: "my-cli" } });
```

The default entry is `./src/bin.ts`.

## `ExeConfig`

| Field | Type | Default | What it does |
| --- | --- | --- | --- |
| `fileName` | `string` | — (required) | Output binary basename (no extension/suffix). |
| `entry` | `string` | `./src/bin.ts` | Bin entry source file. |
| `nodeVersion` | `string` | `25.9.0` | Node runtime embedded in the SEA. |
| `seaConfig` | `ExeSeaConfig` | see below | SEA config overrides. |
| `targets` | `ExeTarget[]` | inferred from `os`/`cpu` | Platform/arch targets to compile. |

`exe` also accepts an array of `ExeConfig` for multiple binaries.

## `ExeSeaConfig`

| Field | Type | Default | What it does |
| --- | --- | --- | --- |
| `disableExperimentalSEAWarning` | `boolean` | `true` | Suppresses the Node experimental-SEA startup warning. |
| `useCodeCache` | `boolean` | `false` | Embeds a V8 code cache for faster startup. |
| `useSnapshot` | `boolean` | `false` | Embeds a V8 heap snapshot. |

## `ExeTarget`

| Field | Type | What it does |
| --- | --- | --- |
| `platform` | `"darwin" \| "linux" \| "win"` | Target OS. |
| `arch` | `"arm64" \| "x64"` | Target architecture. |
| `nodeVersion` | `string` | Node runtime for this target. |

When `targets` is omitted, the target is inferred from the package's `os`/`cpu` fields.

## CLI flags

- `--target exe` — builds the binary.
- `--no-exe` — programs the manifest **without** compiling (used by `prepare` so installs stay fast).
