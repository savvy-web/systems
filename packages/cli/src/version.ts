/**
 * The package version, replaced at build time by the bundler's
 * `process.env.__PACKAGE_VERSION__` define; `0.0.0` in an unbuilt source run.
 * Kept in its own module so the process read stays at the front end's edge.
 *
 * @packageDocumentation
 */

/** @internal */
export const CLI_VERSION: string = process.env.__PACKAGE_VERSION__ ?? "0.0.0";
