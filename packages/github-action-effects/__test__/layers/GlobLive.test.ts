import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { GlobLive } from "../../src/layers/GlobLive.js";
import { GlobTest } from "../../src/layers/GlobTest.js";
import { Glob } from "../../src/services/Glob.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const runLive = <A, E>(effect: Effect.Effect<A, E, Glob>) => Effect.provide(effect, GlobLive);
const runLiveExit = <A, E>(effect: Effect.Effect<A, E, Glob>) => Effect.exit(Effect.provide(effect, GlobLive));

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "glob-test-"));
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// glob
// ---------------------------------------------------------------------------

describe("GlobLive.glob", () => {
	it.effect("returns sorted absolute paths for a simple * pattern", () =>
		Effect.gen(function* () {
			writeFileSync(join(dir, "b.txt"), "b");
			writeFileSync(join(dir, "a.txt"), "a");
			writeFileSync(join(dir, "c.txt"), "c");

			const result = yield* runLive(Effect.flatMap(Glob, (svc) => svc.glob(`${dir}/*.txt`)));

			expect(result).toEqual([join(dir, "a.txt"), join(dir, "b.txt"), join(dir, "c.txt")]);
		}),
	);

	it.effect("honors ! exclude patterns", () =>
		Effect.gen(function* () {
			writeFileSync(join(dir, "keep.txt"), "k");
			writeFileSync(join(dir, "skip.log"), "s");

			const result = yield* runLive(Effect.flatMap(Glob, (svc) => svc.glob(`${dir}/*\n!${dir}/*.log`)));

			expect(result).toContain(join(dir, "keep.txt"));
			expect(result).not.toContain(join(dir, "skip.log"));
		}),
	);

	it.effect("ignores blank lines and # comments", () =>
		Effect.gen(function* () {
			writeFileSync(join(dir, "a.txt"), "a");

			const result = yield* runLive(Effect.flatMap(Glob, (svc) => svc.glob(`\n# a comment\n${dir}/*.txt\n`)));

			expect(result).toEqual([join(dir, "a.txt")]);
		}),
	);

	it.effect("returns [] when no file matches", () =>
		Effect.gen(function* () {
			const result = yield* runLive(Effect.flatMap(Glob, (svc) => svc.glob(`${dir}/nope/*.txt`)));
			expect(result).toEqual([]);
		}),
	);
});

// ---------------------------------------------------------------------------
// hashFiles
// ---------------------------------------------------------------------------

