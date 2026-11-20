---
"@savvy-web/cli": patch
---

## Bug Fixes

`savvy init` no longer rewrites `.changeset/config.json` when the file already holds the changelog entry init would write, so a repeat run leaves the working tree clean. When it does patch the changelog, it edits that key in place, and every other value keeps its layout instead of being re-serialized with expanded arrays. The `.changeset/.markdownlint.json` and base markdownlint steps likewise skip the write and report "up to date" when nothing is missing.
