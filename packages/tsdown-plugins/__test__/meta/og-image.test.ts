import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OgGenerateError, resolveOgCacheSalt, writeGeneratedOgImage } from "../../src/meta/og-image.js";

/** A valid 1×1 opaque PNG. */
const PNG_1X1 = Uint8Array.from(
	Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
		"base64",
	),
);

/** A valid 1×1 baseline JPEG. */
const JPEG_1X1 = Uint8Array.from(
	Buffer.from(
		"/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
		"base64",
	),
);

const info = { name: "Pkg", packageName: "@scope/pkg", version: "1.0.0" };

describe("writeGeneratedOgImage", () => {
	it("writes og/<unscoped>.png under the meta dir and returns the sized image entry", async () => {
		const outMetaDir = mkdtempSync(join(tmpdir(), "og-"));
		const seen: Array<typeof info> = [];
		const image = await writeGeneratedOgImage({
			generate: async (i) => {
				seen.push(i);
				return PNG_1X1;
			},
			info,
			outMetaDir,
			unscopedName: "pkg",
		});
		expect(image).toEqual({ path: "og/pkg.png", type: "image/png", width: 1, height: 1 });
		expect(seen).toEqual([info]);
		expect(readFileSync(join(outMetaDir, "og", "pkg.png"))).toEqual(Buffer.from(PNG_1X1));
	});

	it("rejects an empty buffer with OgGenerateError and writes nothing", async () => {
		const outMetaDir = mkdtempSync(join(tmpdir(), "og-"));
		await expect(
			writeGeneratedOgImage({ generate: async () => new Uint8Array(0), info, outMetaDir, unscopedName: "pkg" }),
		).rejects.toBeInstanceOf(OgGenerateError);
		expect(existsSync(join(outMetaDir, "og"))).toBe(false);
	});

	it("wraps a throwing generator, preserving the cause and naming the package", async () => {
		const outMetaDir = mkdtempSync(join(tmpdir(), "og-"));
		const cause = new Error("renderer exploded");
		const err = await writeGeneratedOgImage({
			generate: async () => {
				throw cause;
			},
			info,
			outMetaDir,
			unscopedName: "pkg",
		}).catch((e: unknown) => e);
		expect(err).toBeInstanceOf(OgGenerateError);
		expect((err as OgGenerateError).cause).toBe(cause);
		expect((err as OgGenerateError).packageName).toBe("@scope/pkg");
		expect((err as OgGenerateError).message).toContain("renderer exploded");
	});

	it("rejects an image type Open Graph consumers cannot render instead of mislabeling it", async () => {
		const outMetaDir = mkdtempSync(join(tmpdir(), "og-"));
		// A 1×1 GIF: a readable image, but outside the formats Open Graph consumers render.
		const gif = Uint8Array.from(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));
		const err = await writeGeneratedOgImage({ generate: async () => gif, info, outMetaDir, unscopedName: "pkg" }).catch(
			(e: unknown) => e,
		);
		expect(err).toBeInstanceOf(OgGenerateError);
		expect((err as OgGenerateError).message).toContain("gif");
		expect(existsSync(join(outMetaDir, "og"))).toBe(false);
	});

	it("wraps a filesystem failure on the write as OgGenerateError", async () => {
		// A regular FILE where the meta dir should be: mkdirSync("<file>/og") fails with ENOTDIR.
		const parent = mkdtempSync(join(tmpdir(), "og-"));
		const outMetaDir = join(parent, "not-a-dir");
		writeFileSync(outMetaDir, "");
		const err = await writeGeneratedOgImage({
			generate: async () => PNG_1X1,
			info,
			outMetaDir,
			unscopedName: "pkg",
		}).catch((e: unknown) => e);
		expect(err).toBeInstanceOf(OgGenerateError);
		expect(((err as OgGenerateError).cause as NodeJS.ErrnoException).code).toMatch(/ENOTDIR|EEXIST/);
	});

	it("rejects bytes that are not an image", async () => {
		const outMetaDir = mkdtempSync(join(tmpdir(), "og-"));
		await expect(
			writeGeneratedOgImage({
				generate: async () => new TextEncoder().encode("definitely not an image"),
				info,
				outMetaDir,
				unscopedName: "pkg",
			}),
		).rejects.toBeInstanceOf(OgGenerateError);
	});

	it("writes a JPEG under the .jpg extension with its image/jpeg MIME type", async () => {
		const outMetaDir = mkdtempSync(join(tmpdir(), "og-"));
		const image = await writeGeneratedOgImage({
			generate: async () => JPEG_1X1,
			info,
			outMetaDir,
			unscopedName: "pkg",
		});
		expect(image).toEqual({ path: "og/pkg.jpg", type: "image/jpeg", width: 1, height: 1 });
		expect(existsSync(join(outMetaDir, "og", "pkg.jpg"))).toBe(true);
	});
});

