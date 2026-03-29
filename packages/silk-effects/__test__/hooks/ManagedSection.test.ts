import { FileSystem } from "@effect/platform";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { ManagedSectionWriteError } from "../../src/hooks/errors.js";
import { ManagedSection, ManagedSectionLive } from "../../src/hooks/ManagedSection.js";

// ---------------------------------------------------------------------------
// Mock FileSystem
// ---------------------------------------------------------------------------

/**
 * Build a minimal in-memory FileSystem layer for testing.
 * `files` is mutated in-place so tests can observe writes.
 */
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TOOL = "MY-TOOL";
const BEGIN = "# --- BEGIN MY-TOOL MANAGED SECTION ---";
const END = "# --- END MY-TOOL MANAGED SECTION ---";

function runWith(files: Record<string, string>, effect: Effect.Effect<unknown, unknown, ManagedSection>) {
	const testFs = makeTestFs(files);
	const layer = ManagedSectionLive.pipe(Layer.provide(testFs));
	return Effect.runPromise(Effect.provide(effect, layer));
}

// ---------------------------------------------------------------------------
// read
// ---------------------------------------------------------------------------

describe("ManagedSection.read", () => {
	it("returns null when file has no managed section", async () => {
		const files = { "/hook": "#!/bin/sh\n# user content\n" };
		const result = await runWith(files, ManagedSection.pipe(Effect.andThen((s) => s.read("/hook", TOOL))));
		expect(result).toBeNull();
	});

	it("returns null when file does not exist", async () => {
		const files: Record<string, string> = {};
		const result = await runWith(files, ManagedSection.pipe(Effect.andThen((s) => s.read("/hook", TOOL))));
		expect(result).toBeNull();
	});

	it("parses managed section with before/managed/after content", async () => {
		const files = {
			"/hook": `#!/bin/sh\n# user before\n${BEGIN}\nmanaged content\n${END}\n# user after\n`,
		};
		const result = (await runWith(files, ManagedSection.pipe(Effect.andThen((s) => s.read("/hook", TOOL))))) as {
			before: string;
			managed: string;
			after: string;
		};

		expect(result).not.toBeNull();
		expect(result.before).toBe("#!/bin/sh\n# user before\n");
		expect(result.managed).toBe("\nmanaged content\n");
		expect(result.after).toBe("\n# user after\n");
	});

	it("handles file with markers but no before/after content", async () => {
		const files = { "/hook": `${BEGIN}\nmanaged\n${END}\n` };
		const result = (await runWith(files, ManagedSection.pipe(Effect.andThen((s) => s.read("/hook", TOOL))))) as {
			before: string;
			managed: string;
			after: string;
		};

		expect(result).not.toBeNull();
		expect(result.before).toBe("");
		expect(result.managed).toBe("\nmanaged\n");
		expect(result.after).toBe("\n");
	});

	it("returns null when only BEGIN marker present", async () => {
		const files = { "/hook": `#!/bin/sh\n${BEGIN}\nsome content\n` };
		const result = await runWith(files, ManagedSection.pipe(Effect.andThen((s) => s.read("/hook", TOOL))));
		expect(result).toBeNull();
	});

	it("returns null when END marker comes before BEGIN marker", async () => {
		const files = { "/hook": `${END}\nsome content\n${BEGIN}\n` };
		const result = await runWith(files, ManagedSection.pipe(Effect.andThen((s) => s.read("/hook", TOOL))));
		expect(result).toBeNull();
	});

	it("respects custom comment style (//)", async () => {
		const files = {
			"/hook": `// --- BEGIN MY-TOOL MANAGED SECTION ---\ncontent\n// --- END MY-TOOL MANAGED SECTION ---\n`,
		};
		const result = await runWith(files, ManagedSection.pipe(Effect.andThen((s) => s.read("/hook", TOOL, "//"))));
		expect(result).not.toBeNull();
	});
});

// ---------------------------------------------------------------------------
// write
// ---------------------------------------------------------------------------

