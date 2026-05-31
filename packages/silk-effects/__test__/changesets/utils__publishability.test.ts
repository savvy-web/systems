/**
 * Tests for {@link listPublishablePackageNames}.
 *
 * The function delegates to whatever {@link PublishabilityDetector} layer is
 * provided: a package is "publishable" when the detector returns at least one
 * {@link PublishTarget} for it. A mock detector layer keyed off package name
 * drives the behavior so the test stays focused on the name-collection logic
 * (filtering, dedup-by-Set) without touching the filesystem.
 */

import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import type { PublishTarget, WorkspacePackage } from "workspaces-effect";
import { PublishabilityDetector } from "workspaces-effect";

import { listPublishablePackageNames } from "../../src/changesets/utils/publishability.js";

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
 * name is in `publishable`, and an empty array otherwise.
 */
const mockDetector = (publishable: ReadonlySet<string>): Layer.Layer<PublishabilityDetector> =>
	Layer.succeed(PublishabilityDetector, {
		detect: (p: WorkspacePackage) => Effect.succeed(publishable.has(p.name) ? [target()] : []),
	} as unknown as PublishabilityDetector["Type"]);

const run = (
	packages: ReadonlyArray<WorkspacePackage>,
	publishable: ReadonlySet<string>,
): Promise<ReadonlySet<string>> =>
	Effect.runPromise(listPublishablePackageNames(packages).pipe(Effect.provide(mockDetector(publishable))));

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
});
