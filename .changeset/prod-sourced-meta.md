---
"@savvy-web/bundler": minor
"@savvy-web/tsdown-plugins": minor
---

## Features

Generate the API Extractor meta bundle from the production build instead of the
development build, so the package manifest copied into the configured local
paths carries fully resolved dependency versions. Previously the meta manifest
came from the dev output and kept unresolved workspace and catalog protocol
specifiers, which left documentation tooling such as Twoslash and the MCP API
doc pipeline unable to wire in dependency types. The production target now emits
a meta bundle for every publish group and copies the canonical group's bundle
into the configured local paths.

Add an optimistic meta option that forward-looks the meta manifest. When enabled
it rewrites the bundle's own version and any workspace sibling dependency
version to the next release version computed from pending changesets, so a local
build's meta bundle matches the state of the next release. The option is auto by
default, which resolves to off in CI and on locally, and can be set explicitly.
The rewrite affects the meta bundle only and never the published package
manifest. The tsdown-plugins package gains the supporting building blocks: a
next-version resolver over the changeset release plan, a pure version-rewrite
transform, a manifest transform hook on the meta generator, and the optimistic
field on the meta options.

The standalone meta build target is soft-deprecated. It now warns and performs
no work, because meta is emitted as part of the production build. The target
flag, its turbo task, and the per-package scripts remain in place for now and
will be removed in a later change.
