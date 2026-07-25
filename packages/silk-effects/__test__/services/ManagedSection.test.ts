import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer } from "effect";
import { SectionBlock } from "../../src/schemas/SectionBlock.js";
import { SectionDefinition } from "../../src/schemas/SectionDefinition.js";
import { ManagedSection, ManagedSectionLive } from "../../src/services/ManagedSection.js";

// ── Mock FileSystem ─────────────────────────────────────────────

const makeTestFs = (files: Record<string, string>) =>
	Layer.succeed(FileSystem.FileSystem, {
		exists: (path: string) => Effect.succeed(path in files),
		readFileString: (path: string) =>
			path in files ? Effect.succeed(files[path]) : Effect.fail(new Error(`ENOENT: ${path}`)),
		writeFileString: (path: string, content: string) =>
			Effect.sync(() => {
				files[path] = content;
			}),
	} as unknown as FileSystem.FileSystem);

// ── Helpers ─────────────────────────────────────────────────────

const TOOL = "MY-TOOL";
const DEF = SectionDefinition.make({ toolName: TOOL });
const BEGIN = "# --- BEGIN MY-TOOL MANAGED SECTION ---";
const END = "# --- END MY-TOOL MANAGED SECTION ---";

// Per-test provide is REQUIRED here, not an unoptimised leftover: the mocked filesystem is
// built from — and mutated through — the per-test `files` record, so the layer genuinely
// varies test by test and cannot be hoisted into a suite-boundary `layer(...)` block.
function runWith<A, E>(files: Record<string, string>, effect: Effect.Effect<A, E, ManagedSection>) {
	const testFs = makeTestFs(files);
	const layer = ManagedSectionLive.pipe(Layer.provide(testFs));
	return Effect.provide(effect, layer);
}

// ── read ────────────────────────────────────────────────────────

describe("ManagedSection.read", () => {
	it.effect("returns null when file does not exist", () =>
		Effect.gen(function* () {
			const files: Record<string, string> = {};
			const result = yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.read("/hook", DEF)),
			);
			expect(result).toBeNull();
		}),
	);

	it.effect("returns null when file has no markers", () =>
		Effect.gen(function* () {
			const files = { "/hook": "#!/bin/sh\n# user content\n" };
			const result = yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.read("/hook", DEF)),
			);
			expect(result).toBeNull();
		}),
	);

	it.effect("returns SectionBlock when markers found", () =>
		Effect.gen(function* () {
			const files = { "/hook": `#!/bin/sh\n${BEGIN}\nmanaged\n${END}\n# after\n` };
			const result = yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.read("/hook", DEF)),
			);
			expect(result).toBeInstanceOf(SectionBlock);
			expect(result?.content).toBe("managed");
			expect(result?.toolName).toBe(TOOL);
		}),
	);

	it.effect("works with dual API (data-last)", () =>
		Effect.gen(function* () {
			const files = { "/hook": `${BEGIN}\ncontent\n${END}\n` };
			const result = yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.read(DEF)("/hook")),
			);
			expect(result).toBeInstanceOf(SectionBlock);
		}),
	);
});

// ── write ───────────────────────────────────────────────────────

describe("ManagedSection.write", () => {
	it.effect("creates new file when it does not exist", () =>
		Effect.gen(function* () {
			const files: Record<string, string> = {};
			const block = DEF.block("new content");
			yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.write("/hook", block)),
			);
			expect(files["/hook"]).toContain(BEGIN);
			expect(files["/hook"]).toContain(END);
			expect(files["/hook"]).toContain("new content");
		}),
	);

	it.effect("replaces existing managed section", () =>
		Effect.gen(function* () {
			const files = { "/hook": `#!/bin/sh\n${BEGIN}\nold\n${END}\n# after\n` };
			const block = DEF.block("new");
			yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.write("/hook", block)),
			);
			expect(files["/hook"]).toContain("new");
			expect(files["/hook"]).not.toContain("old");
			expect(files["/hook"]).toContain("# after");
		}),
	);

	it.effect("appends to file without markers", () =>
		Effect.gen(function* () {
			const files = { "/hook": "#!/bin/sh\n# user hook\n" };
			const block = DEF.block("managed");
			yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.write("/hook", block)),
			);
			expect(files["/hook"]).toContain("# user hook");
			expect(files["/hook"]).toContain(BEGIN);
			expect(files["/hook"]).toContain("managed");
		}),
	);
});