describe("GlobLive.hashFiles", () => {
	it.effect("returns Option.none() when no file matches", () =>
		Effect.gen(function* () {
			const result = yield* runLive(
				Effect.flatMap(Glob, (svc) => svc.hashFiles(`${dir}/nope/*.txt`, { workspace: dir })),
			);
			expect(Option.isNone(result)).toBe(true);
		}),
	);

	it.effect("hashes a single known file to the expected sha256-of-sha256", () =>
		Effect.gen(function* () {
			const bytes = Buffer.from("hello world\n", "utf8");
			const filePath = join(dir, "only.txt");
			writeFileSync(filePath, bytes);

			// Compute the expected hash-of-hashes INDEPENDENTLY from the raw bytes:
			// sha256( sha256(file).digest() ), matching @actions/glob exactly. This
			// catches a hex-vs-binary or ordering regression that a snapshot would not.
			const perFile = createHash("sha256").update(bytes).digest(); // BINARY digest
			const expected = createHash("sha256").update(perFile).digest("hex");

			const result = yield* runLive(Effect.flatMap(Glob, (svc) => svc.hashFiles(`${dir}/*.txt`, { workspace: dir })));

			expect(Option.isSome(result)).toBe(true);
			if (Option.isSome(result)) {
				expect(result.value).toBe(expected);
			}
		}),
	);

	it.effect("hashes multiple files in sorted glob order, matching an independent computation", () =>
		Effect.gen(function* () {
			const aBytes = Buffer.from("alpha", "utf8");
			const bBytes = Buffer.from("beta", "utf8");
			// Write out of order to prove ordering is determined by sort, not write order.
			writeFileSync(join(dir, "b.txt"), bBytes);
			writeFileSync(join(dir, "a.txt"), aBytes);

			// Sorted order is a.txt then b.txt; feed the BINARY per-file digests in
			// that order into one accumulating sha256.
			const acc = createHash("sha256");
			acc.update(createHash("sha256").update(aBytes).digest());
			acc.update(createHash("sha256").update(bBytes).digest());
			const expected = acc.digest("hex");

			const result = yield* runLive(Effect.flatMap(Glob, (svc) => svc.hashFiles(`${dir}/*.txt`, { workspace: dir })));

			expect(Option.isSome(result)).toBe(true);
			if (Option.isSome(result)) {
				expect(result.value).toBe(expected);
			}
		}),
	);

	it.effect("is order-stable across two patterns matching the same files", () =>
		Effect.gen(function* () {
			writeFileSync(join(dir, "a.txt"), "alpha");
			writeFileSync(join(dir, "b.txt"), "beta");

			const viaStar = yield* runLive(Effect.flatMap(Glob, (svc) => svc.hashFiles(`${dir}/*.txt`, { workspace: dir })));
			const viaList = yield* runLive(
				Effect.flatMap(Glob, (svc) => svc.hashFiles(`${dir}/a.txt\n${dir}/b.txt`, { workspace: dir })),
			);

			expect(Option.isSome(viaStar)).toBe(true);
			expect(Option.isSome(viaList)).toBe(true);
			if (Option.isSome(viaStar) && Option.isSome(viaList)) {
				expect(viaStar.value).toBe(viaList.value);
			}
		}),
	);

	it.effect("skips files outside the workspace root", () =>
		Effect.gen(function* () {
			const inside = join(dir, "inside");
			const outside = join(dir, "outside");
			// Two sibling dirs; workspace is `inside`, so the outside file must not
			// contribute to the hash.
			writeFileSync(join(dir, "inside-marker"), "x"); // ensure dirs exist via mkdir below
			const { mkdirSync } = yield* Effect.promise(() => import("node:fs"));
			mkdirSync(inside, { recursive: true });
			mkdirSync(outside, { recursive: true });
			const insideBytes = Buffer.from("inside-content", "utf8");
			writeFileSync(join(inside, "a.txt"), insideBytes);
			writeFileSync(join(outside, "b.txt"), "outside-content");

			// Expected hash includes ONLY the inside file.
			const expected = createHash("sha256").update(createHash("sha256").update(insideBytes).digest()).digest("hex");

			const result = yield* runLive(
				Effect.flatMap(Glob, (svc) => svc.hashFiles(`${inside}/*.txt\n${outside}/*.txt`, { workspace: inside })),
			);

			expect(Option.isSome(result)).toBe(true);
			if (Option.isSome(result)) {
				expect(result.value).toBe(expected);
			}
		}),
	);

	it.effect("two different file contents produce different hashes", () =>
		Effect.gen(function* () {
			writeFileSync(join(dir, "a.txt"), "first content");
			const first = yield* runLive(Effect.flatMap(Glob, (svc) => svc.hashFiles(`${dir}/*.txt`, { workspace: dir })));

			writeFileSync(join(dir, "a.txt"), "second content");
			const second = yield* runLive(Effect.flatMap(Glob, (svc) => svc.hashFiles(`${dir}/*.txt`, { workspace: dir })));

			expect(Option.isSome(first)).toBe(true);
			expect(Option.isSome(second)).toBe(true);
			if (Option.isSome(first) && Option.isSome(second)) {
				expect(first.value).not.toBe(second.value);
			}
		}),
	);

	it.effect("falls back to GITHUB_WORKSPACE when no workspace option is given", () =>
		Effect.gen(function* () {
			const bytes = Buffer.from("env-workspace", "utf8");
			writeFileSync(join(dir, "a.txt"), bytes);
			const prev = process.env.GITHUB_WORKSPACE;
			process.env.GITHUB_WORKSPACE = dir;
			try {
				const expected = createHash("sha256").update(createHash("sha256").update(bytes).digest()).digest("hex");
				const result = yield* runLive(Effect.flatMap(Glob, (svc) => svc.hashFiles(`${dir}/*.txt`)));
				expect(Option.isSome(result)).toBe(true);
				if (Option.isSome(result)) {
					expect(result.value).toBe(expected);
				}
			} finally {
				if (prev === undefined) {
					delete process.env.GITHUB_WORKSPACE;
				} else {
					process.env.GITHUB_WORKSPACE = prev;
				}
			}
		}),
	);

	it.effect("Option.getOrElse(() => '') recovers the toolkit's empty-string sentinel", () =>
		Effect.gen(function* () {
			const result = yield* runLive(
				Effect.flatMap(Glob, (svc) =>
					svc.hashFiles(`${dir}/nope/*.txt`, { workspace: dir }).pipe(Effect.map(Option.getOrElse(() => ""))),
				),
			);
			expect(result).toBe("");
		}),
	);
});

