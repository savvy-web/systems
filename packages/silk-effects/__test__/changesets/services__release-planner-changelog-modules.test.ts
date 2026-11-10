/**
 * Unit coverage for the `changelogModules` config rewrite shared by
 * `ReleasePlanner.preview` and `ReleasePlanner.apply`. The end-to-end
 * behaviour is covered by the preview/apply suites; this file drives the
 * rewrite directly over every shape the kit's `ChangesetConfig.changelog`
 * keeps (`false`, a bare id, an `[id, options]` pair).
 */
import { describe, expect, it } from "@effect/vitest";
import { ChangesetConfig } from "@effected/changesets";
import { Effect, Schema } from "effect";
import { withChangelogModules } from "../../src/changesets/services/release-planner.js";

const baseConfig = (overrides: Record<string, unknown> = {}): ChangesetConfig =>
	Schema.decodeUnknownSync(ChangesetConfig)({
		changelog: ["@savvy-web/changelog", { repo: "o/r" }],
		format: "auto",
		commit: false,
		access: "restricted",
		baseBranch: "main",
		updateInternalDependencies: "patch",
		privatePackages: { version: true, tag: false },
		...overrides,
	});

describe("withChangelogModules", () => {
	it.effect("rewrites the configured id to its mapped path", () =>
		Effect.gen(function* () {
			const config = yield* withChangelogModules(
				baseConfig(),
				{ "@savvy-web/changelog": "/abs/changelog.mjs" },
				"preview",
			);

			expect(config.changelog).toEqual(["/abs/changelog.mjs", { repo: "o/r" }]);
		}),
	);

	it.effect("maps a bare id to a [path, null] pair, as @changesets/config normalises it", () =>
		Effect.gen(function* () {
			const config = yield* withChangelogModules(
				baseConfig({ changelog: "@savvy-web/changelog" }),
				{ "@savvy-web/changelog": "/abs/changelog.mjs" },
				"apply",
			);

			expect(config.changelog).toEqual(["/abs/changelog.mjs", null]);
		}),
	);

	it.effect("preserves the changelog options object untouched", () =>
		Effect.gen(function* () {
			const opts = { repo: "o/r", extra: 1 };
			const config = yield* withChangelogModules(
				baseConfig({ changelog: ["@savvy-web/changelog", opts] }),
				{ "@savvy-web/changelog": "/abs/changelog.mjs" },
				"apply",
			);

			expect(Array.isArray(config.changelog) ? config.changelog[1] : null).toBe(opts);
		}),
	);

	it.effect("rewrites nothing when changelog is false", () =>
		Effect.gen(function* () {
			const config = yield* withChangelogModules(
				baseConfig({ changelog: false }),
				{ "@savvy-web/changelog": "/abs/changelog.mjs" },
				"preview",
			);

			expect(config.changelog).toBe(false);
		}),
	);

	it.effect("fails with the caller's phase and the supported keys when the id is unmapped", () =>
		Effect.gen(function* () {
			const error = yield* withChangelogModules(
				baseConfig({ changelog: ["@custom/generator", null] }),
				{ "@savvy-web/changelog": "/a.mjs", "@changesets/cli/changelog": "/b.mjs" },
				"preview",
			).pipe(Effect.flip);

			expect(error.phase).toBe("preview");
			expect(error.reason).toContain('"@custom/generator"');
			expect(error.reason).toContain("@savvy-web/changelog, @changesets/cli/changelog");
		}),
	);

	it.effect("carries the apply phase when apply is the caller", () =>
		Effect.gen(function* () {
			const error = yield* withChangelogModules(
				baseConfig({ changelog: ["@custom/generator", null] }),
				{ "@savvy-web/changelog": "/a.mjs" },
				"apply",
			).pipe(Effect.flip);

			expect(error.phase).toBe("apply");
		}),
	);

	// `map["toString"]` reads back Object.prototype.toString — a function, not
	// undefined — so a `=== undefined` membership check would accept it and hand
	// the engine a non-string where it expects a module specifier.
	it.effect.each(["toString", "constructor", "valueOf", "hasOwnProperty"])(
		"treats the inherited id %s as unmapped",
		(inherited) =>
			Effect.gen(function* () {
				const error = yield* withChangelogModules(
					baseConfig({ changelog: [inherited, null] }),
					{ "@savvy-web/changelog": "/a.mjs" },
					"preview",
				).pipe(Effect.flip);

				expect(error.reason).toContain("is not in changelogModules");
				expect(error.reason).toContain(inherited);
			}),
	);

	it.effect("still maps an own property that shadows a prototype member", () =>
		Effect.gen(function* () {
			const config = yield* withChangelogModules(
				baseConfig({ changelog: ["toString", null] }),
				{ toString: "/abs/shadowed.mjs" },
				"preview",
			);

			expect(Array.isArray(config.changelog) ? config.changelog[0] : null).toBe("/abs/shadowed.mjs");
		}),
	);
});
