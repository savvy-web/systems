---
id: packages/bundler/api/interface/runoptions
title: "RunOptions — bundler interface"
summary: "interface RunOptions from @savvy-web/bundler."
tier: packages
source: generated
tags: [bundler, api]
priority: 0.3
related: []
---

# RunOptions

```ts
interface RunOptions
```

## Members

### argv

```ts
readonly argv: ReadonlyArray<string>;
```

### buildTargetGroups

```ts
readonly buildTargetGroups?: (o: BuildTargetGroupsOptions) => Promise<void>;
```

Injectable for tests.

### copyAmbientDts

```ts
readonly copyAmbientDts?: ((o: CopyAmbientDtsOptions) => void) | undefined;
```

Injectable ambient-.d.ts copier (defaults to copyAmbientDts).

### cwd

```ts
readonly cwd: string;
```

### generateMeta

```ts
readonly generateMeta?: (o: GenerateMetaOptions) => Promise<MetaResult>;
```

Injectable for tests.

### readExports

```ts
readonly readExports?: () => Record<string, string> | undefined;
```

Injectable for tests: returns the package.json `exports` map.

### readOsCpu

```ts
readonly readOsCpu?: (() => {
    os: ReadonlyArray<string>;
    cpu: ReadonlyArray<string>;
  }) | undefined;
```

Injectable for tests: returns the package os/cpu arrays.

### readPackageName

```ts
readonly readPackageName?: () => string;
```

Injectable for tests: returns the package name.

### readPublishTargets

```ts
readonly readPublishTargets?: (() => PublishTargets | undefined) | undefined;
```

Injectable for tests: returns package.json publishConfig.targets, or undefined.

### readTsconfigJsx

```ts
readonly readTsconfigJsx?: (() => TsconfigJsx) | undefined;
```

Injectable for tests: reads the jsx-relevant tsconfig compilerOptions slice.

### readVersion

```ts
readonly readVersion?: () => string;
```

Injectable for tests: returns the package version string.

### resolveNextVersions

```ts
readonly resolveNextVersions?: ((cwd: string) => Promise<NextVersions>) | undefined;
```

Injectable for tests: resolves next release versions for the optimistic meta rewrite.

### runExeBuild

```ts
readonly runExeBuild?: ((o: RunExeBuildOptions) => Promise<void>) | undefined;
```

Injectable for tests.

### writeIssues

```ts
readonly writeIssues?: (opts: {
    cwd: string;
    target: "dev" | "prod";
    reports: ReadonlyArray<BuildReport>;
    now?: () => Date;
  }) => string | undefined;
```

Injectable issues-artifact writer (defaults to writeIssuesArtifact).

### writeOutput

```ts
readonly writeOutput?: (output: RenderedOutput) => void;
```

Injectable for tests: consumes rendered output (defaults to process.stdout.write).

### writeTargetsBinding

```ts
readonly writeTargetsBinding?: ((cwd: string, resolution: TargetResolution) => string) | undefined;
```

Injectable for tests: writes the target binding artifact.

### writeTsconfig

```ts
readonly writeTsconfig?: (cwd: string) => string;
```

Injectable for tests: writes the resolved tsconfig and returns its path (defaults to writeResolvedTsconfig, which writes to the OS temp dir).
