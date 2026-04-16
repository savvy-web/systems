import { Data } from "effect";

/**
 * Raised when workspace analysis fails for a given root directory.
 *
 * @remarks
 * Returned by {@link SilkWorkspaceAnalyzer.analyze} when the analysis pipeline
 * encounters an unrecoverable error — e.g. workspace discovery failure,
 * package manager detection failure, or publishability detection errors.
 *
 * @since 0.2.0
 */
export class WorkspaceAnalysisError extends Data.TaggedError("WorkspaceAnalysisError")<{
	readonly root: string;
	readonly reason: string;
}> {
	get message(): string {
		return `Workspace analysis failed at ${this.root}: ${this.reason}`;
	}
}