describe("writeGeneratedOgImage with a cache", () => {
	const counting = () => {
		let calls = 0;
		return {
			generate: async () => {
				calls++;
				return PNG_1X1;
			},
			calls: () => calls,
		};
	};

	it("reuses the stored render for the same info and salt, still writing the output copy", async () => {
		const directory = mkdtempSync(join(tmpdir(), "og-cache-"));
		const gen = counting();
		const first = await writeGeneratedOgImage({
			generate: gen.generate,
			info,
			outMetaDir: mkdtempSync(join(tmpdir(), "og-")),
			unscopedName: "pkg",
			cache: { directory, salt: "v1" },
		});
		const outMetaDir = mkdtempSync(join(tmpdir(), "og-"));
		const second = await writeGeneratedOgImage({
			generate: gen.generate,
			info,
			outMetaDir,
			unscopedName: "pkg",
			cache: { directory, salt: "v1" },
		});
		expect(gen.calls()).toBe(1);
		expect(second).toEqual(first);
		expect(readFileSync(join(outMetaDir, "og", "pkg.png"))).toEqual(Buffer.from(PNG_1X1));
	});

	it("misses when the salt or the info changes", async () => {
		const directory = mkdtempSync(join(tmpdir(), "og-cache-"));
		const gen = counting();
		const run = (salt: string, version: string) =>
			writeGeneratedOgImage({
				generate: gen.generate,
				info: { ...info, version },
				outMetaDir: mkdtempSync(join(tmpdir(), "og-")),
				unscopedName: "pkg",
				cache: { directory, salt },
			});
		await run("v1", "1.0.0");
		await run("v2", "1.0.0");
		await run("v2", "1.0.1");
		await run("v2", "1.0.1");
		expect(gen.calls()).toBe(3);
	});

	it("keys info whose optional fields are present but undefined", async () => {
		const directory = mkdtempSync(join(tmpdir(), "og-cache-"));
		const gen = counting();
		const sparse = { ...info, tagline: undefined, description: undefined, project: undefined };
		for (let i = 0; i < 2; i++) {
			await writeGeneratedOgImage({
				generate: gen.generate,
				info: sparse,
				outMetaDir: mkdtempSync(join(tmpdir(), "og-")),
				unscopedName: "pkg",
				cache: { directory, salt: "v1" },
			});
		}
		expect(gen.calls()).toBe(1);
	});

	it("never stores a rejected render", async () => {
		const directory = mkdtempSync(join(tmpdir(), "og-cache-"));
		await expect(
			writeGeneratedOgImage({
				generate: async () => new Uint8Array(0),
				info,
				outMetaDir: mkdtempSync(join(tmpdir(), "og-")),
				unscopedName: "pkg",
				cache: { directory, salt: "v1" },
			}),
		).rejects.toBeInstanceOf(OgGenerateError);
		expect(readdirSync(directory)).toEqual([]);
	});
});

describe("resolveOgCacheSalt", () => {
	const plain = async () => PNG_1X1;
	const salted = Object.assign(async () => PNG_1X1, { cacheSalt: "builtin" });

	it("uses an explicit string over the generator's own salt", () => {
		expect(resolveOgCacheSalt(salted, "mine")).toBe("mine");
		expect(resolveOgCacheSalt(plain, "mine")).toBe("mine");
	});

	it("falls back to the generator's own salt when none is configured", () => {
		expect(resolveOgCacheSalt(salted, undefined)).toBe("builtin");
	});

	it("does not cache a generator with no salt of its own unless configured", () => {
		expect(resolveOgCacheSalt(plain, undefined)).toBeUndefined();
	});

	it("disables the cache with false, even for a salted generator", () => {
		expect(resolveOgCacheSalt(salted, false)).toBeUndefined();
	});
});
