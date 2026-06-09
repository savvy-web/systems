// Re-exported so a custom `transform` can call the default stripping it replaces.
export { defaultManifestTransform } from "@savvy-web/tsdown-plugins";
export type { BuildConfig, BuildConfigInput, BuildEntryOverride, OutputConfig, ParsedArgs } from "./config.js";
export { defineBuild, parseArgs } from "./config.js";
export type { RunOptions } from "./run.js";
export { runBuild } from "./run.js";
