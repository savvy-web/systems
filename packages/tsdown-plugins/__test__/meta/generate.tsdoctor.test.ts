import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decodeBundleManifest } from "@tsdoctor/manifest";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { TsdoctorEmitError } from "../../src/errors.js";
import type { GenerateMetaOptions } from "../../src/meta/generate.js";
import { generateMeta } from "../../src/meta/generate.js";

/** A valid 1×1 opaque PNG. */
const PNG_1X1 = Uint8Array.from(
	Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
		"base64",
	),
);

function scaffold(pkg: Record<string, unknown>): { cwd: string; dtsDir: string; outMetaDir: string } {
	const cwd = mkdtempSync(join(tmpdir(), "meta-tsdoctor-"));
	writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "@scope/fixture", version: "1.0.0" }));
	writeFileSync(
		join(cwd, "tsconfig.json"),
		JSON.stringify({
			compilerOptions: {
				target: "ESNext",
				module: "ESNext",
				moduleResolution: "bundler",
				declaration: true,
				skipLibCheck: true,
				types: [],
			},
			include: [join(cwd, "**/*.d.ts")],
		}),
	);
	const dtsDir = join(cwd, "dist", "prod", "npm", "pkg");
	mkdirSync(dtsDir, { recursive: true });
	writeFileSync(join(dtsDir, "index.d.ts"), "/** @public */\nexport interface Public { y: number }\n");
	writeFileSync(join(dtsDir, "package.json"), JSON.stringify({ name: "@scope/fixture", version: "1.0.0", ...pkg }));
	mkdirSync(join(cwd, "models-a"), { recursive: true });
	mkdirSync(join(cwd, "models-b"), { recursive: true });
	return { cwd, dtsDir, outMetaDir: join(cwd, "dist", "prod", "npm", "meta") };
}

function baseOptions(s: ReturnType<typeof scaffold>): GenerateMetaOptions {
	return {
		cwd: s.cwd,
		packageName: "@scope/fixture",
		tsconfigPath: join(s.cwd, "tsconfig.json"),
		dtsDir: s.dtsDir,
		entries: { index: "index" },
		exportPaths: { index: "." },
		outMetaDir: s.outMetaDir,
		localPaths: ["models-a", "models-b"],
		tsdoc: { suppressWarnings: [], tagDefinitions: [] },
		onMessage: () => {},
	};
}

async function decodeAt(path: string): Promise<unknown> {
	return Effect.runPromise(decodeBundleManifest(JSON.parse(readFileSync(path, "utf-8"))));
}

