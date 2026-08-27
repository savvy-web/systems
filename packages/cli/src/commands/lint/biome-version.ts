/**
 * Pinned Biome version targeted by the lint schema-sync commands.
 *
 * @internal
 */

/**
 * The Biome release whose JSON schema URL `savvy lint`/`savvy check` write into and
 * validate against the repo's `biome.json`/`biome.jsonc` files.
 *
 * @remarks
 * Hardcoded on purpose. `@biomejs/biome` is an optional peer dependency of
 * `@savvy-web/silk`, so there is no reliable runtime source for the consumer's
 * installed Biome version, and the `$schema` URL must point at a concrete release.
 *
 * Keep this in lockstep with the `@biomejs/biome` peer-dependency range in
 * `packages/silk/package.json` whenever Biome is upgraded — bump this to the exact
 * release and the peer range to its minor line.
 *
 * @internal
 */
export const BIOME_VERSION = "2.5.10";
