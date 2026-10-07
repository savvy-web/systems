---
type: Convention
title: Committed shell scripts land as 100644, never 100755
description: "Do not restore the executable bit lint-staged strips from staged .sh files, do not flag the 755-to-644 mode change in review, and do not open an issue about it; chmod +x locally only when you need to run the script yourself."
status: draft
stale_after: 2026-11-11T00:00:00Z
tags: [tooling, ci]
sources:
  - id: lint-staged-config
    resource: ../../lib/configs/lint-staged.config.ts
  - id: shell-scripts-handler
    resource: ../../packages/silk-effects/src/lint/handlers/ShellScripts.ts
  - id: plugin-config
    resource: ../../plugin/pluginfinity.config.ts
  - id: startup-hook
    resource: ../../plugin/hooks/session-start/startup-only.sh
generated:
  by: okfit/claude-code
  at: 2026-10-07T16:26:44Z
  body_sha256: 00ff5d685107b79ae58599a3855b273ddf65e6df55b5a359436611b8ba42ed3f
---

# Committed shell scripts land as 100644, never 100755

Do not "fix" a `755`→`644` mode change on a `.sh` file in a diff, do not flag
it in review, and do not open an issue about it. It is the lint-staged
`ShellScripts` handler doing its job, not mode drift.[^shell-scripts-handler]

## The rule

- Every committed `.sh` file is invoked as `bash <script>` — plugin hooks
  through the built hook registrations (`scripts.invoke: "bash"` in
  `plugin/pluginfinity.config.ts`), the bats runner — so nothing needs the
  executable bit at runtime.[^lint-staged-config][^plugin-config]
- The pre-commit lint-staged pipeline (`Preset.silk()`) runs the
  `ShellScripts` handler over every staged `**/*.sh` file and strips the
  executable bit (`chmod -x`) by default, normalizing the mode to `100644`
  regardless of what was staged.[^shell-scripts-handler]
- The sole exception is `.claude/scripts/`, excluded from the handler by
  default (`ShellScripts.defaultExcludes`) as a consumer escape hatch for a
  script that must stay executable across commits.[^shell-scripts-handler]
- Write, or work on, an executable script locally by running `chmod +x` on
  it yourself; the next commit normalizes it back to `644`, and that is
  expected, not a regression to chase.[^lint-staged-config]
- A freshly added hook script that starts life at `755` will show `644` in
  its own commit while older siblings predating the handler may still carry
  `755` — that inconsistency is historical, not a bug to reconcile in an
  unrelated change.[^shell-scripts-handler]
- The handler deliberately still covers the generated `plugin/builds/**`,
  which Biome and markdownlint skip: stripping the bit from a built script
  and its source in the same commit keeps their modes equal, which
  `pluginfinity build --check` compares.[^lint-staged-config]

## Why

`bash <script>` invocation makes the executable bit dead weight everywhere
it is checked; keeping it out of the tree keeps diffs clean and removes any
incentive for a reviewer to chase 100755 as a signal of anything. The rule
is spelled out at the point of enforcement — the lint-staged config's
header comment and the handler's own doc comment — and at the point most
likely to trip an agent — the plugin's `SessionStart` orientation payload —
rather than being enforced silently and rediscovered as a surprise.[^lint-staged-config][^startup-hook]

Tracked as savvy-web/systems#289.

## Related

- [`modules/silk-effects.md`](../modules/silk-effects.md) — owns the `Lint`
  namespace and the `ShellScripts` handler.
- [`modules/silk-plugin.md`](../modules/silk-plugin.md) — the hook scripts
  this convention governs, and the `SessionStart` orientation that restates
  it.

[^lint-staged-config]: ../../lib/configs/lint-staged.config.ts
[^shell-scripts-handler]: ../../packages/silk-effects/src/lint/handlers/ShellScripts.ts
[^plugin-config]: ../../plugin/pluginfinity.config.ts
[^startup-hook]: ../../plugin/hooks/session-start/startup-only.sh
