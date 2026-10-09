import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import type { ImageFormat } from "@effected/images";
import { ImageBackend, ImageCache, ImageCacheKey } from "@effected/images/cache";
import type { OpenGraphImage } from "@tsdoctor/manifest";
import { Data, Effect, Layer, Result, Schema } from "effect";
import type { OgImageGenerator, OgImageInfo } from "./tsdoctor-config.js";

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
const ACCEPT = ["png", "jpeg", "webp"] as const satisfies ReadonlyArray<ImageFormat>;

/** The cache key's params: exactly what the generator receives, so any change to its input is a miss. */
const OgImageInfoKey = Schema.Struct({
	name: Schema.String,
	packageName: Schema.String,
	version: Schema.String,
	tagline: Schema.optional(Schema.String),
	description: Schema.optional(Schema.String),
	project: Schema.optional(
		Schema.Struct({ name: Schema.optional(Schema.String), tagline: Schema.optional(Schema.String) }),
	),
});

/**
 * Where generated images persist across builds, and the salt naming the generator's identity.
 *
 * @public
 */
export interface OgImageCacheOptions {
	readonly directory: string;
	/** Change it whenever the generator's output changes for the same input; the cache cannot see code. */
	readonly salt: string;
}

/**
 * The salt the cross-build cache runs under, or `undefined` to always regenerate: an explicit
 * `cacheSalt` string wins, `false` disables, and otherwise the generator's own salt applies.
 *
 * @public
 */
export function resolveOgCacheSalt(
	generate: OgImageGenerator,
	cacheSalt: string | false | undefined,
): string | undefined {
	if (cacheSalt === false) return undefined;
	return cacheSalt ?? generate.cacheSalt;
}

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
	/** Reuse a previous build's image for the same info and salt; omitted, the generator always runs. */
	readonly cache?: OgImageCacheOptions | undefined;
}

/**
 * Run the generator (or reuse a cached render), size the bytes, and write `og/<unscoped>.<ext>`
 * under the meta dir. Returns the manifest image entry (bundle-relative path, MIME type, dimensions).
 *
 * @public
 */
export async function writeGeneratedOgImage(options: WriteGeneratedOgImageOptions): Promise<OpenGraphImage> {
	const { packageName } = options.info;
	const backend =
		options.cache === undefined
			? ImageBackend.layerNone
			: ImageBackend.layerDirectory({ directory: options.cache.directory });
	const result = await Effect.gen(function* () {
		const key = yield* ImageCacheKey.fromParams(OgImageInfoKey, options.info, {
			salt: options.cache?.salt ?? "",
			namespace: "og",
		});
		const cache = yield* ImageCache;
		return yield* cache.getOrGenerate(
			key,
			() => Effect.tryPromise({ try: () => options.generate(options.info), catch: (cause) => cause }),
			{ accept: ACCEPT },
		);
	}).pipe(
		Effect.provide(ImageCache.layer.pipe(Layer.provide(backend), Layer.provideMerge(NodeServices.layer))),
		Effect.result,
		Effect.runPromise,
	);
	if (Result.isFailure(result)) {
		throw new OgGenerateError({ packageName, cause: result.failure });
	}
	const { bytes, facts } = result.success;
	const relative = `og/${options.unscopedName}.${facts.extension}`;
	try {
		mkdirSync(join(options.outMetaDir, "og"), { recursive: true });
		writeFileSync(join(options.outMetaDir, relative), bytes);
	} catch (cause) {
		// A read-only or full disk is still an OG failure as far as issues.json is concerned.
		throw new OgGenerateError({ packageName, cause });
	}
	return { path: relative, type: facts.mimeType, width: facts.width, height: facts.height };
}
