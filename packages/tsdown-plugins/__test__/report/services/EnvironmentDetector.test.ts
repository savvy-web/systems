// packages/tsdown-plugins/__test__/report/services/EnvironmentDetector.test.ts
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect } from "effect";
import type { Environment } from "../../../src/report/services/EnvironmentDetector.js";
import { EnvironmentDetector } from "../../../src/report/services/EnvironmentDetector.js";

/** Run `detect` against an explicit environment record instead of the process environment. */
const detectIn = (env: Record<string, string>): Effect.Effect<Environment> =>
	Effect.flatMap(EnvironmentDetector, (detector) => detector.detect()).pipe(
		Effect.provide(EnvironmentDetector.layer),
		Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))),
	);

describe("EnvironmentDetector.layer", () => {
	it.effect("an empty environment is the human terminal", () =>
		Effect.gen(function* () {
			expect(yield* detectIn({})).toBe("terminal");
		}),
	);

	it.effect("GitHub Actions is ci-github", () =>
		Effect.gen(function* () {
			expect(yield* detectIn({ GITHUB_ACTIONS: "true", CI: "true" })).toBe("ci-github");
		}),
	);

	it.effect("another CI provider, or a bare CI flag, is ci-generic", () =>
		Effect.gen(function* () {
			expect(yield* detectIn({ GITLAB_CI: "true", CI: "true" })).toBe("ci-generic");
			expect(yield* detectIn({ CI: "1" })).toBe("ci-generic");
		}),
	);

	it.effect("CI=false is not CI", () =>
		Effect.gen(function* () {
			expect(yield* detectIn({ CI: "false" })).toBe("terminal");
		}),
	);

	it.effect("an agent wins over CI", () =>
		Effect.gen(function* () {
			expect(yield* detectIn({ CLAUDECODE: "1", GITHUB_ACTIONS: "true" })).toBe("agent-shell");
		}),
	);
});
