import { Effect, FileSystem, Layer } from "effect";
import { describe, expect, it } from "vitest";
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

function runWith<A, E>(files: Record<string, string>, effect: Effect.Effect<A, E, ManagedSection>) {
	const testFs = makeTestFs(files);
	const layer = ManagedSectionLive.pipe(Layer.provide(testFs));
	return Effect.runPromise(Effect.provide(effect, layer));
}

// ── Fixtures ────────────────────────────────────────────────────

const A = SectionDefinition.make({ toolName: "ALPHA" }).block("alpha");
const B = SectionDefinition.make({ toolName: "BETA" }).block("beta");

const A_BEGIN = "# --- BEGIN ALPHA MANAGED SECTION ---";
const A_END = "# --- END ALPHA MANAGED SECTION ---";
const B_BEGIN = "# --- BEGIN BETA MANAGED SECTION ---";
const B_END = "# --- END BETA MANAGED SECTION ---";
const X_BEGIN = "# --- BEGIN XRAY MANAGED SECTION ---";
const X_END = "# --- END XRAY MANAGED SECTION ---";

const A_SEC = `${A_BEGIN}\nalpha\n${A_END}`;
const B_SEC = `${B_BEGIN}\nbeta\n${B_END}`;
const X_SEC = `${X_BEGIN}\nxray\n${X_END}`;

const tags = (results: readonly { readonly _tag: string }[]) => results.map((r) => r._tag);

const syncMany = (files: Record<string, string>, path: string, blocks: ReadonlyArray<typeof A>) =>
	runWith(
		files,
		Effect.andThen(ManagedSection, (s) => s.syncMany(path, blocks)),
	);

// ── Acceptance scenarios ────────────────────────────────────────

describe("ManagedSection.syncMany", () => {
	it("scenario 1: writes [A, B] in order into a new/empty file", async () => {
		const files: Record<string, string> = {};
		const results = await syncMany(files, "/hook", [A, B]);
		expect(tags(results)).toEqual(["Created", "Created"]);
		expect(files["/hook"]).toBe(`${A_SEC}\n\n${B_SEC}\n`);
	});

	it("scenario 1b: handles an existing empty-string file", async () => {
		const files = { "/hook": "" };
		const results = await syncMany(files, "/hook", [A, B]);
		expect(tags(results)).toEqual(["Created", "Created"]);
		expect(files["/hook"]).toBe(`${A_SEC}\n\n${B_SEC}\n`);
	});

	it("scenario 2: inserts missing A immediately before its declared sibling B", async () => {
		const files = { "/hook": `userTop\n\n${B_SEC}\n` };
		const results = await syncMany(files, "/hook", [A, B]);
		expect(tags(results)).toEqual(["Created", "Unchanged"]);
		expect(files["/hook"]).toBe(`userTop\n\n${A_SEC}\n\n${B_SEC}\n`);
	});

	it("scenario 3: updates in place, preserving order and intervening user content", async () => {
		const files = {
			"/hook": `${A_BEGIN}\noldA\n${A_END}\n\nuserMid\n\n${B_BEGIN}\noldB\n${B_END}\n`,
		};
		const results = await syncMany(files, "/hook", [A, B]);
		expect(tags(results)).toEqual(["Updated", "Updated"]);
		expect(files["/hook"]).toBe(`${A_SEC}\n\nuserMid\n\n${B_SEC}\n`);
	});

	it("scenario 4: normalizes out-of-order [B, A] to declared order [A, B]", async () => {
		const files = { "/hook": `${B_SEC}\n\n${A_SEC}\n` };
		const results = await syncMany(files, "/hook", [A, B]);
		// Content already matches, so the reorder reports Unchanged.
		expect(tags(results)).toEqual(["Unchanged", "Unchanged"]);
		expect(files["/hook"]).toBe(`${A_SEC}\n\n${B_SEC}\n`);
	});

	it("scenario 5: preserves an unrelated section and manages A, B in declared order", async () => {
		const files = { "/hook": `${X_SEC}\n` };
		const results = await syncMany(files, "/hook", [A, B]);
		expect(tags(results)).toEqual(["Created", "Created"]);
		expect(files["/hook"]).toContain(X_SEC);
		expect(files["/hook"]).toBe(`${X_SEC}\n\n${A_SEC}\n\n${B_SEC}\n`);
	});

	it("scenario 6: a second identical call is idempotent (all Unchanged, no rewrite)", async () => {
		const files: Record<string, string> = {};
		await syncMany(files, "/hook", [A, B]);
		const afterFirst = files["/hook"];
		const results = await syncMany(files, "/hook", [A, B]);
		expect(tags(results)).toEqual(["Unchanged", "Unchanged"]);
		expect(files["/hook"]).toBe(afterFirst);
	});

	// ── Robustness beyond the listed scenarios ───────────────────

	it("appends a missing block after its present predecessor when no later sibling exists", async () => {
		const files = { "/hook": `${A_SEC}\n` };
		const results = await syncMany(files, "/hook", [A, B]);
		expect(tags(results)).toEqual(["Unchanged", "Created"]);
		expect(files["/hook"]).toBe(`${A_SEC}\n\n${B_SEC}\n`);
	});

	it("reorders target sections around an unrelated section left in place", async () => {
		const files = { "/hook": `${B_SEC}\n\n${X_SEC}\n\n${A_SEC}\n` };
		const results = await syncMany(files, "/hook", [A, B]);
		expect(tags(results)).toEqual(["Unchanged", "Unchanged"]);
		expect(files["/hook"]).toBe(`${A_SEC}\n\n${X_SEC}\n\n${B_SEC}\n`);
	});

	it("works with the dual API (data-last)", async () => {
		const files: Record<string, string> = {};
		const results = await runWith(
			files,
			Effect.andThen(ManagedSection, (s) => s.syncMany([A, B])("/hook")),
		);
		expect(tags(results)).toEqual(["Created", "Created"]);
		expect(files["/hook"]).toBe(`${A_SEC}\n\n${B_SEC}\n`);
	});

	it("returns Updated with a diff when an existing section's content drifts", async () => {
		const files = { "/hook": `${A_BEGIN}\noldA\n${A_END}\n` };
		const results = await syncMany(files, "/hook", [A]);
		expect(results[0]._tag).toBe("Updated");
		if (results[0]._tag === "Updated") {
			expect(results[0].diff._tag).toBe("Changed");
		}
	});
});