// Every case here runs a real API Extractor pass (about 1.5s locally, slower on CI runners), and the
// stale-cleanup case runs three, so the 5s default is too tight for the suite.
describe("generateMeta tsdoctor sidecar", { timeout: 60_000 }, () => {
	it("writes tsdoctor.json for a private package from config and project tiers and copies it to localPaths", async () => {
		const s = scaffold({ private: true });
		await generateMeta({
			...baseOptions(s),
			tsdoctor: { config: { name: "Fixture" }, leaf: undefined, project: { name: "Proj" }, targets: [] },
		});
		const expected = { spec: 1, name: "Fixture", project: { name: "Proj" } };
		expect(await decodeAt(join(s.outMetaDir, "tsdoctor.json"))).toEqual(expected);
		expect(await decodeAt(join(s.cwd, "models-a", "tsdoctor.json"))).toEqual(expected);
		expect(await decodeAt(join(s.cwd, "models-b", "tsdoctor.json"))).toEqual(expected);
		expect(existsSync(join(s.outMetaDir, "og"))).toBe(false);
	});

	it("derives registries from the group's targets and the emitted repository for a public package", async () => {
		const s = scaffold({ private: false, repository: { type: "git", url: "git+https://github.com/o/r.git" } });
		await generateMeta({
			...baseOptions(s),
			tsdoctor: {
				config: undefined,
				leaf: undefined,
				project: undefined,
				targets: [
					{ name: "npm", registry: "https://registry.npmjs.org" },
					{ name: "github", registry: "https://npm.pkg.github.com" },
				],
			},
		});
		expect(await decodeAt(join(s.outMetaDir, "tsdoctor.json"))).toEqual({
			spec: 1,
			registries: [
				{ type: "npm", name: "npm", url: "https://www.npmjs.com/package/@scope/fixture" },
				{ type: "npm", name: "github", url: "https://github.com/o/r/pkgs/npm/fixture" },
			],
		});
	});

	it("renders the generated image first, writes it beside the manifest, and copies it to localPaths", async () => {
		const s = scaffold({ private: true });
		const seen: Array<{ name: string; version: string }> = [];
		await generateMeta({
			...baseOptions(s),
			manifestTransform: (p) => ({ ...p, version: "2.0.0" }),
			tsdoctor: {
				config: {
					openGraph: {
						images: [{ url: "https://example.com/og.png" }],
						generate: async (info) => {
							seen.push({ name: info.name, version: info.version });
							return PNG_1X1;
						},
					},
				},
				leaf: { tagline: "leaf tag" },
				project: undefined,
				targets: [],
			},
		});
		// The generator sees the transformed (optimistic) version, not the built one.
		expect(seen).toEqual([{ name: "@scope/fixture", version: "2.0.0" }]);
		expect(await decodeAt(join(s.outMetaDir, "tsdoctor.json"))).toEqual({
			spec: 1,
			tagline: "leaf tag",
			openGraph: {
				images: [
					{ path: "og/fixture.png", type: "image/png", width: 1, height: 1 },
					{ url: "https://example.com/og.png" },
				],
			},
		});
		for (const dir of [s.outMetaDir, join(s.cwd, "models-a"), join(s.cwd, "models-b")]) {
			expect(readFileSync(join(dir, "og", "fixture.png"))).toEqual(Buffer.from(PNG_1X1));
		}
	});

	it("writes no sidecar and no og/ when tsdoctor is undefined", async () => {
		const s = scaffold({ private: true });
		await generateMeta(baseOptions(s));
		expect(existsSync(join(s.outMetaDir, "tsdoctor.json"))).toBe(false);
		expect(existsSync(join(s.outMetaDir, "og"))).toBe(false);
		expect(existsSync(join(s.cwd, "models-a", "tsdoctor.json"))).toBe(false);
	});

	it("removes a previous build's sidecar and og/ from the meta dir and every localPaths copy", async () => {
		const s = scaffold({ private: true });
		const withImage = {
			config: { name: "Fixture", openGraph: { generate: async () => PNG_1X1 } },
			leaf: undefined,
			project: undefined,
			targets: [],
		};
		await generateMeta({ ...baseOptions(s), tsdoctor: withImage });
		for (const dir of [s.outMetaDir, join(s.cwd, "models-a"), join(s.cwd, "models-b")]) {
			expect(existsSync(join(dir, "tsdoctor.json")), dir).toBe(true);
			expect(existsSync(join(dir, "og", "fixture.png")), dir).toBe(true);
		}
		// Same package, generator dropped: the image must disappear everywhere while the manifest stays.
		await generateMeta({ ...baseOptions(s), tsdoctor: { ...withImage, config: { name: "Fixture" } } });
		for (const dir of [s.outMetaDir, join(s.cwd, "models-a"), join(s.cwd, "models-b")]) {
			expect(await decodeAt(join(dir, "tsdoctor.json"))).toEqual({ spec: 1, name: "Fixture" });
			expect(existsSync(join(dir, "og")), dir).toBe(false);
		}
		// Identity dropped too: nothing to say, so the stale sidecar goes as well.
		await generateMeta(baseOptions(s));
		for (const dir of [s.outMetaDir, join(s.cwd, "models-a"), join(s.cwd, "models-b")]) {
			expect(existsSync(join(dir, "tsdoctor.json")), dir).toBe(false);
			expect(existsSync(join(dir, "fixture.api.json")), dir).toBe(true);
		}
	});

	it("wraps a sidecar that fails to encode as TsdoctorEmitError naming the path", async () => {
		const s = scaffold({ private: true });
		// A leaf image with neither path nor url violates the schema's XOR; the composer passes it
		// through untouched, so encodeBundleManifest is what rejects it — inside generateMeta's wrapper.
		const err = await generateMeta({
			...baseOptions(s),
			tsdoctor: {
				config: undefined,
				leaf: { openGraph: { images: [{} as { url: string }] } },
				project: undefined,
				targets: [],
			},
		}).catch((e: unknown) => e);
		expect(err).toBeInstanceOf(TsdoctorEmitError);
		expect((err as TsdoctorEmitError).path).toBe(join(s.outMetaDir, "tsdoctor.json"));
		expect((err as TsdoctorEmitError).packageName).toBe("@scope/fixture");
		expect(existsSync(join(s.outMetaDir, "tsdoctor.json"))).toBe(false);
	});

	it("wraps a sidecar write that fails on disk as TsdoctorEmitError", async () => {
		const s = scaffold({ private: true });
		// The generator runs after the api-model trio is written and before the sidecar write, so it is
		// the one seam where the meta dir can be made read-only without failing an earlier write. The
		// og/ dir is created first (writable itself) so the image write still succeeds.
		try {
			const err = await generateMeta({
				...baseOptions(s),
				tsdoctor: {
					config: {
						name: "Fixture",
						openGraph: {
							generate: async () => {
								mkdirSync(join(s.outMetaDir, "og"), { recursive: true });
								chmodSync(s.outMetaDir, 0o555);
								return PNG_1X1;
							},
						},
					},
					leaf: undefined,
					project: undefined,
					targets: [],
				},
			}).catch((e: unknown) => e);
			expect(err).toBeInstanceOf(TsdoctorEmitError);
			expect((err as TsdoctorEmitError).path).toBe(join(s.outMetaDir, "tsdoctor.json"));
			expect(((err as TsdoctorEmitError).cause as NodeJS.ErrnoException).code).toBe("EACCES");
		} finally {
			chmodSync(s.outMetaDir, 0o755);
		}
	});

	it("writes no sidecar when the tiers are empty and the package is private", async () => {
		const s = scaffold({ private: true });
		await generateMeta({
			...baseOptions(s),
			tsdoctor: { config: undefined, leaf: undefined, project: undefined, targets: [] },
		});
		expect(existsSync(join(s.outMetaDir, "tsdoctor.json"))).toBe(false);
	});
});
