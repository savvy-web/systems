# @savvy-web/ai-plugins

`@savvy-web/ai-plugins` is the pluginfinity source of the `silk` agent plugin. `pluginfinity build` turns it into two committed plugins: `builds/claude/` (Claude Code) and `builds/copilot/` (GitHub Copilot). It is private and never published to npm. The legacy `../plugins/silk/` copy still serves the Claude marketplace until the release branch deletes it.

## Key surface

- **Edit the source, never `builds/`.** The source is `pluginfinity.config.ts` (manifest, hooks, MCP/LSP servers, monitors, session env), `skills/`, `agents/`, `hooks/`, `bin/`, `monitors/` and `scripts/`. After any change, rebuild and commit `builds/` in the same commit: `build:check` fails on any byte or mode difference. Never format or lint-fix `builds/**`, and never edit `../plugins/silk/`.
- **Commands.** Root `pnpm test:hooks` runs `__test__/run-tests.sh`, which builds, shellchecks the built scripts of both targets, runs bats on both hosts and finishes with `build --check`. In this package, `pnpm run build:check` is the drift check alone and `pnpm run validate` is `pluginfinity validate`. `pnpm build` also rebuilds it through turbo. The `pr-body` skill drift test (`__test__/pr-body-skill-sync.test.ts`) runs under `pnpm test`.
- **Versioning.** Independent of `@savvy-web/silk`. Write a changeset for `@savvy-web/ai-plugins`; its `versionFiles` bump both built manifests. Never hand-bump `package.json` or a built `plugin.json`.
- **The plugin name `silk` is load-bearing**, as are the `savvy-mcp` server key and the `biome` LSP key. Claude names the tools `mcp__plugin_silk_savvy-mcp__<tool>`, and skills, agents and hooks spell them that way.
- **Hooks run on pluginfinity's library.** Mark a guard `failClosed: true`, declare session variables in the config's `env` (never `SILK_PROJECT_DIR`), and test every hook and script on both targets.

## Design

Load for the layout, the build/test/release model, the two hosts and the capability map:
→ `@../okf/modules/silk-plugin.md`
Load when working anywhere in this package or the legacy `plugins/silk/`.

The editing rule and the rules for hooks, scripts, skills and tests:
→ `@../okf/conventions/edit-plugin-source-not-builds.md`
→ `@../okf/conventions/plugin-authoring.md`
Load before editing any source file or `__test__/` suite.

Why one source for two hosts, and why the package versions on its own:
→ `@../okf/decisions/adopt-pluginfinity-one-source-two-hosts.md`
→ `@../okf/decisions/ai-plugins-versions-independently.md`
Load before changing the build model, `versionFiles` or the marketplace wiring.

What the Copilot build cannot do, and how its marketplace pin moves:
→ `@../okf/limitations/copilot-plugin-host-gaps.md`
→ `@../okf/interfaces/copilot-plugin-marketplace.md`
Load when a change touches host-specific behaviour, `targets` frontmatter, or `.github/plugin/marketplace.json`.

How the Claude build compares with `plugins/silk`, and what the hosts give a plugin process:
→ `@../okf/measurements/claude-build-fidelity-against-legacy-plugin.md`
→ `@../okf/measurements/claude-code-plugin-process-environment.md`
→ `@../okf/measurements/copilot-plugin-host-environment.md`
Load when a behaviour difference from `plugins/silk` is suspected, or when relying on a host environment variable.

Traps:
→ `@../okf/gotchas/markdownlint-fix-renumbers-host-block-lists.md` — load before writing a host block inside a list.
→ `@../okf/gotchas/pkill-monitor-kills-every-session.md` — load before stopping a monitor.
→ `@../okf/gotchas/it2-doorbell-retry-duplicates.md` — load when touching the dogfood doorbell.
