---
"@savvy-web/mcp": minor
---

## Breaking Changes

The `turbo_inspect` tool's default task is now `build` instead of `build:dev` for `cache` and `graph` modes. Pass `task: "build:dev"` to keep inspecting the dev build.
