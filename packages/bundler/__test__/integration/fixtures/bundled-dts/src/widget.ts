import type { DeepWidget } from "./types.js";

export const makeWidget = (size: number): DeepWidget => ({ kind: "deep-widget", size });
