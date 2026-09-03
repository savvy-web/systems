import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { OpenGraphImage } from "@tsdoctor/manifest";
import { imageSize } from "image-size";
import type { OgImageInfo } from "./tsdoctor-config.js";

/**
 * A configured `openGraph.generate` renderer threw, returned no bytes, or returned bytes that are
 * not an image. Fails the build: a half-written OG image is worse than none.
 *
 * @public
 */
export class OgGenerateError extends Error {
	override readonly name = "OgGenerateError";
	constructor(
		readonly packageName: string,
		readonly cause: unknown,
	) {
		super(
			`Open Graph image generation failed for ${packageName}: ${cause instanceof Error ? cause.message : String(cause)}`,
		);
	}
}

const MIME_BY_TYPE: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

/**
 * Options for {@link writeGeneratedOgImage}.
 *
 * @public
 */
export interface WriteGeneratedOgImageOptions {
	readonly generate: (info: OgImageInfo) => Promise<Uint8Array>;
	readonly info: OgImageInfo;
	/** The meta bundle dir; the image lands at `og/<unscopedName>.<ext>` beneath it. */
	readonly outMetaDir: string;
	readonly unscopedName: string;
}

/**
 * Run the generator, size the bytes, and write `og/<unscoped>.<ext>` under the meta dir. Returns the
 * manifest image entry (bundle-relative path, MIME type, dimensions).
 *
 * @public
 */
export async function writeGeneratedOgImage(options: WriteGeneratedOgImageOptions): Promise<OpenGraphImage> {
	let bytes: Uint8Array;
	try {
		bytes = await options.generate(options.info);
	} catch (cause) {
		throw new OgGenerateError(options.info.packageName, cause);
	}
	if (bytes.byteLength === 0) {
		throw new OgGenerateError(options.info.packageName, new Error("generator returned no bytes"));
	}
	let size: ReturnType<typeof imageSize>;
	try {
		size = imageSize(bytes);
	} catch (cause) {
		throw new OgGenerateError(options.info.packageName, cause);
	}
	const ext = size.type === "jpg" ? "jpg" : (size.type ?? "png");
	const relative = `og/${options.unscopedName}.${ext}`;
	mkdirSync(join(options.outMetaDir, "og"), { recursive: true });
	writeFileSync(join(options.outMetaDir, relative), bytes);
	return { path: relative, type: MIME_BY_TYPE[ext] ?? "image/png", width: size.width, height: size.height };
}
