import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { OpenGraphImage } from "@tsdoctor/manifest";
import { Data } from "effect";
import { imageSize } from "image-size";
import type { OgImageInfo } from "./tsdoctor-config.js";

/**
 * A configured `openGraph.generate` renderer threw, returned no bytes, or returned bytes that are
 * not an image. Fails the build: a half-written OG image is worse than none.
 *
 * @public
 */
export class OgGenerateError extends Data.TaggedError("OgGenerateError")<{
	readonly packageName: string;
	readonly cause: unknown;
}> {
	get message(): string {
		const reason = this.cause instanceof Error ? this.cause.message : String(this.cause);
		return `Open Graph image generation failed for ${this.packageName}: ${reason}`;
	}
}

/** The image types an Open Graph consumer can render; anything else fails rather than shipping a mislabeled file. */
const MIME_BY_TYPE: Readonly<Record<string, string>> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

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
		throw new OgGenerateError({ packageName: options.info.packageName, cause });
	}
	if (bytes.byteLength === 0) {
		throw new OgGenerateError({
			packageName: options.info.packageName,
			cause: new Error("generator returned no bytes"),
		});
	}
	let size: ReturnType<typeof imageSize>;
	try {
		size = imageSize(bytes);
	} catch (cause) {
		throw new OgGenerateError({ packageName: options.info.packageName, cause });
	}
	const ext = size.type ?? "png";
	const type = MIME_BY_TYPE[ext];
	if (type === undefined) {
		throw new OgGenerateError({
			packageName: options.info.packageName,
			cause: new Error(`generator returned a ${ext} image; Open Graph images must be png, jpg or webp`),
		});
	}
	const relative = `og/${options.unscopedName}.${ext}`;
	try {
		mkdirSync(join(options.outMetaDir, "og"), { recursive: true });
		writeFileSync(join(options.outMetaDir, relative), bytes);
	} catch (cause) {
		// A read-only or full disk is still an OG failure as far as issues.json is concerned.
		throw new OgGenerateError({ packageName: options.info.packageName, cause });
	}
	return { path: relative, type, width: size.width, height: size.height };
}
