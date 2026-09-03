---
"@savvy-web/bundler": minor
---

## Features

### `@savvy-web/bundler/og` Open Graph image renderer

New `@savvy-web/bundler/og` subpath export, `ogImage.satori(options?)`, a default 1200×630 Open Graph card renderer for `meta.tsdoctor.openGraph.generate`. It renders the package name, version, and tagline over a themeable palette, ships the Inter SemiBold font (SIL OFL) under `assets/`, and lazily loads the new optional peers `satori` (`^0.33.4`) and `@resvg/resvg-js` (`^2.6.2`) on first render, so a build that never generates an image doesn't need them installed.

```ts
import { defineBuild } from "@savvy-web/bundler";
import { ogImage } from "@savvy-web/bundler/og";

export default defineBuild({
  meta: {
    tsdoctor: {
      tagline: "Every shape",
      openGraph: { generate: ogImage.satori({ accent: "#38bdf8" }) },
    },
  },
});
```

`runBuild` now passes the resolved `targets` into the meta pass so `tsdoctor.json` registries can be derived from `targets.json`; the package's `TsdoctorMetaOptions` and `OgImageInfo` types are re-exported from the package root.
