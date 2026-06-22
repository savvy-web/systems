---
"@savvy-web/tsdown-plugins": minor
"@savvy-web/bundler": minor
---

## Features

The self-hosting build libraries now generate their own API model on the prod build. The meta-generation orchestration is unified into a single runMetaPass, exported from @savvy-web/tsdown-plugins and used by both the front-door runBuild and the two escape-hatch self-host builds. @savvy-web/bundler and @savvy-web/tsdown-plugins now emit a dist/prod/issues.json, are API Extractor validated, and publish their API model into the documentation corpus.

## Breaking Changes

generateBuildReportSchema is no longer exported from @savvy-web/tsdown-plugins. Its Effect signature pulled @effect/platform's FileSystem type (a devDependency) into the published declarations, and the function is internal build tooling with no package-level consumer. If you need it, import it from its source module and provide the FileSystem layer yourself.
