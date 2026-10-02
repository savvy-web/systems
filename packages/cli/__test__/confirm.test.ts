import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { CliUiTest } from "@effected/cli/ui/testing";
import { Console, Effect, Fiber, Option } from "effect";
import { Command } from "effect/cli";

import { confirmDestructive, yesFlag } from "../src/internal/confirm.js";
import { Interactive } from "./utils/interactive.js";

const ask = (yes: boolean) => confirmDestructive({ message: "Remove 2 vendored repos?", yes });

describe("confirmDestructive", () => {
	it.effect("--yes proceeds without mounting a screen", () =>
		Effect.gen(function* () {
			const { session, fiber } = yield* Interactive.run(ask(true));
			expect((yield* Fiber.join(fiber)).value).toBe(true);
			expect(yield* session.mounts).toBe(0);
		}).pipe(Effect.scoped),
	);

	it.effect("a run that cannot prompt proceeds without mounting a screen", () =>
		Effect.gen(function* () {
			const { session, fiber } = yield* Interactive.run(ask(false), { interactive: false });
			expect((yield* Fiber.join(fiber)).value).toBe(true);
			expect(yield* session.mounts).toBe(0);
		}).pipe(Effect.scoped),
	);

	it.effect("asks a person, and y + enter proceeds", () =>
		Effect.gen(function* () {
			const { session, fiber } = yield* Interactive.run(ask(false));
			const screen = yield* session.next({ contains: "Remove 2 vendored repos?" });
			yield* screen.type("y");
			yield* screen.press("enter");
			expect((yield* Fiber.join(fiber)).value).toBe(true);
			expect(yield* session.mounts).toBe(1);
		}).pipe(Effect.scoped),
	);

	it.effect("enter alone answers no", () =>
		Effect.gen(function* () {
			const { session, fiber } = yield* Interactive.run(ask(false));
			yield* (yield* session.next({ contains: "Remove 2 vendored repos?" })).press("enter");
			expect((yield* Fiber.join(fiber)).value).toBe(false);
		}).pipe(Effect.scoped),
	);

	it.effect("Esc is the kit's Cancelled, for main to report with exit 130", () =>
		Effect.gen(function* () {
			const { session, fiber } = yield* Interactive.run(ask(false));
			yield* (yield* session.next({ contains: "Remove 2 vendored repos?" })).press("escape");
			expect(CliUiTest.cancelReason(yield* Fiber.await(fiber))).toEqual(Option.some("escape"));
		}).pipe(Effect.scoped),
	);
});

describe("yesFlag", () => {
	const probe = Command.make("probe", { yes: yesFlag }, ({ yes }) => Console.log(String(yes)));
	const parse = (argv: ReadonlyArray<string>) =>
		Effect.gen(function* () {
			const lines: Array<string> = [];
			yield* Command.runWith(probe, { version: "0.0.0" })(argv).pipe(
				Effect.provideService(Console.Console, {
					...globalThis.console,
					log: (line: unknown) => void lines.push(String(line)),
				}),
				Effect.provide(NodeServices.layer),
			);
			return lines;
		});

	it.effect("is false when omitted, true for --yes and -y", () =>
		Effect.gen(function* () {
			expect(yield* parse([])).toEqual(["false"]);
			expect(yield* parse(["--yes"])).toEqual(["true"]);
			expect(yield* parse(["-y"])).toEqual(["true"]);
		}),
	);
});
