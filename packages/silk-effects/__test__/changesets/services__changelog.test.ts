import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

import { getDependencyReleaseLine } from "../../src/changesets/changelog/getDependencyReleaseLine.js";
import { getReleaseLine } from "../../src/changesets/changelog/getReleaseLine.js";
import type { ChangesetOptions } from "../../src/changesets/schemas/options.js";
import { ChangelogService } from "../../src/changesets/services/changelog.js";
import { makeGitHubTest } from "../../src/changesets/services/github.js";
import type { GitHubCommitInfo } from "../../src/changesets/vendor/github-info.js";

const OPTIONS: ChangesetOptions = { repo: "owner/repo" };

const MOCK_INFO: GitHubCommitInfo = {
	user: "testuser",
	pull: 99,
	links: {
		commit: "[`abc1234`](https://github.com/owner/repo/commit/abc1234567890)",
		pull: "https://github.com/owner/repo/pull/99",
		user: "https://github.com/testuser",
	},
};

const testGitHubLayer = makeGitHubTest(new Map([["abc1234567890", MOCK_INFO]]));

const ChangelogLive = Layer.succeed(ChangelogService, {
	formatReleaseLine: getReleaseLine,
	formatDependencyReleaseLine: getDependencyReleaseLine,
});

const TestLayer = Layer.mergeAll(ChangelogLive, testGitHubLayer);

describe("ChangelogService (Effect service layer)", () => {
	it.effect("formatReleaseLine via service returns formatted output", () =>
		Effect.gen(function* () {
			const program = Effect.gen(function* () {
				const changelog = yield* ChangelogService;
				return yield* changelog.formatReleaseLine(
					{
						id: "svc-1",
						summary: "feat: add feature via service",
						releases: [{ name: "pkg", type: "minor" }],
						commit: "abc1234567890",
					},
					"minor",
					OPTIONS,
				);
			});

			const result = yield* program.pipe(Effect.provide(TestLayer));
			expect(typeof result).toBe("string");
			expect(result).toContain("add feature via service");
		}),
	);

	it.effect("formatDependencyReleaseLine via service returns formatted output", () =>
		Effect.gen(function* () {
			const program = Effect.gen(function* () {
				const changelog = yield* ChangelogService;
				return yield* changelog.formatDependencyReleaseLine(
					[{ id: "svc-2", summary: "bump deps", releases: [], commit: "abc1234567890" }],
					[
						{
							name: "dep-pkg",
							type: "patch",
							oldVersion: "1.0.0",
							newVersion: "1.0.1",
							changesets: [],
							packageJson: { name: "dep-pkg", version: "1.0.1" },
							dir: "/packages/dep-pkg",
						},
					],
					OPTIONS,
				);
			});

			const result = yield* program.pipe(Effect.provide(TestLayer));
			expect(typeof result).toBe("string");
			expect(result).toContain("dep-pkg");
		}),
	);
});
