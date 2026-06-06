// Root entry re-exports the deep type + a runtime helper from a sub-module.
// Per-module JS must keep widget.js as a sibling; the bundled dts must inline
// the DeepWidget declaration into index.d.ts (no reference to ./types).
export type { DeepWidget } from "./types.js";
export { makeWidget } from "./widget.js";