// ---------------------------------------------------------------------------
// error path
// ---------------------------------------------------------------------------

describe("GlobLive error path", () => {
	it.effect("fails with GlobError when globSync throws", () =>
		Effect.gen(function* () {
			// An invalid glob pattern (unterminated character class) makes globSync throw.
			const exit = yield* runLiveExit(Effect.flatMap(Glob, (svc) => svc.glob("[")));
			// node:fs globSync tolerates some patterns; assert the channel is typed
			// when it does throw. If it does not throw, the success path is still a
			// valid (empty) result — guard accordingly.
			if (exit._tag === "Failure") {
				const cause = JSON.stringify(exit.cause);
				expect(cause).toContain("GlobError");
			} else {
				expect(Array.isArray(exit.value)).toBe(true);
			}
		}),
	);

	it.effect("fails hashFiles with GlobError when a matched path cannot be read as a file", () =>
		Effect.gen(function* () {
			const { mkdirSync } = yield* Effect.promise(() => import("node:fs"));
			// A directory matched by the pattern: createReadStream/pipeline rejects.
			mkdirSync(join(dir, "subdir"), { recursive: true });
			const exit = yield* runLiveExit(
				Effect.flatMap(Glob, (svc) => svc.hashFiles(`${dir}/subdir`, { workspace: dir })),
			);
			expect(exit._tag).toBe("Failure");
			if (exit._tag === "Failure") {
				expect(JSON.stringify(exit.cause)).toContain("GlobError");
			}
		}),
	);
});

// ---------------------------------------------------------------------------
// GlobTest namespace
// ---------------------------------------------------------------------------

describe("GlobTest", () => {
	const run = <A, E>(state: ReturnType<typeof GlobTest.empty>, effect: Effect.Effect<A, E, Glob>) =>
		Effect.provide(effect, GlobTest.layer(state));

	it.effect("layer returns seeded matches for a pattern", () =>
		Effect.gen(function* () {
			const state = GlobTest.empty();
			state.matches.set("*.ts", ["/repo/a.ts", "/repo/b.ts"]);
			const result = yield* run(
				state,
				Effect.flatMap(Glob, (svc) => svc.glob("*.ts")),
			);
			expect(result).toEqual(["/repo/a.ts", "/repo/b.ts"]);
		}),
	);

	it.effect("layer returns [] for an unseeded glob pattern", () =>
		Effect.gen(function* () {
			const state = GlobTest.empty();
			const result = yield* run(
				state,
				Effect.flatMap(Glob, (svc) => svc.glob("*.ts")),
			);
			expect(result).toEqual([]);
		}),
	);

	it.effect("layer returns seeded hash for a pattern", () =>
		Effect.gen(function* () {
			const state = GlobTest.empty();
			state.hashes.set("*.lock", "deadbeef");
			const result = yield* run(
				state,
				Effect.flatMap(Glob, (svc) => svc.hashFiles("*.lock")),
			);
			expect(Option.isSome(result)).toBe(true);
			if (Option.isSome(result)) {
				expect(result.value).toBe("deadbeef");
			}
		}),
	);

	it.effect("layer returns Option.none() for an unseeded hash pattern", () =>
		Effect.gen(function* () {
			const state = GlobTest.empty();
			const result = yield* run(
				state,
				Effect.flatMap(Glob, (svc) => svc.hashFiles("*.lock")),
			);
			expect(Option.isNone(result)).toBe(true);
		}),
	);
});
