import { Repos } from "@savvy-web/silk-effects";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { WorkspaceRoot } from "workspaces-effect";

import { effectToZodSchema } from "../../src/schema/effect-to-zod.js";
import { ReposInspectAsMarkdown, ReposInspectResult, reposInspect } from "../../src/tools/repos-inspect.js";

const WorkspaceRootTest = Layer.succeed(
	WorkspaceRoot,
	WorkspaceRoot.of({ find: (_base: string) => Effect.succeed("/repo") }),
);

const ReposManagerTest = Layer.succeed(
	Repos.ReposManager,
	Repos.ReposManager.of({
		status: () =>
			Effect.succeed({
				repos: [
					{
						name: "foo",
						ref: "main",
						purpose: "vendor lib",
						present: true,
						commit: "abc123",
						dirty: false,
						staleNoteIds: [],
					},
				],
				clean: true,
			}),
		sync: () => Effect.die("not stubbed"),
		add: () => Effect.die("not stubbed"),
		pin: () => Effect.die("not stubbed"),
		note: () => Effect.die("not stubbed"),
	}),
);

const ReposConfigStoreTest = Layer.succeed(
	Repos.ReposConfigStore,
	Repos.ReposConfigStore.of({
		exists: () => Effect.succeed(true),
		read: () =>
			Effect.succeed({
				repos: {
					foo: {
						url: "https://example.com/foo.git",
						ref: "main",
						purpose: "vendor lib",
						notes: [{ id: "n1", date: "2026-01-01", ref: "main", note: "contains `injection` text" }],
					},
				},
			}),
		write: () => Effect.die("not stubbed"),
	}),
);

const run = <A, E>(eff: Effect.Effect<A, E, Repos.ReposManager | Repos.ReposConfigStore | WorkspaceRoot>) =>
	Effect.runPromise(
		eff.pipe(Effect.provide(ReposManagerTest), Effect.provide(ReposConfigStoreTest), Effect.provide(WorkspaceRootTest)),
	);

describe("reposInspect handler", () => {
	it("projects status mode and renders markdown", async () => {
		const data = await run(reposInspect({ mode: "status" }, "/repo"));
		expect(data.mode).toBe("status");
		const md = Schema.decodeSync(ReposInspectAsMarkdown)(data);
		expect(md).toContain("foo");
		expect(md).toContain("abc123");
	});

	it("projects config mode and renders markdown", async () => {
		const data = await run(reposInspect({ mode: "config" }, "/repo"));
		expect(data.mode).toBe("config");
		if (data.mode === "config") {
			expect(data.result.repos.foo.url).toBe("https://example.com/foo.git");
		}
		const md = Schema.decodeSync(ReposInspectAsMarkdown)(data);
		expect(md).toContain("repos config");
		expect(md).toContain("vendor lib");
	});

	it("forbids encoding markdown back", () => {
		expect(() => Schema.encodeSync(ReposInspectAsMarkdown)("anything")).toThrow();
	});

	it("escapes repo-derived note text as an inert code span (prompt-injection hardening)", () => {
		const data = {
			mode: "config" as const,
			result: {
				repos: {
					foo: {
						url: "https://example.com/foo.git",
						ref: "main",
						purpose: "vendor lib",
						notes: [{ id: "n1", date: "2026-01-01", ref: "main", note: "contains `injection` text" }],
					},
				},
			},
		};
		const md = Schema.decodeSync(ReposInspectAsMarkdown)(data);
		// The raw, unescaped backtick form must not survive into the transcript.
		expect(md).not.toContain("contains `injection` text");
		// Backticks are escaped inside a code span.
		expect(md).toContain("contains \\`injection\\` text");
	});
});

describe("repos_inspect effect->zod bridge", () => {
	it("converts the result union and parses a status payload", () => {
		const zodSchema = effectToZodSchema(ReposInspectResult);
		const parsed = zodSchema.safeParse({
			mode: "status",
			result: {
				repos: [
					{
						name: "foo",
						ref: "main",
						purpose: "vendor lib",
						present: true,
						commit: "abc123",
						dirty: false,
						staleNoteIds: [],
					},
				],
				clean: true,
			},
		});
		expect(parsed.success).toBe(true);
	});

	it("converts the result union and parses a config payload", () => {
		const zodSchema = effectToZodSchema(ReposInspectResult);
		const parsed = zodSchema.safeParse({
			mode: "config",
			result: {
				repos: {
					foo: { url: "https://example.com/foo.git", ref: "main", purpose: "vendor lib" },
				},
			},
		});
		expect(parsed.success).toBe(true);
	});
});
