---
name: corpus-verify
description: >
  Use after writing or editing any savvy MCP corpus doc to run the build:catalog
  integrity gate and interpret the result. Reports schema, tier, tag, related,
  dead-name, and body-budget findings.
disable-model-invocation: false
allowed-tools: Bash(bash *)
---

# Verifying a corpus doc

After any write or edit under `packages/mcp/src/resources/content`, run the gate.
It validates front-matter against the schema, id uniqueness, the tier/directory
double-check, tag resolution, `related[]` resolution, the dead-name check, and
per-tier body budgets, then regenerates the gitignored `manifest.json`.

## Run it

Human-readable pass-through (requires `SAVVY_SYSTEMS_DIR` set, or run from inside
the checkout):

```bash
SAVVY_SYSTEMS_DIR="<path-to-systems>" bash "${CLAUDE_PLUGIN_ROOT}/skills/corpus-verify/scripts/build-catalog.sh"
```

Machine-readable summary (JSON: `pass`, `errors`, `warnings`, `entryCount`):

```bash
SAVVY_SYSTEMS_DIR="<path-to-systems>" bash "${CLAUDE_PLUGIN_ROOT}/skills/corpus-verify/scripts/build-catalog-json.sh"
```

## Acting on the result

- **Exit non-zero / `pass:false` with errors** — fix every error before declaring
  done. Errors are listed as `[build-catalog] ERROR ...`.
- **Warnings** — body-budget overruns are warnings, not failures. Report them to
  the user and prefer splitting the doc rather than exceeding the budget.
- A doc you wrote but did not commit gets an epoch lastModified — fine for drafts;
  commit before treating the corpus as final.
