import type { OpenGraphImage, RegistryRef } from "@tsdoctor/manifest";

/**
 * What an Open Graph image generator receives: the merged identity of the
 * package being built, after the config, leaf and project tiers resolved.
 *
 * @public
 */
export interface OgImageInfo {
	/** Display name — the merged `name`, falling back to the npm name. */
	readonly name: string;
	/** The npm package name. */
	readonly packageName: string;
	/** The emitted version (the optimistic next version when enabled). */
	readonly version: string;
	readonly tagline?: string | undefined;
	readonly description?: string | undefined;
	/** The inherited project tier, when the workspace root declares one. */
	readonly project?: { readonly name?: string | undefined; readonly tagline?: string | undefined } | undefined;
}

/**
 * The `meta.tsdoctor` block: the CONFIG tier of the emitted `tsdoctor.json`,
 * ranked over the package's `tsdoctor.json` (leaf) and the workspace root's
 * (project).
 *
 * @public
 */
export interface TsdoctorMetaOptions {
	readonly name?: string | undefined;
	readonly tagline?: string | undefined;
	readonly description?: string | undefined;
	readonly openGraph?:
		| {
				/** Static images, path (bundle-relative) or url. Listed after a generated image. */
				readonly images?: ReadonlyArray<OpenGraphImage> | undefined;
				readonly themeColor?: string | undefined;
				/** Render an image at build time; the bytes are written to `meta/og/<unscoped>.png` and listed first. */
				readonly generate?: ((info: OgImageInfo) => Promise<Uint8Array>) | undefined;
		  }
		| undefined;
	/** Registries; `false` disables the default derived from `targets.json`. */
	readonly registries?: ReadonlyArray<RegistryRef> | false | undefined;
}
