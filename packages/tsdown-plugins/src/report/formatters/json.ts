// packages/tsdown-plugins/src/report/formatters/json.ts
import type { Formatter } from "./types.js";

/** @public */
export const JsonFormatter: Formatter = {
	format: "json",
	render: (reports) => [
		{ target: "stdout", content: JSON.stringify(reports, null, 2), contentType: "application/json" },
	],
};
