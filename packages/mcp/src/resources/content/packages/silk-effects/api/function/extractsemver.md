---
id: packages/silk-effects/api/function/extractsemver
title: "extractSemver — silk-effects function"
summary: "Strip leading semver range operators from a version string."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# extractSemver

Strip leading semver range operators from a version string.

```ts
function extractSemver(version: string): string;
```

## Parameters

- `version` `string` — Raw version string that may include `^`, `~`, `>=`, `<`, `=`, or `v` prefixes.

## Returns

The bare semver string (e.g. `"1.9.3"`).
