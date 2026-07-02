/**
 * Tests for {@link listPublishablePackageNames}.
 *
 * The function delegates to whatever {@link PublishabilityDetector} layer is
 * provided: a package is "publishable" when the detector returns at least one
 * {@link PublishTarget} for it. A mock detector layer keyed off package name
 * drives the behavior so the test stays focused on the name-collection logic
 * (filtering, dedup-by-Set) without touching the filesystem. The mock also
 * records every `root` it was called with, so the "same root for every
 * package" contract (root is the project root, not `pkg.path`) is asserted
 * rather than just assumed.
 */

import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import type { PublishTarget, WorkspacePackage } from "workspaces-effect";
import { PublishabilityDetector } from "workspaces-effect";

import { listPublishablePackageNames } from "../../src/changesets/utils/publishability.js";

const PROJECT_ROOT = "/repo";

const pkg = (name: string): WorkspacePackage => ({ name, path: `/repo/${name}` }) as unknown as WorkspacePackage;

const target = (): PublishTarget =>
	({
		name: "npm",
		registry: "https://registry.npmjs.org/",
		directory: "dist",
		access: "public",
		provenance: false,
	}) as unknown as PublishTarget;

/**
 * Build a mock detector layer that returns one target for every package whose
 * name is in `publishable`, and an empty array otherwise. Every `root` it is
 * called with is pushed onto `rootsSeen`.
 */
const mockDetector = (
	publishable: ReadonlySet<string>,
	rootsSeen: string[] = [],
): Layer.Layer<PublishabilityDetector> =>
	Layer.succeed(PublishabilityDetector, {
		detect: (p: WorkspacePackage, root: string) => {
			rootsSeen.push(root);
			return Effect.succeed(publishable.has(p.name) ? [target()] : []);
		},
	} as unknown as PublishabilityDetector["Type"]);

const run = (
	packages: ReadonlyArray<WorkspacePackage>,
	publishable: ReadonlySet<string>,
	root: string = PROJECT_ROOT,
): Promise<ReadonlySet<string>> =>
	Effect.runPromise(listPublishablePackageNames(packages, root).pipe(Effect.provide(mockDetector(publishable))));

describe("listPublishablePackageNames", () => {
	it("returns only the names the detector reports as publishable", async () => {
		const packages = [pkg("@scope/foo"), pkg("@scope/bar"), pkg("root")];
		const result = await run(packages, new Set(["@scope/foo", "@scope/bar"]));

		expect(result).toEqual(new Set(["@scope/foo", "@scope/bar"]));
		expect(result.has("root")).toBe(false);
	});

	it("returns an empty set when no package is publishable", async () => {
		const packages = [pkg("@scope/foo"), pkg("root")];
		const result = await run(packages, new Set());

		expect(result.size).toBe(0);
	});

	it("returns an empty set for an empty package list", async () => {
		const result = await run([], new Set(["@scope/foo"]));

		expect(result.size).toBe(0);
	});

	it("includes every package when all are publishable", async () => {
		const packages = [pkg("@scope/a"), pkg("@scope/b")];
		const result = await run(packages, new Set(["@scope/a", "@scope/b"]));

		expect(result).toEqual(new Set(["@scope/a", "@scope/b"]));
	});

	it("passes the SAME project root to the detector for every package — not each package's own path", async () => {
		const packages = [pkg("@scope/a"), pkg("@scope/b")];
		const rootsSeen: string[] = [];
		await Effect.runPromise(
			listPublishablePackageNames(packages, PROJECT_ROOT).pipe(
				Effect.provide(mockDetector(new Set(["@scope/a", "@scope/b"]), rootsSeen)),
			),
		);

		expect(rootsSeen).toEqual([PROJECT_ROOT, PROJECT_ROOT]);
		// Neither package's own `path` (a subdirectory of the project root) was
		// ever passed as `root` — this is the regression this test guards.
		expect(rootsSeen).not.toContain(packages[0]?.path);
		expect(rootsSeen).not.toContain(packages[1]?.path);
	});
});
