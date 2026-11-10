import { expect, layer } from "@effect/vitest";
import type { WorkspacePackage } from "@effected/workspaces";
import { WorkspaceDiscovery, WorkspaceDiscoveryError, WorkspaceRoot } from "@effected/workspaces";
import { Effect, Layer } from "effect";

import { changesetValidate } from "../../src/tools/changeset-validate.js";

const WorkspaceRootTest = Layer.succeed(
	WorkspaceRoot,
	WorkspaceRoot.of({ find: (_base: string) => Effect.succeed(process.cwd()) }),
);

// Only `name` is read from a discovered package.
const packagesNamed = (...names: string[]) => names.map((name) => ({ name }) as unknown as WorkspacePackage);

const DiscoveryTest = WorkspaceDiscovery.layerTest({
	listPackagesIn: () => Effect.succeed(packagesNamed("@scope/foo")),
});

layer(Layer.merge(WorkspaceRootTest, DiscoveryTest))("changesetValidate handler", (it) => {
	it.effect("ok=true, no messages for a valid changeset dir", () =>
		Effect.gen(function* () {
			const data = yield* changesetValidate({ dir: "packages/mcp/__test__/fixtures/changeset-valid" }, process.cwd());
			expect(data.ok).toBe(true);
			expect(data.messages).toHaveLength(0);
			expect(data.errorCount).toBe(0);
		}),
	);

	it.effect("ok=false with typed messages for an invalid changeset", () =>
		Effect.gen(function* () {
			const data = yield* changesetValidate({ dir: "packages/mcp/__test__/fixtures/changeset-invalid" }, process.cwd());
			expect(data.ok).toBe(false);
			expect(data.errorCount).toBeGreaterThan(0);
			expect(data.messages[0]).toHaveProperty("rule");
			expect(data.messages[0]).toHaveProperty("file");
		}),
	);

	// `Effect.flip` pins the actual contract the handler's `Effect.try` exists
	// to provide: the thrown error surfaces as the TYPED `ChangesetValidateError`
	// rather than escaping as a defect. The previous `exit._tag === "Failure"`
	// check passed either way.
	it.effect("maps a thrown validate error into the typed error channel", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(
				changesetValidate({ dir: "packages/mcp/__test__/fixtures/does-not-exist" }, process.cwd()),
			);
			expect(error._tag).toBe("ChangesetValidateError");
		}),
	);

	it.effect("reports a front matter package outside the workspace (CF004)", () =>
		Effect.gen(function* () {
			const data = yield* changesetValidate(
				{ dir: "packages/mcp/__test__/fixtures/changeset-valid" },
				process.cwd(),
			).pipe(
				Effect.provide(
					WorkspaceDiscovery.layerTest({ listPackagesIn: () => Effect.succeed(packagesNamed("@savvy-web/other")) }),
				),
			);
			expect(data.ok).toBe(false);
			expect(data.messages.map((m) => m.rule)).toEqual(["changeset-known-package"]);
		}),
	);

	it.effect("skips the workspace package check when discovery fails", () =>
		Effect.gen(function* () {
			const data = yield* changesetValidate(
				{ dir: "packages/mcp/__test__/fixtures/changeset-valid" },
				process.cwd(),
			).pipe(
				Effect.provide(
					WorkspaceDiscovery.layerTest({
						listPackagesIn: (root) =>
							Effect.fail(
								new WorkspaceDiscoveryError({ root, path: `${root}/package.json`, kind: "read", cause: undefined }),
							),
					}),
				),
			);
			expect(data.ok).toBe(true);
		}),
	);
});
