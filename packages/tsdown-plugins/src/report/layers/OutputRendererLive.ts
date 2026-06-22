// packages/tsdown-plugins/src/report/layers/OutputRendererLive.ts
import { Effect, Layer } from "effect";
import type { Formatter } from "../formatters/index.js";
import {
	CiAnnotationsFormatter,
	JsonFormatter,
	MarkdownFormatter,
	SilentFormatter,
	TerminalFormatter,
} from "../formatters/index.js";
import { OutputRenderer } from "../services/OutputRenderer.js";

const formatters = new Map<string, Formatter>([
	["terminal", TerminalFormatter],
	["json", JsonFormatter],
	["markdown", MarkdownFormatter],
	["ci-annotations", CiAnnotationsFormatter],
	["silent", SilentFormatter],
]);

/** @public */
export const OutputRendererLive = Layer.succeed(OutputRenderer, {
	render: (reports, format, ctx) =>
		Effect.sync(() => {
			const f = formatters.get(format);
			return f ? f.render(reports, ctx) : [];
		}),
});