// ── isManaged ───────────────────────────────────────────────────

describe("ManagedSection.isManaged", () => {
	it.effect("returns false for non-existent file", () =>
		Effect.gen(function* () {
			const files: Record<string, string> = {};
			const result = yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.isManaged("/hook", DEF)),
			);
			expect(result).toBe(false);
		}),
	);

	it.effect("returns true when both markers present", () =>
		Effect.gen(function* () {
			const files = { "/hook": `${BEGIN}\ncontent\n${END}\n` };
			const result = yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.isManaged("/hook", DEF)),
			);
			expect(result).toBe(true);
		}),
	);

	it.effect("returns false when markers missing", () =>
		Effect.gen(function* () {
			const files = { "/hook": "no markers here" };
			const result = yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.isManaged("/hook", DEF)),
			);
			expect(result).toBe(false);
		}),
	);
});

// ── sync ────────────────────────────────────────────────────────

describe("ManagedSection.sync", () => {
	it.effect("returns Created when file does not exist", () =>
		Effect.gen(function* () {
			const files: Record<string, string> = {};
			const block = DEF.block("content");
			const result = yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.sync("/hook", block)),
			);
			expect(result._tag).toBe("Created");
			expect(files["/hook"]).toContain("content");
		}),
	);

	it.effect("returns Unchanged when content matches", () =>
		Effect.gen(function* () {
			const files = { "/hook": `${BEGIN}\ncontent\n${END}\n` };
			const block = DEF.block("content");
			const result = yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.sync("/hook", block)),
			);
			expect(result._tag).toBe("Unchanged");
		}),
	);

	it.effect("returns Updated with diff when content differs", () =>
		Effect.gen(function* () {
			const files = { "/hook": `${BEGIN}\nold content\n${END}\n` };
			const block = DEF.block("new content");
			const result = yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.sync("/hook", block)),
			);
			expect(result._tag).toBe("Updated");
			if (result._tag === "Updated") {
				expect(result.diff._tag).toBe("Changed");
			}
			expect(files["/hook"]).toContain("new content");
			expect(files["/hook"]).not.toContain("old content");
		}),
	);

	it.effect("returns Created when file exists without markers", () =>
		Effect.gen(function* () {
			const files = { "/hook": "#!/bin/sh\n" };
			const block = DEF.block("content");
			const result = yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.sync("/hook", block)),
			);
			expect(result._tag).toBe("Created");
		}),
	);
});

// ── check ───────────────────────────────────────────────────────

describe("ManagedSection.check", () => {
	it.effect("returns NotFound when file does not exist", () =>
		Effect.gen(function* () {
			const files: Record<string, string> = {};
			const block = DEF.block("content");
			const result = yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.check("/hook", block)),
			);
			expect(result._tag).toBe("NotFound");
		}),
	);

	it.effect("returns Found + isUpToDate when content matches", () =>
		Effect.gen(function* () {
			const files = { "/hook": `${BEGIN}\ncontent\n${END}\n` };
			const block = DEF.block("content");
			const result = yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.check("/hook", block)),
			);
			expect(result._tag).toBe("Found");
			if (result._tag === "Found") {
				expect(result.isUpToDate).toBe(true);
				expect(result.diff._tag).toBe("Unchanged");
			}
		}),
	);

	it.effect("returns Found + not isUpToDate when content differs", () =>
		Effect.gen(function* () {
			const files = { "/hook": `${BEGIN}\nold\n${END}\n` };
			const block = DEF.block("new");
			const result = yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.check("/hook", block)),
			);
			expect(result._tag).toBe("Found");
			if (result._tag === "Found") {
				expect(result.isUpToDate).toBe(false);
				expect(result.diff._tag).toBe("Changed");
			}
		}),
	);

	it.effect("returns NotFound when file has no markers", () =>
		Effect.gen(function* () {
			const files = { "/hook": "no markers" };
			const block = DEF.block("content");
			const result = yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.check("/hook", block)),
			);
			expect(result._tag).toBe("NotFound");
		}),
	);
});

