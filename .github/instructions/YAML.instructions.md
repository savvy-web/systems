---
applyTo: "**/*.{yml,yaml}"
---

When editing YAML files (excluding `pnpm-lock.yaml` and `pnpm-workspace.yaml`), always run:

```bash
pnpm exec savvy lint fmt yaml <file>
```

This formats and validates the file through `@effected/yaml`, preserving comments and blank lines and covering every document of a multi-document stream. Do NOT reach for `prettier` or `yaml-lint` — neither is a dependency of this repo any more, and `pnpm dlx` would fetch an unrelated copy that does not match the repo's format. Review any remaining errors and file them for further attention if needed.
