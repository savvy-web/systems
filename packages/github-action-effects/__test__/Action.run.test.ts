import { afterEach, beforeEach, describe, expect, it, vi } from "@effect/vitest";
import { Context, Effect, Layer } from "effect";
import { Action } from "../src/Action.js";

const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

afterEach(() => {
	vi.clearAllMocks();
	process.exitCode = undefined;
});

beforeEach(() => {
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "info").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
	vi.spyOn(console, "debug").mockImplementation(() => {});
});

describe("Action.run", () => {
	it("runs a successful program without emitting an error command", async () => {
		await Action.run(Effect.void);
		const output = stdoutWrite.mock.calls.map((c) => String(c[0])).join("");
		expect(output).not.toContain("::error::");
		expect(process.exitCode).toBeUndefined();
	});

	it("emits ::error:: workflow command on program failure", async () => {
		await Action.run(Effect.fail("something broke"));
		const output = stdoutWrite.mock.calls.map((c) => String(c[0])).join("");
		expect(output).toContain("::error::");
		expect(output).toContain("Action failed");
		expect(process.exitCode).toBe(1);
	});

	it("includes stack trace in error output when Error is thrown", async () => {
		await Action.run(Effect.die(new Error("crash with stack")));
		const output = stdoutWrite.mock.calls.map((c: unknown[]) => String(c[0])).join("");
		expect(output).toContain("::error::");
		expect(output).toContain("crash with stack");
		expect(process.exitCode).toBe(1);
	});

	it("%0A-encodes newlines so a multiline message stays inside the ::error:: annotation", async () => {
		// Reproduces issue #302: a multiline failure message (e.g. a
		// CommandRunnerError carrying stderr after `:\n`) must be emitted as a
		// single ::error:: annotation with newlines encoded as %0A, not split
		// across physical lines (which drops everything after the first \n from
		// the annotation shown in the checks UI).
		await Action.run(Effect.fail(new Error("line1\nline2\nline3")));

		// `issue()` writes each workflow command in a single stdout write, so the
		// whole ::error:: annotation is one mock call ending in exactly one "\n".
		const errorLine = stdoutWrite.mock.calls.map((c) => String(c[0])).find((s) => s.startsWith("::error::"));

		expect(errorLine).toBeDefined();
		const line = errorLine as string;
		// The interior newlines are encoded, not raw.
		expect(line).toContain("%0A");
		// The full multiline content survives into the annotation.
		expect(line).toContain("line1");
		expect(line).toContain("line2");
		expect(line).toContain("line3");
		// The only raw newline is the trailing one written by `issue()`; the
		// annotation body itself carries none.
		expect(line.endsWith("\n")).toBe(true);
		expect(line.slice(0, -1)).not.toContain("\n");
		expect(process.exitCode).toBe(1);
	});

	it("accepts additional layers via options", async () => {
		class MyService extends Context.Service<MyService, { readonly value: string }>()("TestMyService") {}
		const MyServiceLive = Layer.succeed(MyService, { value: "hello" });

		const program = Effect.flatMap(MyService, (svc) =>
			Effect.sync(() => {
				expect(svc.value).toBe("hello");
			}),
		);

		await Action.run(program, { layer: MyServiceLive });
		expect(process.exitCode).toBeUndefined();
	});
});