// ── remove ──────────────────────────────────────────────────────

describe("ManagedSection.remove", () => {
	it.effect("removes a present section and reports true, preserving surrounding content", () =>
		Effect.gen(function* () {
			const files = { "/hook": `#!/bin/sh\n# top\n\n${BEGIN}\nmanaged\n${END}\n\n# bottom\n` };
			const removed = yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.remove("/hook", DEF)),
			);
			expect(removed).toBe(true);
			expect(files["/hook"]).not.toContain(BEGIN);
			expect(files["/hook"]).not.toContain(END);
			expect(files["/hook"]).not.toContain("managed");
			// Surrounding content kept; collapsed to a single blank line between survivors.
			expect(files["/hook"]).toBe("#!/bin/sh\n# top\n\n# bottom\n");
		}),
	);

	it.effect("returns false when the section is absent (file has no markers)", () =>
		Effect.gen(function* () {
			const files = { "/hook": "#!/bin/sh\n# no markers\n" };
			const removed = yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.remove("/hook", DEF)),
			);
			expect(removed).toBe(false);
			expect(files["/hook"]).toBe("#!/bin/sh\n# no markers\n");
		}),
	);

	it.effect("returns false when the file is missing (no error)", () =>
		Effect.gen(function* () {
			const files: Record<string, string> = {};
			const removed = yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.remove("/hook", DEF)),
			);
			expect(removed).toBe(false);
		}),
	);

	it.effect("works with dual API (data-last)", () =>
		Effect.gen(function* () {
			const files = { "/hook": `${BEGIN}\nmanaged\n${END}\n` };
			const removed = yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.remove(DEF)("/hook")),
			);
			expect(removed).toBe(true);
			expect(files["/hook"]).toBe("");
		}),
	);

	it.effect("keeps a single trailing newline when the section is at the end", () =>
		Effect.gen(function* () {
			const files = { "/hook": `#!/bin/sh\nA\n\n${BEGIN}\nm\n${END}\n` };
			yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.remove("/hook", DEF)),
			);
			expect(files["/hook"]).toBe("#!/bin/sh\nA\n");
		}),
	);

	it.effect("is idempotent: second remove returns false and leaves content stable", () =>
		Effect.gen(function* () {
			const files = { "/hook": `#!/bin/sh\n# top\n\n${BEGIN}\nmanaged\n${END}\n\n# bottom\n` };
			const first = yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.remove("/hook", DEF)),
			);
			const afterFirst = files["/hook"];
			const second = yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.remove("/hook", DEF)),
			);
			expect(first).toBe(true);
			expect(second).toBe(false);
			expect(files["/hook"]).toBe(afterFirst);
		}),
	);

	it.effect("does not accumulate blank gaps across remove/re-add/remove cycles", () =>
		Effect.gen(function* () {
			const files = { "/hook": `#!/bin/sh\n# top\n\n${BEGIN}\nmanaged\n${END}\n\n# bottom\n` };
			const afterFirst = yield* runWith(
				files,
				Effect.gen(function* () {
					const s = yield* ManagedSection;
					yield* s.remove("/hook", DEF);
					return files["/hook"];
				}),
			);
			yield* runWith(
				files,
				Effect.gen(function* () {
					const s = yield* ManagedSection;
					yield* s.write("/hook", DEF.block("managed"));
					yield* s.remove("/hook", DEF);
				}),
			);
			// Re-adding then removing returns to the same shape — no growing blank gaps.
			expect(files["/hook"]).toBe(afterFirst);
		}),
	);

	it.effect("removes only the targeted section, leaving other sections intact", () =>
		Effect.gen(function* () {
			const OTHER_BEGIN = "# --- BEGIN OTHER MANAGED SECTION ---";
			const OTHER_END = "# --- END OTHER MANAGED SECTION ---";
			const files = {
				"/hook": `${BEGIN}\nmine\n${END}\n\n${OTHER_BEGIN}\ntheirs\n${OTHER_END}\n`,
			};
			const removed = yield* runWith(
				files,
				Effect.andThen(ManagedSection, (s) => s.remove("/hook", DEF)),
			);
			expect(removed).toBe(true);
			expect(files["/hook"]).not.toContain(BEGIN);
			expect(files["/hook"]).toContain(OTHER_BEGIN);
			expect(files["/hook"]).toContain("theirs");
		}),
	);
});

