import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { WorkspaceDiscovery, Workspaces } from "@effected/workspaces";
import type { ManifestSource } from "@tsdoctor/manifest";
import { TSDOCTOR_MANIFEST_FILENAME, decodeManifestSource } from "@tsdoctor/manifest";
import { Data, Effect, Layer } from "effect";

/**
 * A present `tsdoctor.json` source file that could not be parsed or decoded. Absence is never
 * this error — a missing source tier is the normal case.
 *
 * @public
 */
export class TsdoctorSourceError extends Data.TaggedError("TsdoctorSourceError")<{
	readonly path: string;
	readonly cause: unknown;
}> {
	get message(): string {
		return `Invalid ${TSDOCTOR_MANIFEST_FILENAME} at ${this.path}`;
	}
}

/**
 * The two source tiers a build reads: the package's own file and the workspace root's.
 *
 * @public
 */
export interface TsdoctorSources {
	readonly leaf: ManifestSource | undefined;
	readonly project: ManifestSource | undefined;
}

/** Bound once: the platform layer is stateless and layers memoize by reference. */
const platform = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

/** The canonical absolute form of a directory, so a relative or symlinked `cwd` compares equal to the discovered root. */
function canonical(dir: string): string {
	const absolute = resolve(dir);
	try {
		return realpathSync(absolute);
	} catch {
		return absolute;
	}
}

/**
 * The workspace root containing `cwd`, or `undefined` when `cwd` is not inside any workspace.
 * Mirrors the `WorkspaceDiscovery` invocation in `changesets/next-versions.ts`.
 */
async function findWorkspaceRoot(cwd: string): Promise<string | undefined> {
	try {
		const packages = await Effect.runPromise(
			Effect.gen(function* () {
				const discovery = yield* WorkspaceDiscovery;
				return yield* discovery.listPackages();
			}).pipe(Effect.provide(Workspaces.layer({ cwd }).pipe(Layer.provide(platform)))),
		);
		// listPackages is root-first; the root package's path is the workspace root.
		return packages[0]?.isRootWorkspace ? packages[0].path : undefined;
	} catch {
		return undefined;
	}
}

async function readSource(path: string): Promise<ManifestSource | undefined> {
	if (!existsSync(path)) return undefined;
	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(path, "utf-8"));
	} catch (cause) {
		throw new TsdoctorSourceError({ path, cause });
	}
	const result = await Effect.runPromise(Effect.result(decodeManifestSource(parsed, path)));
	if (result._tag === "Failure") throw new TsdoctorSourceError({ path, cause: result.failure });
	return result.success;
}

/**
 * Read the leaf (`<cwd>/tsdoctor.json`) and project (`<workspaceRoot>/tsdoctor.json`)
 * source tiers. Absence is normal; a present file that does not decode throws
 * {@link TsdoctorSourceError}. A package that IS the workspace root reads its file once, as the
 * leaf, and has no project tier.
 *
 * @public
 */
export async function loadTsdoctorSources(cwd: string): Promise<TsdoctorSources> {
	const leafDir = canonical(cwd);
	const leaf = await readSource(join(leafDir, TSDOCTOR_MANIFEST_FILENAME));
	const root = await findWorkspaceRoot(leafDir);
	const project =
		root !== undefined && canonical(root) !== leafDir
			? await readSource(join(root, TSDOCTOR_MANIFEST_FILENAME))
			: undefined;
	return { leaf, project };
}
