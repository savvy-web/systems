import { expect, layer } from "@effect/vitest";
import { WorkspaceRoot } from "@effected/workspaces";
import { Effect, Layer, Schema } from "effect";

import { ChangesetValidateAsMarkdown, changesetValidate } from "../../src/tools/changeset-validate.js";

const WorkspaceRootTest = Layer.succeed(
	WorkspaceRoot,
	WorkspaceRoot.of({ find: (_base: string) => Effect.succeed(process.cwd()) }),
);

layer(WorkspaceRootTest)("changesetValidate handler", (it) => {
	it.effect("ok=true, no messages for a valid changeset dir", () =>
		Effect.gen(function* () {
			const data = yield* changesetValidate({ dir: "packages/mcp/__test__/fixtures/changeset-valid" }, process.cwd());
			expect(data.ok).toBe(true);
			expect(data.messages).toHaveLength(0);
			expect(data.errorCount).toBe(0);
			const md = Schema.decodeUnknownSync(ChangesetValidateAsMarkdown)(data);
			expect(md).toContain("No changeset issues");
		}),
	);

	it.effect("ok=false with typed messages for an invalid changeset", () =>
		Effect.gen(function* () {
			const data = yield* changesetValidate({ dir: "packages/mcp/__test__/fixtures/changeset-invalid" }, process.cwd());
			expect(data.ok).toBe(false);
			expect(data.errorCount).toBeGreaterThan(0);
			expect(data.messages[0]).toHaveProperty("rule");
			expect(data.messages[0]).toHaveProperty("file");
			const md = Schema.decodeUnknownSync(ChangesetValidateAsMarkdown)(data);
			expect(md).toContain("issue(s)");
		}),
	);

	it("forbids encoding markdown back", () => {
		expect(() => Schema.encodeUnknownSync(ChangesetValidateAsMarkdown)("anything")).toThrow();
	});

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
});
