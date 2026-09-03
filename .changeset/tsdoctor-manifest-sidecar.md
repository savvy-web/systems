---
"@savvy-web/tsdown-plugins": minor
---

## Features

### `tsdoctor.json` sidecar

The meta pass now emits a `tsdoctor.json` sidecar (spec 1, via the new `@tsdoctor/manifest` dependency) into each prod group's `meta/` bundle and into `meta.localPaths`.

Identity is resolved from three ranked tiers: the new `MetaOptions.tsdoctor` config option (`TsdoctorMetaOptions`), then the package's own `tsdoctor.json` (leaf tier), then the workspace root's `tsdoctor.json` (project tier) — loaded by the new `loadTsdoctorSources`. Registries are derived automatically from the group's `targets.json` targets for public packages, unless `registries: false` opts out. A derived GitHub Packages registry links to the repository's package page (`https://github.com/<owner>/<repo>/pkgs/npm/<name>`), parsed from the emitted `repository` field by the new `githubOwnerRepo` export, and is omitted when the repository can't be parsed.

```ts
import { defineBuild } from "@savvy-web/bundler";

export default defineBuild({
  meta: {
    tsdoctor: {
      tagline: "Every shape",
      description: "Structured API diagnostics for TypeScript builds",
      openGraph: { themeColor: "#0f172a" },
    },
  },
});
```

### Build-time Open Graph images

A configured `openGraph.generate` renders an image at build time to `meta/og/<unscoped>.<ext>` and lists it first among `openGraph.images`. Image dimensions are read with the new `image-size` dependency (new `writeGeneratedOgImage`).

New exports: `composeTsdoctorManifest`, `ogImageInfoOf`, `registriesFromTargets`, `loadTsdoctorSources`, `TsdoctorSourceError`, `writeGeneratedOgImage`, `OgGenerateError`, `githubOwnerRepo`, and the types `OgImageInfo`, `TsdoctorMetaOptions`, `ComposeManifestInput`, `ManifestTarget`, `ManifestRepository`, `TsdoctorSources`, `WriteGeneratedOgImageOptions`.

An invalid `tsdoctor.json` source file or a failed image render is recorded in `issues.json` (`DiagnosticEntry.source` gains the `"meta"` literal) and fails the build.
