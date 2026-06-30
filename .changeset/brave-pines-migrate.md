---
"@savvy-web/pnpm-plugin-silk": minor
---

## Features

### In-Tree Monorepo Build

`@savvy-web/pnpm-plugin-silk` has moved from its former standalone repository (`savvy-web/pnpm-plugin-silk`) into the Silk Suite systems monorepo, ending the cross-repo publishing loop. Previously, a change to the plugin's catalog entries or peer rules required a release in the plugin repo, a pull into this repo, a systems release, and then downstream config updates. The plugin now builds and releases in lockstep with the rest of the suite from a single PR.

The package builds in-tree via `@savvy-web/bundler`'s `build()` front door, backed by the `rolldown-pnpm-config` `PnpmConfigPlugin`. The `savvy.build.ts` at the package root is the single source of truth for all catalog entries, overrides, `allowBuilds` entries, hoist patterns, and peer rules.

### Maintainer Proxy Commands

Three workspace-root proxy commands are now available for maintainer workflows involving the plugin:

- `pnpm pnpm:up` — upgrade the plugin's own pnpm dependencies
- `pnpm pnpm:preview` — preview the generated plugin output before publishing
- `pnpm pnpm:export` — export the resolved plugin configuration

## Dependencies

| Dependency | Type | Action | From | To |
| :--------- | :----- | :------ | :------ | :------ |
| @effect/platform | config | updated | ^0.96.2 | ^0.96.0 |
| @effect/sql | config | updated | ^0.51.1 | ^0.51.0 |
