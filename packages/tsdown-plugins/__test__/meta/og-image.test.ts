import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OgGenerateError, writeGeneratedOgImage } from "../../src/meta/og-image.js";

/** A valid 1×1 opaque PNG. */
const PNG_1X1 = Uint8Array.from(
	Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
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
		// A minimal GIF header: image-size detects it as "gif", which has no Open Graph MIME mapping.
		const gif = Uint8Array.from(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));
		const err = await writeGeneratedOgImage({ generate: async () => gif, info, outMetaDir, unscopedName: "pkg" }).catch(
			(e: unknown) => e,
		);
		expect(err).toBeInstanceOf(OgGenerateError);
		expect((err as OgGenerateError).message).toContain("gif");
		expect(existsSync(join(outMetaDir, "og"))).toBe(false);
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
});
