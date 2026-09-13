---
type: Convention
title: Run an @effected dogfood round through the mailbox protocol
description: "Link a kit package under active dogfooding via a pnpm-workspace.yaml overrides: entry of the form file:../../spencerbeggs/effected/packages/<name>/dist/prod/npm/pkg, verify kit signatures against the sibling checkout's src or its installed .d.ts (never a relayed summary), and never push or open a PR while any @effected file: override is linked."
tags: [tooling, release]
stale_after: 2026-12-11T00:00:00Z
sources:
  - id: plugin-dogfood
    resource: ../../plugins/silk/hooks/pre-tool-use/dogfood-guard.sh
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: 51a8fb19a568fbcfb66c1b482a89f14e4c7edc9dfdd8e7c016f06586caa6f221
---

# Run an @effected dogfood round through the mailbox protocol

Check the `overrides:` block in `pnpm-workspace.yaml` for an `@effected` `file:` entry before assuming a dogfood round is open or closed — that block also carries unrelated pins, so look specifically for `@effected/<name>` keys, not for the presence of `overrides:` itself. When every manifest resolves from the registry, no round is open.

Link a kit package under active dogfooding as `"@effected/<name>": "file:../../spencerbeggs/effected/packages/<name>/dist/prod/npm/pkg"` (the manifest lives under `pkg/`, not `npm/`) — the sibling checkout at `../../spencerbeggs/effected`. Keep package manifests on ordinary registry semver ranges; the `overrides:` entries do the linking, and removing them relinks to the registry with no manifest edit. Cover the full transitive `@effected` closure by re-deriving it from the lockfile, never from memory.[^plugin-dogfood]

Verify a kit signature against the sibling checkout's `../../spencerbeggs/effected/packages/<name>/src` or the installed `.d.ts` under `node_modules/@effected/<name>/` — never trust a summary of kit behavior relayed from an earlier session or a different agent. For `effect` core itself, the authority stays the vendored `.repos/effect` checkout pinned to the catalog tag, unaffected by any dogfood link.[^plugin-dogfood]

Never push or open a pull request while any `@effected` `file:` override is linked, on any branch except `dev` (a long-lived integration branch exempt unconditionally because nothing downstream installs against it). The linked paths exist only on the authoring machine; every other clone and any CI install would fail to resolve them. The `dogfood-guard` hook denies this mechanically and carries no bypass flag — correct a wrong deny by appending a `correction` journal entry, never by routing around the guard.[^plugin-dogfood]

Route cross-repo communication for a round through the file mailbox, never through the `okf/` bundle directly: mail lands at `.claude/dogfood/<sending-id>/` in the receiving repo (`savvy-web-systems` and `effected` are the two ids in play), and it is history, not documentation — promote a durable learning into an `okf/` concept afterward (via the `okfit:okf-docs` agent) rather than leaving it to live only in mail.[^plugin-dogfood]

Follow the exit sequence in order when a round concludes: wait for effected to cut a live release, delete the `@effected` `overrides:` entries, run `pnpm clean --lockfile && pnpm install` against the registry with no override net, run full verification, and only then start the finalize workflow (docs, changesets, squash, PR). Do not open a PR before the overrides are deleted and a clean registry install has been verified.[^plugin-dogfood]

See [silk-plugin](../modules/silk-plugin.md) for the skill, guard and monitor that implement this protocol.

[^plugin-dogfood]: `../../plugins/silk/hooks/pre-tool-use/dogfood-guard.sh` — the no-push-while-linked guard; the full protocol is `../../plugins/silk/skills/dogfood/SKILL.md`
