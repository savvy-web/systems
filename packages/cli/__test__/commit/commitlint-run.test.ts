import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { ScriptedSpawner } from "@effected/commands";
import { Effect } from "effect";
import { afterEach, beforeEach } from "vitest";

import { runCommitlintLast } from "../../src/commands/commit/hooks/post-commit-verify.js";
import { runCommitlintEdit } from "../../src/commands/commit/lint.js";

let root: string;

const projectFor = (packageManager: string) =>
	writeFileSync(join(root, "package.json"), JSON.stringify({ name: "fixture", packageManager }));

beforeEach(() => {
	root = mkdtempSync(join(tmpdir(), "savvy-commitlint-run-"));
	projectFor("pnpm@10.0.0");
});

afterEach(() => {
	rmSync(root, { recursive: true, force: true });
});

describe("runCommitlintEdit (savvy commit lint)", () => {
	it.effect("passes on a zero exit and spawns the project-local commitlint in the repo root", () =>
		Effect.gen(function* () {
			const spawner = ScriptedSpawner.make(() => ({ stdout: "ok\n" }));
			const result = yield* runCommitlintEdit(root, "/tmp/MSG").pipe(Effect.provide(spawner.layer));
			expect(result).toEqual({ passed: true, stdout: "ok\n", stderr: "" });
			expect(spawner.spawns).toHaveLength(1);
			expect(spawner.spawns[0]?.command).toBe("pnpm");
			expect(spawner.spawns[0]?.args).toEqual(["exec", "commitlint", "--edit", "/tmp/MSG"]);
			expect(spawner.spawns[0]?.cwd).toBe(root);
		}),
	);

	it.effect("fails on a non-zero exit and keeps commitlint's own stdout and stderr", () =>
		Effect.gen(function* () {
			const spawner = ScriptedSpawner.make(() => ({
				stdout: "✖ subject-empty\n",
				stderr: "found 1 problem\n",
				exit: 1,
			}));
			const result = yield* runCommitlintEdit(root, "/tmp/MSG").pipe(Effect.provide(spawner.layer));
			expect(result).toEqual({ passed: false, stdout: "✖ subject-empty\n", stderr: "found 1 problem\n" });
		}),
	);

	it.effect("reports a launcher that never starts as a failure, its message standing in for stderr", () =>
		Effect.gen(function* () {
			const spawner = ScriptedSpawner.make((command) => ScriptedSpawner.notFound(command));
			const result = yield* runCommitlintEdit(root, "/tmp/MSG").pipe(Effect.provide(spawner.layer));
			expect(result.passed).toBe(false);
			expect(result.stdout).toBe("");
			expect(result.stderr).toBe('Command "pnpm exec commitlint --edit /tmp/MSG" failed');
		}),
	);

	it.effect("runs a bun project through bun x --no-install, never an auto-installing bunx", () =>
		Effect.gen(function* () {
			projectFor("bun@1.2.0");
			const spawner = ScriptedSpawner.make(() => ({}));
			yield* runCommitlintEdit(root, "/tmp/MSG").pipe(Effect.provide(spawner.layer));
			expect(spawner.spawns[0]?.command).toBe("bun");
			expect(spawner.spawns[0]?.args).toEqual(["x", "--no-install", "commitlint", "--edit", "/tmp/MSG"]);
		}),
	);
});

describe("runCommitlintLast (savvy commit hook post-commit-verify)", () => {
	it.effect("answers not-failed on a zero exit, replaying --last in the repo root", () =>
		Effect.gen(function* () {
			const spawner = ScriptedSpawner.make(() => ({}));
			expect(yield* runCommitlintLast(root).pipe(Effect.provide(spawner.layer))).toBe(false);
			expect(spawner.spawns[0]?.args).toEqual(["exec", "commitlint", "--last"]);
			expect(spawner.spawns[0]?.cwd).toBe(root);
		}),
	);

	it.effect("answers failed on a non-zero exit", () =>
		Effect.gen(function* () {
			const spawner = ScriptedSpawner.make(() => ({ exit: 1 }));
			expect(yield* runCommitlintLast(root).pipe(Effect.provide(spawner.layer))).toBe(true);
		}),
	);

	it.effect("answers failed when the launcher never starts", () =>
		Effect.gen(function* () {
			const spawner = ScriptedSpawner.make((command) => ScriptedSpawner.notFound(command));
			expect(yield* runCommitlintLast(root).pipe(Effect.provide(spawner.layer))).toBe(true);
		}),
	);
});
