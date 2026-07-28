---
"@savvy-web/bundler": minor
---

## Features

`@savvy-web/bundler` now ships a `./env` types-only export declaring `__PACKAGE_VERSION__` on `NodeJS.ProcessEnv`, the build-injected constant every consumer already reads at runtime. Previously the key compiled only because `@types/node`'s `ProcessEnv` carries an untyped string index signature, so there was no autocomplete and nothing documenting that the key exists. A consumer pulls the declaration in with a triple-slash reference: `/// <reference types="@savvy-web/bundler/env" />` in a `.d.ts` in their project.
