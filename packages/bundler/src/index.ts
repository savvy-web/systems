// Re-exported so a custom `transform` can call the default stripping it replaces.

export type { AmbientDtsEntry } from "@savvy-web/tsdown-plugins";
export { defaultManifestTransform, extractAmbientDts } from "@savvy-web/tsdown-plugins";
export type { BuildConfig, BuildConfigInput, BuildEntryOverride, OutputConfig, ParsedArgs, Plugin } from "./config.js";
export { defineBuild, parseArgs } from "./config.js";
export type { RunOptions } from "./run.js";
export { build, runBuild } from "./run.js";