describe("ManagedSection.write", () => {
	it("creates new file with managed section when file does not exist", async () => {
		const files: Record<string, string> = {};
		await runWith(files, ManagedSection.pipe(Effect.andThen((s) => s.write("/hook", TOOL, "\nnew content\n"))));

		expect(files["/hook"]).toBeDefined();
		expect(files["/hook"]).toContain(BEGIN);
		expect(files["/hook"]).toContain(END);
		expect(files["/hook"]).toContain("new content");
	});

	it("replaces existing managed section, preserving before/after", async () => {
		const files = {
			"/hook": `#!/bin/sh\n# before\n${BEGIN}\nold content\n${END}\n# after\n`,
		};
		await runWith(files, ManagedSection.pipe(Effect.andThen((s) => s.write("/hook", TOOL, "\nnew content\n"))));

		expect(files["/hook"]).toContain("# before");
		expect(files["/hook"]).toContain("# after");
		expect(files["/hook"]).toContain("new content");
		expect(files["/hook"]).not.toContain("old content");
	});

	it("appends managed section to file without markers", async () => {
		const files = { "/hook": "#!/bin/sh\n# user hook\n" };
		await runWith(files, ManagedSection.pipe(Effect.andThen((s) => s.write("/hook", TOOL, "\nmanaged\n"))));

		expect(files["/hook"]).toContain("# user hook");
		expect(files["/hook"]).toContain(BEGIN);
		expect(files["/hook"]).toContain(END);
		expect(files["/hook"]).toContain("managed");
	});

	it("preserves before content when appending", async () => {
		const files = { "/hook": "#!/bin/sh\n# existing\n" };
		await runWith(files, ManagedSection.pipe(Effect.andThen((s) => s.write("/hook", TOOL, "\nmanaged\n"))));
		expect(files["/hook"]).toMatch(/#!/);
		expect(files["/hook"]).toContain("# existing");
	});
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe("ManagedSection.update", () => {
	it("replaces managed content and preserves surrounding content", async () => {
		const files = {
			"/hook": `#!/bin/sh\n# before\n${BEGIN}\noriginal\n${END}\n# after\n`,
		};
		await runWith(files, ManagedSection.pipe(Effect.andThen((s) => s.update("/hook", TOOL, "\nupdated\n"))));

		expect(files["/hook"]).toContain("# before");
		expect(files["/hook"]).toContain("# after");
		expect(files["/hook"]).toContain("updated");
		expect(files["/hook"]).not.toContain("original");
	});

	it("creates file when it does not exist", async () => {
		const files: Record<string, string> = {};
		await runWith(files, ManagedSection.pipe(Effect.andThen((s) => s.update("/hook", TOOL, "\ncontent\n"))));

		expect(files["/hook"]).toContain(BEGIN);
		expect(files["/hook"]).toContain("content");
	});
});

// ---------------------------------------------------------------------------
// isManaged
// ---------------------------------------------------------------------------

describe("ManagedSection.isManaged", () => {
	it("returns false for non-existent file", async () => {
		const files: Record<string, string> = {};
		const result = await runWith(files, ManagedSection.pipe(Effect.andThen((s) => s.isManaged("/hook", TOOL))));
		expect(result).toBe(false);
	});

	it("returns false for file without markers", async () => {
		const files = { "/hook": "#!/bin/sh\n# user content\n" };
		const result = await runWith(files, ManagedSection.pipe(Effect.andThen((s) => s.isManaged("/hook", TOOL))));
		expect(result).toBe(false);
	});

	it("returns true for file with both markers", async () => {
		const files = { "/hook": `#!/bin/sh\n${BEGIN}\ncontent\n${END}\n` };
		const result = await runWith(files, ManagedSection.pipe(Effect.andThen((s) => s.isManaged("/hook", TOOL))));
		expect(result).toBe(true);
	});

	it("returns false when only BEGIN marker present", async () => {
		const files = { "/hook": `#!/bin/sh\n${BEGIN}\ncontent\n` };
		const result = await runWith(files, ManagedSection.pipe(Effect.andThen((s) => s.isManaged("/hook", TOOL))));
		expect(result).toBe(false);
	});

	it("returns false when END marker comes before BEGIN marker", async () => {
		const files = { "/hook": `${END}\ncontent\n${BEGIN}\n` };
		const result = await runWith(files, ManagedSection.pipe(Effect.andThen((s) => s.isManaged("/hook", TOOL))));
		expect(result).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

describe("ManagedSectionWriteError", () => {
	it("has correct tag", () => {
		const err = new ManagedSectionWriteError({ path: "/hook", reason: "disk full" });
		expect(err._tag).toBe("ManagedSectionWriteError");
	});

	it("has human-readable message", () => {
		const err = new ManagedSectionWriteError({ path: "/hook", reason: "disk full" });
		expect(err.message).toContain("/hook");
		expect(err.message).toContain("disk full");
	});
});
