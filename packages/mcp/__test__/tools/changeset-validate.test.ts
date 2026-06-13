import { Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { WorkspaceRoot } from "workspaces-effect";

import { ChangesetValidateAsMarkdown, changesetValidate } from "../../src/tools/changeset-validate.js";

const WorkspaceRootTest = Layer.succeed(
	WorkspaceRoot,
	WorkspaceRoot.of({ find: (_base: string) => Effect.succeed(process.cwd()) }),
);

const run = <A, E>(eff: Effect.Effect<A, E, WorkspaceRoot>) =>
	Effect.runPromise(eff.pipe(Effect.provide(WorkspaceRootTest)));

describe("changesetValidate handler", () => {
	it("ok=true, no messages for a valid changeset dir", async () => {
		const data = await run(changesetValidate({ dir: "packages/mcp/__test__/fixtures/changeset-valid" }, process.cwd()));
		expect(data.ok).toBe(true);
		expect(data.messages).toHaveLength(0);
		expect(data.errorCount).toBe(0);
		const md = Schema.decodeSync(ChangesetValidateAsMarkdown)(data);
		expect(md).toContain("No changeset issues");
	});

	it("ok=false with typed messages for an invalid changeset", async () => {
		const data = await run(
			changesetValidate({ dir: "packages/mcp/__test__/fixtures/changeset-invalid" }, process.cwd()),
		);
		expect(data.ok).toBe(false);
		expect(data.errorCount).toBeGreaterThan(0);
		expect(data.messages[0]).toHaveProperty("rule");
		expect(data.messages[0]).toHaveProperty("file");
		const md = Schema.decodeSync(ChangesetValidateAsMarkdown)(data);
		expect(md).toContain("issue(s)");
	});

	it("forbids encoding markdown back", () => {
		expect(() => Schema.encodeSync(ChangesetValidateAsMarkdown)("anything")).toThrow();
	});

	it("maps a thrown validate error into the typed error channel", async () => {
		const exit = await Effect.runPromiseExit(
			changesetValidate({ dir: "packages/mcp/__test__/fixtures/does-not-exist" }, process.cwd()).pipe(
				Effect.provide(WorkspaceRootTest),
			),
		);
		expect(exit._tag).toBe("Failure");
	});
});
