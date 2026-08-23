/**
 * Guards the externalization contract of silk's built artifacts.
 *
 * @remarks
 * A dependency silk declares but never imports from its OWN source looks
 * unused to every source-level search, and removing it still passes
 * `pnpm build`, `types:check` and the whole test suite. What it silently
 * changes is the BUNDLE: tsdown auto-externalizes from the manifest, so
 * dropping the declaration makes rolldown inline that package's source into
 * the artifacts instead of leaving an `import` for the consumer to resolve.
 *
 * `semver` is the live case. Nothing in `src/` imports it — the importers are
 * the `@changesets/*` packages inside `@savvy-web/silk-effects`' transitive
 * tree, force-bundled into the changelog and markdownlint entries (which must
 * stay CJS-requireable and so cannot externalize ESM-only silk-effects; see
 * the systems#469 determination in savvy.build.ts). Inlining it pulls semver's circular
 * CommonJS modules into the ESM output, which is the documented
 * `require_range is not a function` init-order hazard.
 *
 * These assertions read the built output rather than the manifest, because the
 * manifest is the input to the behavior under test, not evidence of it.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Identifiers that only appear when npm `semver`'s source has been inlined. */
const SEMVER_INTERNALS = [
	"MAX_SAFE_COMPONENT_LENGTH",
	"SEMVER_SPEC_VERSION",
	"comparatorTrimReplace",
	"require_range",
] as const;

/**
 * Collect every emitted JS artifact for a build target, recursively — the
 * bundler emits per-module chunks under subdirectories, so a top-level glob
 * misses most of them.
 */
const collectArtifacts = (dir: string): string[] => {
	let names: string[];
	try {
		names = readdirSync(dir);
	} catch {
		return [];
	}
	const out: string[] = [];
	for (const name of names) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) {
			out.push(...collectArtifacts(full));
		} else if (/\.(js|cjs|mjs)$/.test(name)) {
			out.push(full);
		}
	}
	return out;
};

describe("built artifact externals", () => {
	const targets = ["dist/prod/npm/pkg", "dist/dev/pkg"].map((rel) => ({
		rel,
		files: collectArtifacts(join(PKG_ROOT, rel)),
	}));
	const built = targets.filter((t) => t.files.length > 0);

	it("finds at least one built target to inspect", () => {
		// Guards against the assertions below passing vacuously on an unbuilt tree.
		expect(built.length).toBeGreaterThan(0);
	});

	for (const { rel, files } of built) {
		describe(rel, () => {
			it("does not inline npm semver's source", () => {
				const offenders: string[] = [];
				for (const file of files) {
					const content = readFileSync(file, "utf-8");
					const hit = SEMVER_INTERNALS.find((id) => content.includes(id));
					if (hit) {
						offenders.push(`${file.slice(PKG_ROOT.length + 1)} (${hit})`);
					}
				}

				// If this fails, `semver` was dropped from package.json dependencies or
				// from the manifest keep-list in savvy.build.ts. It must stay in both.
				expect(offenders).toEqual([]);
			});

			it("keeps the search honest with a control identifier that IS present", () => {
				// Proves the scan would actually find inlined source if it were there —
				// without this, an empty offenders list could mean "clean" or "looked in
				// the wrong place", and those are not the same result.
				const anyEffectUsage = files.some((file) => readFileSync(file, "utf-8").includes("effect"));
				expect(anyEffectUsage).toBe(true);
			});
		});
	}
});

describe("published manifest covers silk-effects' required peers", () => {
	// silk externalizes @savvy-web/silk-effects and re-adds it to the published
	// manifest, so a consumer installing silk resolves silk-effects transitively
	// and inherits its REQUIRED peers. Nothing else in the published graph names
	// them, so if silk does not carry them the peers go unsatisfied: silently
	// duplicated under pnpm's autoInstallPeers, ERR_MODULE_NOT_FOUND under yarn
	// or with autoInstallPeers off.
	//
	// Two sites have to agree for that to work — silk's `dependencies` AND the
	// `kept` allowlist in savvy.build.ts, which filters the published manifest
	// down. Adding to one alone is a no-op, which is how this shipped unnoticed.
	// These assertions read the BUILT manifest, so they fail if either site drifts.
	const builtManifest = join(PKG_ROOT, "dist/dev/pkg/package.json");
	const effectsManifest = join(PKG_ROOT, "../silk-effects/package.json");

	const requiredPeers = Object.keys(
		(JSON.parse(readFileSync(effectsManifest, "utf-8")) as { peerDependencies?: Record<string, string> })
			.peerDependencies ?? {},
	);
	const published =
		(JSON.parse(readFileSync(builtManifest, "utf-8")) as { dependencies?: Record<string, string> }).dependencies ?? {};

	it("declares every peer silk-effects requires", () => {
		const missing = requiredPeers.filter((name) => published[name] === undefined);
		expect(missing).toEqual([]);
	});

	it("keeps the check honest — silk-effects itself is a published dependency", () => {
		// The premise of the test above: silk really does ship silk-effects as a
		// runtime dependency. If this ever stops being true the peers stop being
		// inherited, and an empty `missing` list above would mean "nothing to
		// cover" rather than "everything covered".
		expect(published["@savvy-web/silk-effects"]).toBeDefined();
		expect(requiredPeers.length).toBeGreaterThan(0);
	});
});
