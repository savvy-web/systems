/**
 * The tool closure is sealed: what a released `savvy` / `savvy-mcp` runs is
 * exactly what it was tested with, whatever the kit or Effect publishes later.
 *
 * - The tools (silk, the carrier, and the cli/mcp/changelog it pins) take every
 *   `effect` / `@effect/*` / `@effected/*` dependency through
 *   `catalog:effected:exact`, which publishes a plain version. `catalog:effected`
 *   publishes the catalog's caret, which lets a kit patch reach an installed tool
 *   with no tool release.
 * - The engine (silk-effects and silk-core under it) does the same for its
 *   regular kit dependencies, which resolve privately inside the tool. Its peers
 *   stay ranges: the silk actions import silk-effects as a library, and an exact
 *   peer would force them onto duplicate tags.
 * - Every in-repo edge inside the closure is `workspace:*`, so a released tool
 *   pins the exact engine it shipped with.
 * - Every kit peer anywhere in a tool's installed closure is declared as a
 *   dependency by some ancestor on the path to it, so no kit peer is left to
 *   auto-install by its own caret.
 *
 * See the effected `design-patterns` skill's carrier-closure reference.
 */

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const TOOLS = ["silk", "cli", "mcp", "changelog"] as const;
const ENGINE = ["silk-effects", "silk-core"] as const;

const KIT = /^(effect$|@effect\/|@effected\/)/;
const INTERNAL = /^@savvy-web\//;
const EXACT = "catalog:effected:exact";
const PEERS = "catalog:effected:peers";

interface Manifest {
	readonly name: string;
	readonly dependencies?: Record<string, string>;
	readonly peerDependencies?: Record<string, string>;
}

interface Offender {
	readonly pkg: string;
	readonly dep: string;
	readonly spec: string;
}

const readManifest = (dir: string): Manifest => JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Manifest;
const sourceManifest = (pkg: string): Manifest => readManifest(join(REPO_ROOT, "packages", pkg));

/** Dependencies matching `match` whose specifier is not `want`, plus how many were checked. */
const checkSpecs = (
	manifests: ReadonlyArray<Manifest>,
	match: RegExp,
	want: string,
	field: "dependencies" | "peerDependencies",
) => {
	const offenders: Array<Offender> = [];
	let checked = 0;
	for (const manifest of manifests) {
		for (const [dep, spec] of Object.entries(manifest[field] ?? {})) {
			if (!match.test(dep)) continue;
			checked++;
			if (spec !== want) offenders.push({ pkg: manifest.name, dep, spec });
		}
	}
	return { offenders, checked };
};

/** The installed directory `name` resolves to from `from`, walking up node_modules as Node does. */
const findInstalled = (from: string, name: string): string | undefined => {
	let dir = from;
	for (;;) {
		const candidate = join(dir, "node_modules", name);
		if (existsSync(join(candidate, "package.json"))) return realpathSync(candidate);
		const up = dirname(dir);
		if (up === dir) return undefined;
		dir = up;
	}
};

/**
 * Kit peers in the installed closure of `root` that no ancestor on the path to
 * the package requiring them declares as a dependency.
 */
const unsealedPeers = (root: string): ReadonlyArray<string> => {
	const gaps = new Set<string>();
	const visit = (dir: string, chain: ReadonlyArray<Manifest>): void => {
		const manifest = readManifest(dir);
		for (const peer of Object.keys(manifest.peerDependencies ?? {})) {
			if (KIT.test(peer) && !chain.some((ancestor) => ancestor.dependencies?.[peer] !== undefined)) {
				gaps.add(`${peer} via ${[...chain.map((ancestor) => ancestor.name), manifest.name].join(" > ")}`);
			}
		}
		for (const dep of Object.keys(manifest.dependencies ?? {})) {
			if (!KIT.test(dep) && !INTERNAL.test(dep)) continue;
			const next = findInstalled(dir, dep);
			if (next === undefined) continue;
			const nextName = readManifest(next).name;
			if (nextName === manifest.name || chain.some((ancestor) => ancestor.name === nextName)) continue;
			visit(next, [...chain, manifest]);
		}
	};
	visit(realpathSync(root), []);
	return [...gaps].sort();
};

describe("tool closure", () => {
	const tools = TOOLS.map(sourceManifest);
	const engine = ENGINE.map(sourceManifest);

	it("every kit dependency of a tool or engine package is written catalog:effected:exact", () => {
		const { offenders, checked } = checkSpecs([...tools, ...engine], KIT, EXACT, "dependencies");
		expect(offenders).toEqual([]);
		expect(checked).toBeGreaterThan(40);
	});

	it("every in-repo dependency inside the closure is workspace:*", () => {
		const { offenders, checked } = checkSpecs([...tools, ...engine], INTERNAL, "workspace:*", "dependencies");
		expect(offenders).toEqual([]);
		expect(checked).toBeGreaterThanOrEqual(8);
	});

	it("the engine's kit peers stay catalog:effected:peers ranges, so library consumers dedupe", () => {
		const { offenders, checked } = checkSpecs(engine, KIT, PEERS, "peerDependencies");
		expect(offenders).toEqual([]);
		expect(checked).toBeGreaterThan(5);
	});

	it.each(TOOLS)("every kit peer in %s's installed closure is declared by an ancestor", (pkg) => {
		expect(unsealedPeers(join(REPO_ROOT, "packages", pkg))).toEqual([]);
	});

	it("positive control: a caret catalog, a workspace caret and an exact peer are all reported", () => {
		const fake: Manifest = {
			name: "@savvy-web/fake",
			dependencies: { "@effected/glob": "catalog:effected", "@savvy-web/silk-core": "workspace:^" },
			peerDependencies: { effect: EXACT },
		};
		expect(checkSpecs([fake], KIT, EXACT, "dependencies").offenders).toHaveLength(1);
		expect(checkSpecs([fake], INTERNAL, "workspace:*", "dependencies").offenders).toHaveLength(1);
		expect(checkSpecs([fake], KIT, PEERS, "peerDependencies").offenders).toHaveLength(1);
	});
});
