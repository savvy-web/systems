import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { MarkdownLive, MarkdownService } from "../../src/changesets/services/markdown.js";

describe("MarkdownLive", () => {
	it("parse converts markdown string to AST", async () => {
		const program = Effect.gen(function* () {
			const svc = yield* MarkdownService;
			return yield* svc.parse("# Hello\n\nWorld\n");
		}).pipe(Effect.provide(MarkdownLive));

		const tree = await Effect.runPromise(program);
		expect(tree.type).toBe("root");
		expect(tree.children.length).toBeGreaterThan(0);
	});

	it("stringify converts AST back to markdown", async () => {
		const program = Effect.gen(function* () {
			const svc = yield* MarkdownService;
			const tree = yield* svc.parse("# Hello\n\nWorld\n");
			return yield* svc.stringify(tree);
		}).pipe(Effect.provide(MarkdownLive));

		const result = await Effect.runPromise(program);
		expect(result).toContain("# Hello");
		expect(result).toContain("World");
	});
});
