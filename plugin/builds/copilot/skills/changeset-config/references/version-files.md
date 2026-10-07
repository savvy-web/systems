# versionFiles

`packages[name].versionFiles` is `Array<{ glob, paths }>` inside the changelog options object. It lets `changeset version` update version fields in files beyond `package.json`.

- `glob` — a repo-relative, non-empty glob pattern. It must match JSON or JSONC files.
- `paths` — an array of JSONPath expressions, each prefixed with `$.` (default `["$.version"]`). Each matched path is rewritten to the **owning package's** new version — the package whose record key holds this `versionFiles` entry, not any value inferred from the file itself.

During `changeset version`, every file matched by `glob` gets every JSONPath in `paths` rewritten in place. Edits are format-preserving: comments, inline arrays, and existing formatting in the target file survive untouched — only the matched value changes.

## Worked example

```jsonc
"packages": {
  "@savvy-web/silk": {
    "versionFiles": [{ "glob": "plugins/*/.claude-plugin/plugin.json", "paths": ["$.version"] }]
  }
}
```

Every file matched by `plugins/*/.claude-plugin/plugin.json` gets its `$.version` field bumped in lockstep with `@savvy-web/silk`'s own version — so each plugin manifest under `plugins/*/.claude-plugin/plugin.json` always reports the same version as the package that owns it.

## Legacy form, migration, and mutual exclusion

An older, deprecated shape is still accepted: a flat top-level `versionFiles` array, where each entry carries its own inline `package` field naming the owner.

```jsonc
{
  "changelog": [
    "@savvy-web/changelog",
    {
      "repo": "owner/repo",
      "versionFiles": [
        { "glob": "plugins/*/.claude-plugin/plugin.json", "paths": ["$.version"], "package": "@scope/pkg" }
      ]
    }
  ]
}
```

This legacy form normalizes into `packages[name].versionFiles` at config-load time, emitting a deprecation warning. An entry in the legacy array that lacks a `package` field is a **hard error** — there is no fallback inference for the owning package.

**Mutual exclusion:** a config cannot declare both the deprecated top-level `versionFiles` array and the `packages` field at the same time. Pick one — migrate every legacy entry into `packages[<name>].versionFiles` and remove the top-level field.
