import { describe, expect, it } from "@effect/vitest";
import { CliAudience, CliRuntime } from "@effected/cli";
import { ConfigProvider, Console, Effect, Exit, Layer } from "effect";

import { AppLive, CliConfigLive, CliPlatform, rootCommand } from "../src/cli/index.js";

import { VersionLine } from "../src/internal/version-line.js";
import { Capture, makeRecordingConsole } from "./utils/capture.js";

/**
 * `savvy --version` through `CliRuntime.main`, wired as `main()` wires it, at a
 * terminal with colour forced on — so core's default formatter would paint it.
 */
const versionLine = (distribution: { readonly name: string; readonly version: string } | null) =>
	Effect.gen(function* () {
		const stdout: Array<string> = [];
		const program = CliAudience.runWith(rootCommand, { version: "1.2.3" })(["--version"]).pipe(
			Effect.provide(Layer.merge(AppLive, CliConfigLive)),
			Effect.provide(CliPlatform),
		);
		const exit = yield* CliRuntime.main(program, {
			platform: Capture.mainPlatform(true),
			env: { formatter: { formatVersion: VersionLine.format } },
			distribution,
		}).pipe(
			Effect.provideService(Console.Console, makeRecordingConsole(stdout, [])),
			Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ FORCE_COLOR: "1" })),
			Effect.exit,
		);
		expect(Exit.isSuccess(exit)).toBe(true);
		return stdout;
	});

describe("VersionLine.format", () => {
	it("renders the bare name and version, with no escapes", () => {
		expect(VersionLine.format("savvy", "1.2.3")).toBe("savvy v1.2.3");
	});

	it.effect("stays plain at a terminal for a direct install", () =>
		Effect.gen(function* () {
			expect(yield* versionLine(null)).toEqual(["savvy v1.2.3"]);
		}),
	);

	it.effect("gets the carrier suffix from CliRuntime.main's distribution", () =>
		Effect.gen(function* () {
			expect(yield* versionLine({ name: "@savvy-web/silk", version: "4.5.6" })).toEqual([
				"savvy v1.2.3 via @savvy-web/silk 4.5.6",
			]);
		}),
	);
});
