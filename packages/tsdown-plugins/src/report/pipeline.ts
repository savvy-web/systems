// packages/tsdown-plugins/src/report/pipeline.ts
import { Effect, Layer } from "effect";
import type { RenderedOutput } from "./formatters/types.js";
import { EnvironmentDetectorLive } from "./layers/EnvironmentDetectorLive.js";
import { ExecutorResolverLive } from "./layers/ExecutorResolverLive.js";
import { FormatSelectorLive } from "./layers/FormatSelectorLive.js";
import { OutputRendererLive } from "./layers/OutputRendererLive.js";
import type { BuildReport } from "./schema.js";
import type { Environment } from "./services/EnvironmentDetector.js";
import { EnvironmentDetector } from "./services/EnvironmentDetector.js";
import { ExecutorResolver } from "./services/ExecutorResolver.js";
import type { OutputFormat } from "./services/FormatSelector.js";
import { FormatSelector } from "./services/FormatSelector.js";
import { OutputRenderer } from "./services/OutputRenderer.js";

export const ReportPipelineLive = Layer.mergeAll(
	EnvironmentDetectorLive,
	ExecutorResolverLive,
	FormatSelectorLive,
	OutputRendererLive,
);

export interface RenderReportOptions {
	readonly explicitFormat?: OutputFormat;
	/** Override env detection (mainly for tests). */
	readonly env?: Environment;
	readonly noColor: boolean;
}

export const renderReport = (
	reports: ReadonlyArray<BuildReport>,
	options: RenderReportOptions,
): Effect.Effect<
	ReadonlyArray<RenderedOutput>,
	never,
	EnvironmentDetector | ExecutorResolver | FormatSelector | OutputRenderer
> =>
	Effect.gen(function* () {
		const detector = yield* EnvironmentDetector;
		const executorResolver = yield* ExecutorResolver;
		const formatSelector = yield* FormatSelector;
		const renderer = yield* OutputRenderer;
		const env = options.env ?? (yield* detector.detect());
		const executor = yield* executorResolver.resolve(env);
		const format = yield* formatSelector.select(executor, options.explicitFormat, env);
		return yield* renderer.render(reports, format, { noColor: options.noColor });
	});
