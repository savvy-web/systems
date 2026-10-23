---
"@savvy-web/bundler": minor
---

## Features

* `runBuild` now records a warning (source `config`, code `targets-no-final-release`) when every prod publish target is `releases: "prerelease"`, since final versions would then publish nowhere. The build still succeeds; the warning appears in the build report.
