---
"@savvy-web/mcp": patch
---

## Features

The MCP corpus now includes API documentation for `@savvy-web/bundler`, `@savvy-web/tsdown-plugins`, and `@savvy-web/rspress-builder`. These three packages are generated into the corpus on prod build alongside silk-effects, templates, and the GitHub Action packages. The `silk_docs_search` tool can now answer questions about the bundler API (`defineBuild`, `runBuild`, `RunOptions`), tsdown-plugins exports (`runMetaPass`, `writeIssuesArtifact`, and all plugin functions), and rspress-builder options.
