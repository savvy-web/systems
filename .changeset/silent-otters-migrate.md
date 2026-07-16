---
"@savvy-web/tsdown-plugins": major
---

## Breaking Changes

### Effect v4

The package's entire Effect surface moves from v3 to v4 (`effect@4.0.0-beta.98`). Every exported service tag (`ConfigValidator`, `EnvironmentDetector`, `ExecutorResolver`, `FormatSelector`, `OutputRenderer`, `BuildCollectorTag`), layer, `Effect`, `Schema` class, and tagged error is now a v4 value — v3 consumers cannot compose them into an existing v3 Effect program. `Schema.Class` instances also now validate on construction, so passing an explicit `undefined` for an optional field throws where v3 silently accepted it.

Consumers on `catalog:silk` (Effect v3) need to migrate to `catalog:effect` (v4) before upgrading.

### Catalog and manifest errors renamed and restructured

`CatalogResolutionError` is removed. `resolveManifest()` now rejects with one of four typed errors re-exported from `@effected/npm`:

```ts
import { resolveManifest, UnresolvedDependencyError, ManifestDecodeError } from "@savvy-web/tsdown-plugins";

try {
	await resolveManifest(pkg);
} catch (error) {
	if (error instanceof UnresolvedDependencyError) {
		// error.field, error.dependency, error.specifier, error.reason
		// reason: "catalog-entry-missing" | "workspace-package-missing"
	}
	if (error instanceof ManifestDecodeError) {
		// a dependency field wasn't a string-to-string record
	}
}
```

* `UnresolvedDependencyError` replaces `CatalogResolutionError`, with a different `_tag` and a different field shape (`field`, `dependency`, `specifier`, `reason`).
* `CatalogAssemblyError` is now the `@effected/npm` re-export — same `_tag`, but its fields changed (`source: "manifest" | "catalog" | "hooks"`, `path`, `cause`), so cross-package `instanceof` checks against the old class break.
* `ManifestDecodeError` and `DependencyResolutionError` are new exports. `resolveManifest`'s full rejection set is now these four errors.

### Dependency graph

The sealed v3 peer closure (`@effect/cluster`, `@effect/experimental`, `@effect/platform`, `@effect/rpc`, `@effect/sql`, `@effect/workflow`) is removed — v4's closure is just `effect`. `workspaces-effect`, `json-schema-effect`, and `@manypkg/get-packages` are replaced by `@effected/workspaces`, `@effected/npm`, and `@effected/tsconfig-json`. `typescript` stays pinned at `^6.0.3` (still used for dts AST work and api-extractor).

## Bug Fixes

* `resolveManifest` on a malformed dependency field (a non-record field, or a non-string specifier) now rejects with a typed `ManifestDecodeError` instead of an untyped defect.
* `workspace:<alias>@<range>` specifiers now project to the correct `npm:<alias>@<projected>` publish form — previously this alias form passed through unresolved.
* `readTsconfigJsx`/`resolveJsxConfig` now honor JSONC syntax and `extends` chains, so a `jsx` setting inherited from a base tsconfig resolves instead of being missed.
* The portable-tsconfig allow-list used by `resolvePortableTsconfig` is now a superset of the previous one — options like `allowJs`/`experimentalDecorators` survive when set. `newLine` is no longer emitted, and malformed configs now fail through typed decoding with strict enum literals instead of a looser TypeScript-API pass-through.
