import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { MarkdownLive, MarkdownService } from "../../src/changesets/services/markdown.js";

describe("MarkdownLive", () => {
	it.effect("parse converts markdown string to AST", () =>
		Effect.gen(function* () {
			const program = Effect.gen(function* () {
				const svc = yield* MarkdownService;
				return yield* svc.parse("# Hello\n\nWorld\n");
			}).pipe(Effect.provide(MarkdownLive));

			const tree = yield* program;
			expect(tree.type).toBe("root");
			expect(tree.children.length).toBeGreaterThan(0);
		}),
	);

	it.effect("stringify converts AST back to markdown", () =>
		Effect.gen(function* () {
			const program = Effect.gen(function* () {
				const svc = yield* MarkdownService;
				const tree = yield* svc.parse("# Hello\n\nWorld\n");
				return yield* svc.stringify(tree);
			}).pipe(Effect.provide(MarkdownLive));

			const result = yield* program;
			expect(result).toContain("# Hello");
			expect(result).toContain("World");
		}),
	);
});
