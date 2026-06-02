/**
 * The in-monorepo packages whose API Extractor models are rendered into the
 * resource corpus. Pure data so it is importable by tests and the generator.
 *
 * @internal
 */

export interface ApiTarget {
	/** Published package name, used in import examples. */
	readonly packageName: string;
	/** Directory under `packages/` (and the URI slug under `packages/<dir>/api`). */
	readonly dir: string;
	/** The emitted model filename = `<unscopedPackageName>.api.json`. */
	readonly modelBasename: string;
	/** The corpus id prefix, e.g. "packages/silk-effects". */
	readonly idPrefix: string;
}

const target = (dir: string, unscoped: string): ApiTarget => ({
	packageName: `@savvy-web/${dir}`,
	dir,
	modelBasename: `${unscoped}.api.json`,
	idPrefix: `packages/${dir}`,
});

// Library packages only. Deliberately excludes:
//   - silk: not a library (config-integration shims; no API to document).
//   - cli:  not a library (a binary; no API an agent would import).
//   - mcp:  cannot document itself — its generated docs feed build:catalog →
//           build:dev, so a generate→mcp#build dependency would be a turbo cycle.
// Keeping silk/mcp out means mcp's build subgraph references neither, so the
// pipeline stays acyclic even if silk later depends on mcp.
export const API_TARGETS: ReadonlyArray<ApiTarget> = [
	target("silk-effects", "silk-effects"),
	target("templates", "templates"),
	target("github-action-effects", "github-action-effects"),
	target("github-action-builder", "github-action-builder"),
];
