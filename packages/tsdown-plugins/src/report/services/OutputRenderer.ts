// packages/tsdown-plugins/src/report/services/OutputRenderer.ts
import { Context, Effect, Layer } from "effect";
import type { Formatter } from "../formatters/index.js";
import {
	CiAnnotationsFormatter,
	JsonFormatter,
	MarkdownFormatter,
	SilentFormatter,
	TerminalFormatter,
} from "../formatters/index.js";
import type { FormatterContext, RenderedOutput } from "../formatters/types.js";
import type { BuildReport } from "../schema.js";
import type { OutputFormat } from "./FormatSelector.js";

const formatters = new Map<string, Formatter>([
	["terminal", TerminalFormatter],
	["json", JsonFormatter],
	["markdown", MarkdownFormatter],
	["ci-annotations", CiAnnotationsFormatter],
	["silent", SilentFormatter],
]);

/** @public */
export class OutputRenderer extends Context.Service<
	OutputRenderer,
	{
		readonly render: (
			reports: ReadonlyArray<BuildReport>,
			format: OutputFormat,
			ctx: FormatterContext,
		) => Effect.Effect<ReadonlyArray<RenderedOutput>>;
	}
>()("@savvy-web/tsdown-plugins/OutputRenderer") {
	static readonly layer: Layer.Layer<OutputRenderer> = Layer.succeed(this, {
		render: (reports, format, ctx) =>
			Effect.sync(() => {
				const f = formatters.get(format);
				return f ? f.render(reports, ctx) : [];
			}),
	});
}
