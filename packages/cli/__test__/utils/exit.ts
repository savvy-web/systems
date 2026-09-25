/**
 * A `CliExit` for handler tests: one cell per test file, reset before each
 * test, provided wherever a handler runs. `CliRuntime.main` owns the real cell
 * in production; a test asserts on this one instead of on `process.exitCode`.
 */

import { CliExit } from "@effected/cli";
import { Layer, MutableRef } from "effect";

export class TestExit {
	private constructor() {}

	/** The cell every run in this file writes through `CliExit.set`. */
	static readonly cell: MutableRef.MutableRef<number> = MutableRef.make(0);

	/** Provide this to any handler whose requirements include `CliExit`. */
	static readonly layer: Layer.Layer<CliExit> = Layer.succeed(CliExit, { code: TestExit.cell });

	/** Call from `beforeEach`. */
	static readonly reset = (): void => {
		MutableRef.set(TestExit.cell, 0);
	};

	/** The highest code set since the last reset, `0` when none. */
	static readonly code = (): number => MutableRef.get(TestExit.cell);
}
