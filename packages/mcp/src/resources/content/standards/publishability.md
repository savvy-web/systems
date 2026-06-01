---
id: standards/publishability
title: Publishability rules
summary: Load when deciding whether a package publishes and how private vs publishConfig interact.
tier: standards
source: hand
tags: [publishability]
priority: 0.8
related: [packages/silk-effects/, standards/catalog-usage]
---

## Rule

A package's publishability is resolved from its `package.json` by applying these
rules in order; the first match wins:

1. `publishConfig.targets` is a non-empty array → one target per surviving entry.
2. `publishConfig.access` is `public` or `restricted` → a single target.
3. `private !== true` → a single default target.
4. otherwise → not publishable (empty).

`publishConfig.targets` takes precedence over the `private` flag: a package with
`private: true` and a `publishConfig.targets` array still publishes. The `private`
flag is consulted only as the last-resort default in rule 3.

## Why

In the Silk ecosystem `private: true` is the norm on source `package.json` files,
and `publishConfig` declares publish intent. The builder flips `private` based on
`publishConfig.access` at build time, so a source package with `private: true` and
`publishConfig.access: "public"` is publishable. Encoding intent in `publishConfig`
rather than the bare `private` flag lets a workspace keep packages private during
development and publish them deliberately.

`SilkPublishability.detect` is the pure entry point. Shorthand string targets
expand to registries: `"npm"` → npmjs, `"github"` → GitHub Packages, `"jsr"` →
jsr; an `http(s)://…` value is verbatim. String targets inherit the parent
`publishConfig.access`; object targets use their own access else the parent's.

## Examples

```text
{ private: true, publishConfig: { access: "public", targets: ["npm", "github"] } }
  → publishes to both npm and GitHub Packages

{ private: true }
  → not publishable (empty)
```

The adaptive detector additionally short-circuits changeset-ignored packages to
empty and dispatches on changeset mode (`none` → empty, `silk` → Silk rules,
`vanilla` → upstream default).

## See also

The detector services and layers are documented at `silk://packages/silk-effects/`.
Dependency pinning is at `silk://standards/catalog-usage`.
