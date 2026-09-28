---
"@savvy-web/silk-effects": patch
---

## Bug Fixes

* `VersionOrEmptySchema`, `CommitHashSchema`, `UsernameSchema`, `RepoSchema`, `JsonPathSchema` and `RepoName` keep their regex as `pattern` when converted with `Schema.toJsonSchemaDocument`. Since effect `4.0.0-rc.118`, a `Schema.isPattern` check only exports its pattern when the RegExp carries the `u` flag; without it the exported JSON Schema silently accepted any string. The regexes now carry `u`, and decoding accepts exactly the same strings as before.
