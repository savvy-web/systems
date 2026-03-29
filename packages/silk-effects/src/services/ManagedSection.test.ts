import { FileSystem } from "@effect/platform";
import { Effect, Equal, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { SectionBlock } from "../schemas/SectionBlock.js";
import { SectionDefinition } from "../schemas/SectionDefinition.js";
import { ManagedSection, ManagedSectionLive } from "./ManagedSection.js";

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

function runWith<A, E>(files: Record<string, string>, effect: Effect.Effect<A, E, ManagedSection>) {
	const testFs = makeTestFs(files);
	const layer = ManagedSectionLive.pipe(Layer.provide(testFs));
	return Effect.runPromise(Effect.provide(effect, layer));
}

// ── read ────────────────────────────────────────────────────────

describe("ManagedSection.read", () => {
	it("returns null when file does not exist", async () => {
		const files: Record<string, string> = {};
		const result = await runWith(
			files,
			Effect.andThen(ManagedSection, (s) => s.read("/hook", DEF)),
		);
		expect(result).toBeNull();
	});

	it("returns null when file has no markers", async () => {
		const files = { "/hook": "#!/bin/sh\n# user content\n" };
		const result = await runWith(
			files,
			Effect.andThen(ManagedSection, (s) => s.read("/hook", DEF)),
		);
		expect(result).toBeNull();
	});

	it("returns SectionBlock when markers found", async () => {
		const files = { "/hook": `#!/bin/sh\n${BEGIN}\nmanaged\n${END}\n# after\n` };
		const result = await runWith(
			files,
			Effect.andThen(ManagedSection, (s) => s.read("/hook", DEF)),
		);
		expect(result).toBeInstanceOf(SectionBlock);
		expect(result!.content).toBe("\nmanaged\n");
		expect(result!.toolName).toBe(TOOL);
	});

	it("works with dual API (data-last)", async () => {
		const files = { "/hook": `${BEGIN}\ncontent\n${END}\n` };
		const result = await runWith(
			files,
			Effect.andThen(ManagedSection, (s) => s.read(DEF)("/hook")),
		);
		expect(result).toBeInstanceOf(SectionBlock);
	});
});

// ── write ───────────────────────────────────────────────────────

describe("ManagedSection.write", () => {
	it("creates new file when it does not exist", async () => {
		const files: Record<string, string> = {};
		const block = DEF.block("\nnew content\n");
		await runWith(
			files,
			Effect.andThen(ManagedSection, (s) => s.write("/hook", block)),
		);
		expect(files["/hook"]).toContain(BEGIN);
		expect(files["/hook"]).toContain(END);
		expect(files["/hook"]).toContain("new content");
	});

	it("replaces existing managed section", async () => {
		const files = { "/hook": `#!/bin/sh\n${BEGIN}\nold\n${END}\n# after\n` };
		const block = DEF.block("\nnew\n");
		await runWith(
			files,
			Effect.andThen(ManagedSection, (s) => s.write("/hook", block)),
		);
		expect(files["/hook"]).toContain("new");
		expect(files["/hook"]).not.toContain("old");
		expect(files["/hook"]).toContain("# after");
	});

	it("appends to file without markers", async () => {
		const files = { "/hook": "#!/bin/sh\n# user hook\n" };
		const block = DEF.block("\nmanaged\n");
		await runWith(
			files,
			Effect.andThen(ManagedSection, (s) => s.write("/hook", block)),
		);
		expect(files["/hook"]).toContain("# user hook");
		expect(files["/hook"]).toContain(BEGIN);
		expect(files["/hook"]).toContain("managed");
	});
});

// ── isManaged ───────────────────────────────────────────────────

describe("ManagedSection.isManaged", () => {
	it("returns false for non-existent file", async () => {
		const files: Record<string, string> = {};
		const result = await runWith(
			files,
			Effect.andThen(ManagedSection, (s) => s.isManaged("/hook", DEF)),
		);
		expect(result).toBe(false);
	});

	it("returns true when both markers present", async () => {
		const files = { "/hook": `${BEGIN}\ncontent\n${END}\n` };
		const result = await runWith(
			files,
			Effect.andThen(ManagedSection, (s) => s.isManaged("/hook", DEF)),
		);
		expect(result).toBe(true);
	});

	it("returns false when markers missing", async () => {
		const files = { "/hook": "no markers here" };
		const result = await runWith(
			files,
			Effect.andThen(ManagedSection, (s) => s.isManaged("/hook", DEF)),
		);
		expect(result).toBe(false);
	});
});

// ── sync ────────────────────────────────────────────────────────

describe("ManagedSection.sync", () => {
	it("returns Created when file does not exist", async () => {
		const files: Record<string, string> = {};
		const block = DEF.block("\ncontent\n");
		const result = await runWith(
			files,
			Effect.andThen(ManagedSection, (s) => s.sync("/hook", block)),
		);
		expect(result._tag).toBe("Created");
		expect(files["/hook"]).toContain("content");
	});

	it("returns Unchanged when content matches", async () => {
		const files = { "/hook": `${BEGIN}\ncontent\n${END}\n` };
		const block = DEF.block("\ncontent\n");
		const result = await runWith(
			files,
			Effect.andThen(ManagedSection, (s) => s.sync("/hook", block)),
		);
		expect(result._tag).toBe("Unchanged");
	});

	it("returns Updated with diff when content differs", async () => {
		const files = { "/hook": `${BEGIN}\nold content\n${END}\n` };
		const block = DEF.block("\nnew content\n");
		const result = await runWith(
			files,
			Effect.andThen(ManagedSection, (s) => s.sync("/hook", block)),
		);
		expect(result._tag).toBe("Updated");
		if (result._tag === "Updated") {
			expect(result.diff._tag).toBe("Changed");
		}
		expect(files["/hook"]).toContain("new content");
		expect(files["/hook"]).not.toContain("old content");
	});

	it("returns Created when file exists without markers", async () => {
		const files = { "/hook": "#!/bin/sh\n" };
		const block = DEF.block("\ncontent\n");
		const result = await runWith(
			files,
			Effect.andThen(ManagedSection, (s) => s.sync("/hook", block)),
		);
		expect(result._tag).toBe("Created");
	});
});

// ── check ───────────────────────────────────────────────────────

describe("ManagedSection.check", () => {
	it("returns NotFound when file does not exist", async () => {
		const files: Record<string, string> = {};
		const block = DEF.block("\ncontent\n");
		const result = await runWith(
			files,
			Effect.andThen(ManagedSection, (s) => s.check("/hook", block)),
		);
		expect(result._tag).toBe("NotFound");
	});

	it("returns Found + isUpToDate when content matches", async () => {
		const files = { "/hook": `${BEGIN}\ncontent\n${END}\n` };
		const block = DEF.block("\ncontent\n");
		const result = await runWith(
			files,
			Effect.andThen(ManagedSection, (s) => s.check("/hook", block)),
		);
		expect(result._tag).toBe("Found");
		if (result._tag === "Found") {
			expect(result.isUpToDate).toBe(true);
			expect(result.diff._tag).toBe("Unchanged");
		}
	});

	it("returns Found + not isUpToDate when content differs", async () => {
		const files = { "/hook": `${BEGIN}\nold\n${END}\n` };
		const block = DEF.block("\nnew\n");
		const result = await runWith(
			files,
			Effect.andThen(ManagedSection, (s) => s.check("/hook", block)),
		);
		expect(result._tag).toBe("Found");
		if (result._tag === "Found") {
			expect(result.isUpToDate).toBe(false);
			expect(result.diff._tag).toBe("Changed");
		}
	});

	it("returns NotFound when file has no markers", async () => {
		const files = { "/hook": "no markers" };
		const block = DEF.block("\ncontent\n");
		const result = await runWith(
			files,
			Effect.andThen(ManagedSection, (s) => s.check("/hook", block)),
		);
		expect(result._tag).toBe("NotFound");
	});
});
