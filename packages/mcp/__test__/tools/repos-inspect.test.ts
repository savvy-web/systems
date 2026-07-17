import { WorkspaceRoot } from "@effected/workspaces";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";

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
		const md = Schema.decodeUnknownSync(ReposInspectAsMarkdown)(data);
		expect(md).toContain("foo");
		expect(md).toContain("abc123");
	});

	it("projects config mode and renders markdown", async () => {
		const data = await run(reposInspect({ mode: "config" }, "/repo"));
		expect(data.mode).toBe("config");
		if (data.mode === "config") {
			expect(data.result.repos.foo.url).toBe("https://example.com/foo.git");
		}
		const md = Schema.decodeUnknownSync(ReposInspectAsMarkdown)(data);
		expect(md).toContain("repos config");
		expect(md).toContain("vendor lib");
	});

	it("forbids encoding markdown back", () => {
		expect(() => Schema.encodeUnknownSync(ReposInspectAsMarkdown)("anything")).toThrow();
	});

	it("renders repo-derived note text as an inert code span via delimiter runs (prompt-injection hardening)", () => {
		const payload = "`## heading";
		const data = {
			mode: "config" as const,
			result: {
				repos: {
					foo: {
						url: "https://example.com/foo.git",
						ref: "main",
						purpose: "vendor lib",
						notes: [{ id: "n1", date: "2026-01-01", ref: "main", note: payload }],
					},
				},
			},
		};
		const md = Schema.decodeUnknownSync(ReposInspectAsMarkdown)(data);
		// The payload is wrapped in a backtick run strictly longer than any run
		// it contains (here: 1-backtick run inside, so a 2-backtick delimiter),
		// space-padded because the value starts with a backtick.
		expect(md).toContain("`` `## heading ``");
		// The payload stays inert: no line of the transcript starts with the
		// injected heading.
		for (const line of md.split("\n")) {
			expect(line.startsWith("## heading")).toBe(false);
		}
		// The delimiter run is longer than the longest embedded run.
		const noteLine = md.split("\n").find((line) => line.includes("## heading")) ?? "";
		const runs = noteLine.match(/`+/g) ?? [];
		const longest = Math.max(...runs.map((run) => run.length));
		const embedded = (payload.match(/`+/g) ?? []).map((run) => run.length);
		expect(longest).toBeGreaterThan(Math.max(...embedded));
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
