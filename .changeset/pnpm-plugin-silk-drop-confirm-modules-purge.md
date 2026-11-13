---
"@savvy-web/pnpm-plugin-silk": patch
---

## Maintenance

- The plugin no longer sets `confirmModulesPurge: false` in your workspace. It is a pnpm 11 setting that pnpm 12 does not read, so installs behave the same. The plugin's build moved to `rolldown-pnpm-config` 3.0.0, which models pnpm 12 settings and refuses ones pnpm 12 ignores.
