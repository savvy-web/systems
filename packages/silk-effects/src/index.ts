/**
 * `@savvy-web/silk-effects` — shared Effect library for Silk Suite conventions.
 *
 * @remarks
 * Platform-agnostic Effect services for publishability detection, versioning strategy,
 * tag strategy, managed sections, config discovery, and Biome schema synchronization.
 * Consumers provide their platform layer (NodeContext, BunContext, etc.).
 *
 * @packageDocumentation
 */

export * from "./biome/index.js";
export * from "./config/index.js";
export * from "./hooks/index.js";
export * from "./publish/index.js";
export * from "./tags/index.js";
export * from "./versioning/index.js";
