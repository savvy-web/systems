// packages/tsdown-plugins/src/manifest/emit-manifest.ts
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Plugin } from "rolldown";
import type { ManifestLike } from "../catalog/resolve-catalogs.js";
import { resolveManifest } from "../catalog/resolve-catalogs.js";
import type { Json } from "./transform.js";
import { transformManifest } from "./transform.js";

export interface TargetGroupRef {
	readonly id: string; // "dev" | "npm" | ...
	readonly isProd: boolean;
}

export interface BuildEmittedManifestOptions {
	readonly pkg: Json;
	readonly targetGroup: TargetGroupRef;
	readonly devManifest: "preserve" | "resolve";
	readonly transform?: ((args: { pkg: Json; targetGroup: TargetGroupRef }) => Json) | undefined;
}

/** Compute the final manifest bytes for a TargetGroup (catalog resolution + standard transforms). */
export async function buildEmittedManifest(options: BuildEmittedManifestOptions): Promise<Json> {
	const { pkg, targetGroup, devManifest, transform } = options;
	const shouldResolve = targetGroup.isProd || devManifest === "resolve";
	let base: Json = pkg;
	if (shouldResolve) {
		// resolveManifest delegates to workspaces-effect's CatalogResolver (returns a Promise)
		// and discovers the workspace from process.cwd(). ManifestLike and Json are
		// structurally compatible records, so the casts are safe at this boundary.
		base = (await resolveManifest(pkg as unknown as ManifestLike)) as unknown as Json;
	}
	return transformManifest(base, {
		transform: transform ? (p) => transform({ pkg: p, targetGroup }) : undefined,
	});
}

export interface EmitManifestOptions {
	readonly targetGroup: TargetGroupRef;
	readonly devManifest?: "preserve" | "resolve" | undefined;
	readonly transform?: ((args: { pkg: Json; targetGroup: TargetGroupRef }) => Json) | undefined;
	/** Source package dir to read package.json/LICENSE/README from. */
	readonly sourceDir: string;
}

/** Rolldown plugin: emit the transformed package.json + LICENSE/README into the output pkg/ root. */
export function emitManifest(options: EmitManifestOptions): Plugin {
	const sourceDir = options.sourceDir;
	return {
		name: "savvy:emit-manifest",
		async generateBundle() {
			const pkg = JSON.parse(await readFile(join(sourceDir, "package.json"), "utf-8")) as Json;
			const manifest = await buildEmittedManifest({
				pkg,
				targetGroup: options.targetGroup,
				devManifest: options.devManifest ?? "preserve",
				transform: options.transform,
			});
			this.emitFile({
				type: "asset",
				fileName: "package.json",
				source: `${JSON.stringify(manifest, null, "\t")}\n`,
			});
			for (const name of ["LICENSE", "README.md"]) {
				try {
					const content = await readFile(join(sourceDir, name), "utf-8");
					this.emitFile({ type: "asset", fileName: name, source: content });
				} catch {
					// optional file absent — skip
				}
			}
		},
	};
}
