---
id: packages/github-action-effects/api/variable/semverresolver
title: "SemverResolver — github-action-effects variable"
summary: "Namespace for semver resolution operations. Wraps `semver-effect` with unified SemverResolverError error handling."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# SemverResolver

Namespace for semver resolution operations. Wraps `semver-effect` with unified [SemverResolverError](silk://packages/github-action-effects/api/class/semverresolvererror) error handling.

```ts
SemverResolver: {
    readonly compare: (a: string, b: string) => Effect.Effect<-1 | 0 | 1, SemverResolverError>;
    readonly satisfies: (version: string, range: string) => Effect.Effect<boolean, SemverResolverError>;
    readonly latestInRange: (versions: Array<string>, range: string) => Effect.Effect<string, SemverResolverError>;
    readonly increment: (version: string, bump: "major" | "minor" | "patch" | "prerelease") => Effect.Effect<string, SemverResolverError>;
    readonly parse: (version: string) => Effect.Effect<{
        major: number;
        minor: number;
        patch: number;
        prerelease?: string;
        build?: string;
    }, SemverResolverError>;
}
```
