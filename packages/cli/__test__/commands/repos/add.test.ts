import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { CliAudience, CliInteractive, CliPrompt } from "@effected/cli";
import { TestTerminal } from "@effected/cli/testing";
import type { Repos } from "@savvy-web/silk-effects";
import { Effect, Layer } from "effect";
import { Command } from "effect/cli";

import { runReposAdd } from "../../../src/commands/repos/commands/add.js";
import { reposCommand } from "../../../src/commands/repos/index.js";
import { Capture } from "../../utils/capture.js";
import { ReposStub } from "./fixtures.js";

type AddOptions = Parameters<Repos.ReposManagerShape["add"]>[1];

const recording = () => {
	const calls: Array<AddOptions> = [];
	const layer = ReposStub.manager({
		add: (_root, options) => {
			calls.push(options);
			return Effect.succeed({ name: "foo", ref: options.ref, path: ".repos/foo" } as never);
		},
	});
	return { calls, layer };
};

const root = Command.make("savvy").pipe(
	Command.withSharedFlags(CliAudience.flags()),
	Command.withSubcommands([reposCommand]),
);

describe("repos add", () => {
	it.effect("vendors the repo and prints where it landed", () =>
		Effect.gen(function* () {
			const { calls, layer } = recording();
			const result = yield* Capture.run(
				runReposAdd("/repo", { url: "https://example.test/foo", ref: "v1", purpose: "demo" }).pipe(
					Effect.provide(layer),
				),
			);
			expect(calls).toEqual([{ url: "https://example.test/foo", ref: "v1", purpose: "demo" }]);
			expect(result.stdout).toEqual(["✓ foo @ v1 -> .repos/foo\n  staged — review and commit"]);
		}),
	);

	it.effect("left off anywhere that cannot prompt, --ref or --purpose is core's usage error, exit 64", () =>
		Effect.gen(function* () {
			const services = Layer.merge(ReposStub.manager({}), ReposStub.drift());
			const noRef = yield* ReposStub.cli(["add", "https://example.test/foo", "--purpose", "demo"], services);
			expect(noRef.exitCode).toBe(64);
			expect(noRef.stderr.join("\n")).toContain("--ref");
			const noPurpose = yield* ReposStub.cli(["add", "https://example.test/foo", "--ref", "v1"], services);
			expect(noPurpose.exitCode).toBe(64);
			expect(noPurpose.stderr.join("\n")).toContain("--purpose");
		}),
	);

	it.effect("at a terminal, a missing --ref and --purpose are asked for, in order", () =>
		Effect.gen(function* () {
			const { calls, layer } = recording();
			const terminal = yield* TestTerminal.make();
			yield* terminal.type("v2");
			yield* terminal.input([{ name: "enter" }]);
			yield* terminal.type("reference for the spec");
			yield* terminal.input([{ name: "enter" }]);
			yield* Capture.run(
				Command.runWith(root, { version: "0.0.0" })(["repos", "add", "https://example.test/foo"]).pipe(
					Effect.provide(
						Layer.mergeAll(
							layer,
							ReposStub.drift(),
							CliPrompt.gateTerminal.pipe(Layer.provide(terminal.layer)),
							CliInteractive.layerTest(true),
						),
					),
					Effect.provide(NodeServices.layer),
				),
			);
			expect(calls).toEqual([{ url: "https://example.test/foo", ref: "v2", purpose: "reference for the spec" }]);
			const output = yield* terminal.output;
			expect(output).toContain("Ref to check out");
			expect(output).toContain("Why is this repo vendored?");
		}),
	);

	it.effect("git and lockdown failures are CommandErrors naming the url, exit 1", () =>
		Effect.gen(function* () {
			for (const error of [ReposStub.git("fatal: repository not found"), ReposStub.lockdown("chmod failed")]) {
				const layer = ReposStub.manager({ add: () => Effect.fail(error) });
				const result = yield* Capture.main(
					runReposAdd("/repo", { url: "https://example.test/foo", ref: "v1", purpose: "demo" }).pipe(
						Effect.provide(layer),
					),
				);
				expect(result.exitCode).toBe(1);
				expect(result.stdout).toEqual([]);
				expect(result.stderr.join("\n")).toContain("could not vendor https://example.test/foo");
				expect(result.stderr.join("\n")).toContain("TIP:");
			}
		}),
	);

	it.effect("with no manifest it says nothing is vendored and exits 0", () =>
		Effect.gen(function* () {
			const layer = ReposStub.manager({ add: () => Effect.fail(ReposStub.configMissing) });
			const result = yield* Capture.run(
				runReposAdd("/repo", { url: "https://example.test/foo", ref: "v1", purpose: "demo" }).pipe(
					Effect.provide(layer),
				),
			);
			expect(result.stdout).toEqual(["↷ no .repos/config.json — nothing vendored"]);
		}),
	);
});
