import { Data } from "effect";

/** Entry derivation from package.json failed. */
export class EntryDetectionError extends Data.TaggedError("EntryDetectionError")<{
	readonly reason: string;
}> {
	get message(): string {
		return `Entry detection failed: ${this.reason}`;
	}
}

/** Emitting the transformed manifest failed. */
export class ManifestEmitError extends Data.TaggedError("ManifestEmitError")<{
	readonly reason: string;
}> {
	get message(): string {
		return `Manifest emit failed: ${this.reason}`;
	}
}

/** The tsdown build for a TargetGroup failed. */
export class BuildFailed extends Data.TaggedError("BuildFailed")<{
	readonly targetGroup: string;
	readonly reason: string;
}> {
	get message(): string {
		return `Build failed for TargetGroup "${this.targetGroup}": ${this.reason}`;
	}
}

/** API Extractor meta generation failed for an entry. */
export class MetaGenerationError extends Data.TaggedError("MetaGenerationError")<{
	readonly entry: string;
	readonly reason: string;
}> {
	get message(): string {
		return `Meta generation failed for entry "${this.entry}": ${this.reason}`;
	}
}

/** A savvy.build.ts or publishConfig.targets config is structurally invalid; raised before any build work. */
export class ConfigValidationError extends Data.TaggedError("ConfigValidationError")<{
	readonly path: string;
	readonly reason: string;
}> {
	get message(): string {
		return `Config validation failed at "${this.path}": ${this.reason}`;
	}
}
