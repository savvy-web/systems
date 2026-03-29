import { Equal, Hash, Schema } from "effect";
import type { ResolutionPolicy, SourceRequirement, VersionExtractor } from "./ToolResults.js";
import {
	ResolutionPolicy as ResolutionPolicyEnum,
	SourceRequirement as SourceRequirementEnum,
	VersionExtractor as VersionExtractorEnum,
} from "./ToolResults.js";

const NameSchema = Schema.Struct({ name: Schema.String });

/**
 * Declares a CLI tool's identity and resolution constraints.
 *
 * {@link Equal} compares on `name` only (identity).
 *
 * @since 0.2.0
 */
export class ToolDefinition implements Equal.Equal {
	readonly _tag = "ToolDefinition" as const;
	readonly name: string;
	readonly versionExtractor: VersionExtractor;
	readonly policy: ResolutionPolicy;
	readonly source: SourceRequirement;

	private constructor(
		name: string,
		versionExtractor: VersionExtractor,
		policy: ResolutionPolicy,
		source: SourceRequirement,
	) {
		this.name = name;
		this.versionExtractor = versionExtractor;
		this.policy = policy;
		this.source = source;
	}

	static make(options: {
		readonly name: string;
		readonly versionExtractor?: VersionExtractor;
		readonly policy?: ResolutionPolicy;
		readonly source?: SourceRequirement;
	}): ToolDefinition {
		// Validate name via Schema
		Schema.decodeUnknownSync(NameSchema)({ name: options.name });

		return new ToolDefinition(
			options.name,
			options.versionExtractor ?? VersionExtractorEnum.Flag({ flag: "--version" }),
			options.policy ?? ResolutionPolicyEnum.Report(),
			options.source ?? SourceRequirementEnum.Any(),
		);
	}

	[Equal.symbol](that: Equal.Equal): boolean {
		if (!(that instanceof ToolDefinition)) return false;
		return this.name === that.name;
	}

	[Hash.symbol](): number {
		return Hash.cached(this)(Hash.hash(this.name));
	}
}
