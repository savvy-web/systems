---
type: Convention
title: Handling vendored reference repos under .repos/
description: "Route every change to a vendored repo through savvy repos or repos_manage; never chmod .repos/** back to writable, and treat an EACCES there as a signal to use the tool."
tags: [tooling, security]
stale_after: 2026-12-11T00:00:00Z
sources:
  - id: plugin-repos
    resource: ../../plugins/silk/skills/repos/SKILL.md
  - id: silk-effects-repos
    resource: ../../packages/silk-effects/src/repos/services
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: 62bf75742021f4d28fa81970331756b851869a02cefb613898689642dfc1d108
---

# Handling vendored reference repos under .repos/

Route every mutation of a vendored reference repo through the `repos_manage` MCP tool or `savvy repos` — never a raw `Write`/`Edit`, never raw git plumbing against `.repos/**`. The manifest at `.repos/config.json` is the one hand-editable file; everything else under `.repos/` is enforced read-only by `Repos.ReposLockdown`, which chmods each vendored worktree to `0444`/`0555` for the duration between lifecycle operations.[^plugin-repos][^silk-effects-repos]

Never `chmod` a vendored tree back to writable to work around an `EACCES`. An `EACCES` inside `.repos/**` means the operation belongs to `repos_manage`/`savvy repos`, not that the permission is wrong. Three PreToolUse guards (`repos-fs-guard.sh`, `repos-bash-guard.sh`, `repos-mcp-guard.sh`) exist only to catch the attempt earlier and name the sanctioned primitive — they are UX in front of the OS boundary, not the boundary itself, and a miss in their pattern-matching is not license to bypass the tool.[^plugin-repos]

Do not treat a locked worktree as tamper-proof against `git checkout`. The lock covers file permissions on the worktree only, deliberately leaving the submodule's git metadata directory writable so ordinary git clients keep working; `git checkout <other-ref>` inside a vendored tree is not blocked and leaves the worktree stale without tripping any guard. Run `savvy repos status --drift` to detect this (`checkoutDiverged`) and `savvy repos restore` to repair it — the invariant this machinery provides is "a drifted pin is always detected and one command from repaired," not "the pin cannot drift."[^silk-effects-repos]

Re-pin a vendored repo whenever the dependency it mirrors bumps. `.repos/config.json` is the live record of what is vendored, at what ref, with what sparse paths — treat it as the source of truth over memory or a stale note, and re-pin through `savvy repos pin` rather than hand-editing the ref.[^plugin-repos]

Verify any Effect v4 API against the vendored `.repos/effect` source or the installed release — never against v3 memory or a v3-shaped recollection. The vendored checkout is pinned to the tag matching the `effect` catalog entry; when the installed version and the pin disagree, `node_modules` wins.

When a false-positive guard denial or missed drift occurs, resolve it through the same path the guard names: `repos_inspect` to see current state, then `repos_manage`/`savvy repos` to reconcile — never a manual filesystem workaround.[^plugin-repos]

See [vendored-repos-lockdown](../decisions/vendored-repos-lockdown.md) for why the boundary is OS permissions rather than guards alone, [silk-plugin](../modules/silk-plugin.md) for the guard and monitor implementation, and [silk-effects](../modules/silk-effects.md) for the `Repos` namespace this convention governs.

[^plugin-repos]: `../../plugins/silk/skills/repos/SKILL.md` — the guard hooks it fronts are `../../plugins/silk/hooks/pre-tool-use/repos-fs-guard.sh`, `repos-bash-guard.sh`, `repos-mcp-guard.sh`
[^silk-effects-repos]: `../../packages/silk-effects/src/repos/services` — `lockdown.ts` (the `Repos.ReposLockdown` chmod boundary) and `drift.ts` (`checkoutDiverged` detection)
