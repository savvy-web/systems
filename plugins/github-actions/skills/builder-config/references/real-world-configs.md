# Real-world action.config.ts files

> Verbatim configs (comments included — they are the institutional knowledge)
> from production actions built on @savvy-web/github-action-builder@2.0.4,
> captured 2026-07-23 with action-specific identifiers neutralized. On version
> skew the installed source wins — re-verify before relying on this.

Complexity ladder: starting point → minimal → three-phase → advanced.

## github-action-template — the starting point

```typescript
import { defineConfig } from "@savvy-web/github-action-builder";

export default defineConfig({
 entries: {
  pre: "src/pre.ts",
  main: "src/main.ts",
  post: "src/post.ts",
 },
 build: {
  minify: true,
 },
 persistLocal: {
  enabled: true,
  path: ".github/actions/local",
 },
});
```

## Minimal single-entry action (main only, persistLocal off)

```typescript
import { defineConfig } from "@savvy-web/github-action-builder";

export default defineConfig({
 entries: {
  main: "src/main.ts",
 },
 build: {
  minify: true,
  ignore: ["xmlbuilder2", "libxmljs2", "ajv-formats-draft2019"],
 },
 persistLocal: {
  enabled: false,
  path: ".github/actions/local",
 },
});
```

## Three-phase action with the canonical ignore comment

```typescript
import { defineConfig } from "@savvy-web/github-action-builder";

export default defineConfig({
 entries: {
  pre: "src/pre.ts",
  main: "src/main.ts",
  post: "src/post.ts",
 },
 build: {
  minify: true,
  // `@cyclonedx/cyclonedx-library` (pulled in transitively by
  // `@savvy-web/github-action-effects`) ships optional plugins — XML
  // serializers/validators and draft-2019 JSON validators — that this
  // action never invokes. They aren't installed and would never be
  // present in the deployed action, so `ignore` (alias to a throwing
  // stub) is correct here, not `externals` (which means "available at
  // runtime"). cyclonedx's `_optPlug` wrapper try/catches the stub throw
  // and falls through gracefully.
  ignore: ["xmlbuilder2", "libxmljs2", "ajv-formats-draft2019"],
 },
 persistLocal: {
  enabled: true,
  path: ".github/actions/local",
 },
});
```

## Advanced: workers + nativeDynamicImports + the do-not-add rule

```typescript
import { defineConfig } from "@savvy-web/github-action-builder";

export default defineConfig({
 entries: {
  pre: "src/pre.ts",
  main: "src/main.ts",
  post: "src/post.ts",
  workers: {
   "changelog-custom": "src/changelog/custom.ts",
   "changelog-default": "src/changelog/default.ts",
  },
 },
 build: {
  minify: true,
  // The changesets engine resolves the changelog module path at runtime and
  // dynamic-imports it; without this, rspack compiles that import into a
  // context module that throws "Cannot find module" for on-disk paths.
  // NOTE: do NOT add "@effected/workspaces" here. Its `ConfigDependencyHooks`
  // has a computed `import(candidateUrl)` that rspack flags "Critical
  // dependency: the request of a dependency is an expression." That warning is
  // benign — a structure-reading action never runs the config-dependency-hooks
  // path — and the builder's ignore-loader throws (`hasTraversalSegment`) on
  // that file, failing the whole build if it is listed here.
  nativeDynamicImports: ["@changesets/apply-release-plan"],
  // `@cyclonedx/cyclonedx-library` ships optional plugins (XML
  // serializers, XML validators, draft-2019 JSON validators) we
  // never invoke — we only use the JSON serializer. They aren't
  // installed and would never be present in the deployed action,
  // so `ignore` (alias to a throwing stub) is correct here, not
  // `externals` (which means "available at runtime"). cyclonedx's
  // `_optPlug` wrapper try/catches the stub throw and falls
  // through gracefully.
  ignore: ["xmlbuilder2", "libxmljs2", "ajv-formats-draft2019"],
 },
 persistLocal: {
  enabled: true,
  path: ".github/actions/local",
 },
});
```

## All three dynamic-import cases in one file

The longest comment block of the set, and worth reading in full: it documents
(1) the third-party `nativeDynamicImports` case, (2) the deliberately-NOT-listed
`@effected/workspaces` case, and (3) the first-party inline
`/* webpackIgnore: true */` case with its built-artifact guard.

```typescript
import { defineConfig } from "@savvy-web/github-action-builder";

export default defineConfig({
 entries: {
  pre: "src/pre.ts",
  main: "src/main.ts",
  post: "src/post.ts",
 },
 build: {
  minify: true,
  // `@cyclonedx/cyclonedx-library` (pulled in transitively by
  // `@savvy-web/github-action-effects`) ships optional plugins — XML
  // serializers/validators and draft-2019 JSON validators — that this
  // action never invokes. They aren't installed and would never be
  // present in the deployed action, so `ignore` (alias to a throwing
  // stub) is correct here, not `externals` (which means "available at
  // runtime"). cyclonedx's `_optPlug` wrapper try/catches the stub throw
  // and falls through gracefully.
  ignore: ["xmlbuilder2", "libxmljs2", "ajv-formats-draft2019"],
  // Packages that perform a fully dynamic `await import(expr)` at
  // runtime. Without this, rspack compiles the import into a context
  // module and the action throws `Cannot find module 'file:///…'` in
  // production even though the file exists.
  // `@changesets/apply-release-plan` loads the configured changelog
  // module this way (via the changesets v3 engine).
  // `@effected/workspaces`'s ConfigDependencyHooks loader has the same
  // computed `import(candidateUrl)` pattern and IS reachable in this bundle,
  // so rspack emits a "Critical dependency" warning and compiles it into a
  // context module. It is deliberately NOT listed here: registering it makes
  // the builder's webpack-ignore loader throw on that file
  // (`hasTraversalSegment`) and fails the whole build. The warning is inert
  // unless the config-dependency-hooks path is actually invoked at runtime —
  // this action only reads workspace/lockfile structure; it does not load
  // pnpmfile config-dependency hooks. If your bundle can reach that path at
  // runtime, confirm before shipping; the durable fix is upstream
  // (@effected/workspaces webpackIgnore-ing its own loader, or the builder's
  // ignore loader tolerating it).
  //
  // A third, different case: a first-party module dynamically imports an
  // extracted tarball entry — a path computed at runtime from a temp
  // directory, not a package specifier. This option's rule-building only
  // matches resolved paths under `node_modules/<name>/` (see
  // `src/services/native-dynamic-imports.ts` in the builder), so it
  // structurally cannot target first-party source under `src/`. That call
  // site instead carries its own inline `/* webpackIgnore: true */` magic
  // comment ahead of the `import(...)` call — the same fix this loader
  // injects for the packages listed above, just written directly since
  // there's no third-party module path to match against here. The call site
  // is reachable from `dist/main.js`, and because a context-module rewrite
  // only fails in production — vitest runs the source, not the bundle —
  // `build:prod` runs `scripts/assert-native-dynamic-import.mjs` after
  // every build, asserting the built `dist/main.js` still holds a genuine
  // `await import(<ident>)` at that call site and not a numbered context
  // module. Deleting the magic comment fails the build.
  nativeDynamicImports: ["@changesets/apply-release-plan"],
 },
 persistLocal: {
  enabled: false,
  path: ".github/actions/local",
 },
});
```

When using an inline `webpackIgnore`, chain the guard into the build script:
`"build:prod": "github-action-builder build && node scripts/assert-native-dynamic-import.mjs"`.
