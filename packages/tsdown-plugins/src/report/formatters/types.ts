// packages/tsdown-plugins/src/report/formatters/types.ts
import type { BuildReport } from "../schema.js";

export interface RenderedOutput {
	readonly target: "stdout" | "file" | "github-summary";
	readonly content: string;
	readonly contentType: string;
}

export interface FormatterContext {
	readonly noColor: boolean;
	readonly verbose: boolean;
}

export interface Formatter {
	readonly format: string;
	readonly render: (reports: ReadonlyArray<BuildReport>, ctx: FormatterContext) => ReadonlyArray<RenderedOutput>;
}
