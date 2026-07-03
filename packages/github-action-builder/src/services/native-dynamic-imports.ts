/**
 * Helpers for the `build.nativeDynamicImports` option: building the rspack
 * module-rule `test` pattern that matches a package's resolved module path
 * under `node_modules`, and the module rules themselves.
 *
 * @remarks
 * See {@link ../schemas/config.js#BuildOptionsSchema} for the option this
 * supports, and `webpack-ignore-dynamic-imports.cjs` (shipped from
 * `public/loaders/`, see `package.json` `exports`) for the loader these
 * rules point at.
 *
 * @internal
 */

/**
 * Escape a string for literal use inside a `RegExp`, and turn every `/` into
 * a `[\/]` alternation so the result matches both POSIX and Windows path
 * separators.
 *
 * @remarks
 * Order matters: the regex-metacharacter escape runs first (it never
 * touches `/`, which is not a regex metacharacter), then `/` is expanded to
 * `[\/]` afterward — a scoped package name like `@changesets/apply-release-plan`
 * has a literal `/` that must become a path-separator alternation, not stay
 * a bare `/`.
 */
function escapePathSegment(value: string): string {
	const regexEscaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return regexEscaped.replace(/\//g, "[\\/]");
}

/**
 * Build a `RegExp` matching a package's resolved absolute module path under
 * `node_modules`, in both the flat layout (`node_modules/<name>/`) and the
 * pnpm layout (`node_modules/.pnpm/<name>@x.y.z/node_modules/<name>/`).
 *
 * @param packageName - The npm package name to match, as configured in
 * `build.nativeDynamicImports` (e.g. `"@changesets/apply-release-plan"` or
 * `"some-unscoped-pkg"`).
 * @returns A `RegExp` suitable for an rspack module rule's `test`.
 *
 * @internal
 */
export function buildNativeDynamicImportPathPattern(packageName: string): RegExp {
	const escapedName = escapePathSegment(packageName);
	return new RegExp(`[\\/]node_modules[\\/](\\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?${escapedName}[\\/]`);
}

/**
 * An rspack `module.rules` entry: matches a resource path and applies a
 * loader. Kept minimal and structural rather than importing rspack's own
 * (much larger) `RuleSetRule` type, since only `test` and `use` are needed
 * here.
 *
 * @internal
 */
export interface NativeDynamicImportModuleRule {
	test: RegExp;
	use: Array<{ loader: string }>;
}

/**
 * Build the rspack `module.rules` entries for `build.nativeDynamicImports`:
 * one rule per configured package name, each pointing at the
 * `webpackIgnore`-injecting loader.
 *
 * @param packageNames - Package names configured in `build.nativeDynamicImports`.
 * @param loaderPath - Absolute, resolved path to `webpack-ignore-dynamic-imports.cjs`.
 * @returns One module rule per package name. Empty when `packageNames` is empty.
 *
 * @internal
 */
export function buildNativeDynamicImportRules(
	packageNames: readonly string[],
	loaderPath: string,
): NativeDynamicImportModuleRule[] {
	return packageNames.map((packageName) => ({
		test: buildNativeDynamicImportPathPattern(packageName),
		use: [{ loader: loaderPath }],
	}));
}
