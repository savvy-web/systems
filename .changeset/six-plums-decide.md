---
"@savvy-web/cli": minor
---

## Features

Adopts the `@effected` front-end kit for the CLI runtime.

### Restyled human output

Command output is restyled for readability: `✓`/`⚠`/`✗`/`•` glyphs replace the previous log-style lines, coloured only when stdout is a TTY and `NO_COLOR` is unset, with no timestamp or level prefix.

### Every log line on stderr

Every log line now goes to stderr; stdout carries only a command's result, JSON output, and hook envelopes. `savvy repos status --json` now prints `{ "error": ..., "clean": false }` on a config error instead of a plain error line.

### Carrier-aware version

`main(options?)` takes a `distribution` option. When `savvy` is launched through a carrier such as `@savvy-web/silk`, `savvy --version` reports it:

```ts
main({ distribution: { name: "@savvy-web/silk", version: "4.2.8" } });
// savvy --version -> "savvy v3.2.8 via @savvy-web/silk 4.2.8"
```

Launched directly, the version line is unchanged.

## Breaking Changes

Usage errors now exit with code `64` (previously `1`), matching the `@effected/cli` convention for invalid invocations.

## Dependencies

| Dependency       | Type       | Action | From | To    |
| :--------------- | :--------- | :----- | :--- | :---- |
| @effected/cli    | dependency | added  | —    | 0.8.0 |
| @effected/engine | dependency | added  | —    | 0.1.0 |
