// packages/tsdown-plugins/src/report/layers/FormatSelectorLive.ts
import { Effect, Layer } from "effect";
import type { OutputFormat } from "../services/FormatSelector.js";
import { FormatSelector } from "../services/FormatSelector.js";

export const FormatSelectorLive = Layer.succeed(FormatSelector, {
	select: (executor, explicit, env) =>
		Effect.succeed<OutputFormat>(
			explicit ??
				(env === "ci-github" && executor === "ci"
					? "ci-annotations"
					: executor === "agent"
						? "markdown"
						: executor === "ci"
							? "json"
							: "terminal"),
		),
});
