// packages/tsdown-plugins/src/report/services/OutputRenderer.ts
import type { Effect } from "effect";
import { Context } from "effect";
import type { FormatterContext, RenderedOutput } from "../formatters/types.js";
import type { BuildReport } from "../schema.js";
import type { OutputFormat } from "./FormatSelector.js";

export class OutputRenderer extends Context.Tag("@savvy-web/tsdown-plugins/OutputRenderer")<
	OutputRenderer,
	{
		readonly render: (
			reports: ReadonlyArray<BuildReport>,
			format: OutputFormat,
			ctx: FormatterContext,
		) => Effect.Effect<ReadonlyArray<RenderedOutput>>;
	}
>() {}