// ── error paths (filesystem failures) ───────────────────────────

const makeFailingFs = (overrides: {
	exists?: boolean;
	read?: "ok" | "fail";
	write?: "ok" | "fail";
	content?: string;
}) =>
	Layer.succeed(FileSystem.FileSystem, {
		exists: () => Effect.succeed(overrides.exists ?? true),
		readFileString: (path: string) =>
			overrides.read === "fail" ? Effect.fail(new Error(`EIO read: ${path}`)) : Effect.succeed(overrides.content ?? ""),
		writeFileString: (path: string) =>
			overrides.write === "fail" ? Effect.fail(new Error(`EIO write: ${path}`)) : Effect.void,
	} as unknown as FileSystem.FileSystem);

// Per-test provide is REQUIRED here too: the failing-filesystem layer is a parameter, and
// each error-path test picks a different failure mode. Not a suite-boundary `layer(...)`.
function runFail<A, E>(layer: Layer.Layer<FileSystem.FileSystem>, effect: Effect.Effect<A, E, ManagedSection>) {
	return Effect.exit(Effect.provide(effect, ManagedSectionLive.pipe(Layer.provide(layer))));
}

describe("ManagedSection error paths", () => {
	const failRead = makeFailingFs({ exists: true, read: "fail" });
	const block = DEF.block("managed");
	const managed = `${BEGIN}\nmanaged\n${END}\n`;

	it.effect("read surfaces a filesystem read failure", () =>
		Effect.gen(function* () {
			const exit = yield* runFail(
				failRead,
				Effect.andThen(ManagedSection, (s) => s.read("/hook", DEF)),
			);
			expect(exit._tag).toBe("Failure");
		}),
	);

	it.effect("write surfaces a read failure when the target file exists", () =>
		Effect.gen(function* () {
			const exit = yield* runFail(
				failRead,
				Effect.andThen(ManagedSection, (s) => s.write("/hook", block)),
			);
			expect(exit._tag).toBe("Failure");
		}),
	);

	it.effect("sync surfaces a read failure", () =>
		Effect.gen(function* () {
			const exit = yield* runFail(
				failRead,
				Effect.andThen(ManagedSection, (s) => s.sync("/hook", block)),
			);
			expect(exit._tag).toBe("Failure");
		}),
	);

	it.effect("syncMany surfaces a read failure", () =>
		Effect.gen(function* () {
			const exit = yield* runFail(
				failRead,
				Effect.andThen(ManagedSection, (s) => s.syncMany("/hook", [block])),
			);
			expect(exit._tag).toBe("Failure");
		}),
	);

	it.effect("remove surfaces a read failure", () =>
		Effect.gen(function* () {
			const exit = yield* runFail(
				failRead,
				Effect.andThen(ManagedSection, (s) => s.remove("/hook", DEF)),
			);
			expect(exit._tag).toBe("Failure");
		}),
	);

	it.effect("write surfaces a write failure when creating a new file", () =>
		Effect.gen(function* () {
			const failWrite = makeFailingFs({ exists: false, write: "fail" });
			const exit = yield* runFail(
				failWrite,
				Effect.andThen(ManagedSection, (s) => s.write("/hook", block)),
			);
			expect(exit._tag).toBe("Failure");
		}),
	);

	it.effect("syncMany surfaces a write failure", () =>
		Effect.gen(function* () {
			const failWrite = makeFailingFs({ exists: false, write: "fail" });
			const exit = yield* runFail(
				failWrite,
				Effect.andThen(ManagedSection, (s) => s.syncMany("/hook", [block])),
			);
			expect(exit._tag).toBe("Failure");
		}),
	);

	it.effect("remove surfaces a write failure when stripping an existing section", () =>
		Effect.gen(function* () {
			const failWrite = makeFailingFs({ exists: true, read: "ok", write: "fail", content: managed });
			const exit = yield* runFail(
				failWrite,
				Effect.andThen(ManagedSection, (s) => s.remove("/hook", DEF)),
			);
			expect(exit._tag).toBe("Failure");
		}),
	);
});
