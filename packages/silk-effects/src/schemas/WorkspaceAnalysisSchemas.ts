import { Equal, Function as Fn, Hash, Option, Pretty, Schema } from "effect";
import { PublishConfig } from "workspaces-effect";
import type { ResolvedTarget as ResolvedTargetType } from "./PublishabilitySchemas.js";
import { PublishTargetObject, PublishTargetShorthand, ResolvedTarget } from "./PublishabilitySchemas.js";
import { TagStrategyType } from "./TagStrategySchemas.js";
import { ChangesetConfig, SilkChangesetConfig, VersioningStrategyResult } from "./VersioningSchemas.js";

/**
 * Silk-extended publishConfig schema.
 *
 * @remarks
 * Extends the base PublishConfig from workspaces-effect (which covers npm
 * standard fields: access, registry, directory, tag, linkDirectory) with the
 * Silk `targets` extension for multi-registry publishing.
 *
 * @since 0.2.0
 */
export class SilkPublishConfig extends PublishConfig.extend<SilkPublishConfig>("SilkPublishConfig")({
	targets: Schema.optional(Schema.Array(Schema.Union(PublishTargetShorthand, PublishTargetObject))),
}) {}

// ── AnalyzedWorkspace ─────────────────────────────────────────

const KNOWN_REGISTRIES: Record<string, string> = {
	npm: "https://registry.npmjs.org/",
	github: "https://npm.pkg.github.com/",
};

const WorkspaceVersion = Schema.Struct({
	current: Schema.String,
});

/**
 * A fully analyzed workspace with publish targets, versioning status,
 * and release group membership.
 *
 * @since 0.2.0
 */
export class AnalyzedWorkspace extends Schema.TaggedClass<AnalyzedWorkspace>()("AnalyzedWorkspace", {
	name: Schema.String,
	version: WorkspaceVersion,
	path: Schema.String,
	root: Schema.Boolean,
	publishConfig: Schema.NullOr(SilkPublishConfig),
	publishable: Schema.Boolean,
	targets: Schema.Array(ResolvedTarget),
	versioned: Schema.Boolean,
	tagged: Schema.Boolean,
	released: Schema.Boolean,
	// biome-ignore lint/suspicious/noExplicitAny: recursive self-reference requires explicit any to break circular type
	linked: Schema.Array(Schema.suspend((): any => AnalyzedWorkspace)),
	// biome-ignore lint/suspicious/noExplicitAny: recursive self-reference requires explicit any to break circular type
	fixed: Schema.Array(Schema.suspend((): any => AnalyzedWorkspace)),
}) {
	get isRoot(): boolean {
		return this.root;
	}

	get isPublishable(): boolean {
		return this.publishable;
	}

	get isReleasable(): boolean {
		return this.released;
	}

	get isFixed(): boolean {
		return this.fixed.length > 0;
	}

	get isLinked(): boolean {
		return this.linked.length > 0;
	}

	publishesTo(registry: string): boolean {
		return this.targets.some((t) => t.registry === registry);
	}

	hasTarget(shorthand: "npm" | "github" | "jsr"): boolean {
		if (shorthand === "jsr") {
			return this.targets.some((t) => t.protocol === "jsr");
		}
		const registry = KNOWN_REGISTRIES[shorthand];
		return registry !== undefined && this.publishesTo(registry);
	}

	targetFor(registry: string): Option.Option<ResolvedTargetType> {
		const found = this.targets.find((t) => t.registry === registry);
		return found ? Option.some(found) : Option.none();
	}

	[Equal.symbol](that: Equal.Equal): boolean {
		if (!(that instanceof AnalyzedWorkspace)) return false;
		return this.name === that.name && this.path === that.path;
	}

	[Hash.symbol](): number {
		return Hash.cached(this)(Hash.combine(Hash.hash(this.name))(Hash.hash(this.path)));
	}

	toString(): string {
		return `${this.name}@${this.version.current}`;
	}

	toJSON(): unknown {
		return {
			_tag: "AnalyzedWorkspace" as const,
			name: this.name,
			version: this.version,
			path: this.path,
			root: this.root,
			publishable: this.publishable,
			targets: this.targets,
			versioned: this.versioned,
			tagged: this.tagged,
			released: this.released,
		};
	}

	static publishable(workspaces: ReadonlyArray<AnalyzedWorkspace>): ReadonlyArray<AnalyzedWorkspace> {
		return workspaces.filter((w) => w.publishable);
	}

	static releasable(workspaces: ReadonlyArray<AnalyzedWorkspace>): ReadonlyArray<AnalyzedWorkspace> {
		return workspaces.filter((w) => w.released);
	}

	static findByName: {
		(name: string): (workspaces: ReadonlyArray<AnalyzedWorkspace>) => Option.Option<AnalyzedWorkspace>;
		(workspaces: ReadonlyArray<AnalyzedWorkspace>, name: string): Option.Option<AnalyzedWorkspace>;
	};

	/** Pretty-print an AnalyzedWorkspace instance. */
	static pretty: (self: AnalyzedWorkspace) => string;
}

// Wire dual-API for findByName
AnalyzedWorkspace.findByName = Fn.dual(
	2,
	(workspaces: ReadonlyArray<AnalyzedWorkspace>, name: string): Option.Option<AnalyzedWorkspace> => {
		const found = workspaces.find((w) => w.name === name);
		return found ? Option.some(found) : Option.none();
	},
);

// Wire pretty printer
AnalyzedWorkspace.pretty = Pretty.make(AnalyzedWorkspace);

// ── WorkspaceAnalysis ─────────────────────────────────────────

const PackageManagerInfo = Schema.Struct({
	type: Schema.Literal("npm", "pnpm", "yarn", "bun"),
	version: Schema.optional(Schema.String),
});

/**
 * Full workspace analysis result containing all analyzed workspaces
 * and project-level configuration.
 *
 * @since 0.2.0
 */
export class WorkspaceAnalysis extends Schema.TaggedClass<WorkspaceAnalysis>()("WorkspaceAnalysis", {
	root: Schema.String,
	runtime: Schema.Literal("node", "bun"),
	packageManager: PackageManagerInfo,
	workspaces: Schema.Array(AnalyzedWorkspace),
	changesetConfig: Schema.NullOr(Schema.Union(SilkChangesetConfig, ChangesetConfig)),
	versioning: Schema.NullOr(VersioningStrategyResult),
	tagStrategy: Schema.NullOr(TagStrategyType),
}) {
	findWorkspace(name: string): Option.Option<AnalyzedWorkspace> {
		const found = this.workspaces.find((w) => w.name === name);
		return found ? Option.some(found) : Option.none();
	}

	get rootWorkspace(): Option.Option<AnalyzedWorkspace> {
		const root = this.workspaces.find((w) => w.root);
		return root ? Option.some(root) : Option.none();
	}

	get publishableWorkspaces(): ReadonlyArray<AnalyzedWorkspace> {
		return this.workspaces.filter((w) => w.publishable);
	}

	get versionedWorkspaces(): ReadonlyArray<AnalyzedWorkspace> {
		return this.workspaces.filter((w) => w.versioned);
	}

	get taggedWorkspaces(): ReadonlyArray<AnalyzedWorkspace> {
		return this.workspaces.filter((w) => w.tagged);
	}

	get releasableWorkspaces(): ReadonlyArray<AnalyzedWorkspace> {
		return this.workspaces.filter((w) => w.released);
	}

	get isSilk(): boolean {
		if (this.changesetConfig == null) return false;
		return "_isSilk" in this.changesetConfig && this.changesetConfig._isSilk === true;
	}

	get hasChangesets(): boolean {
		return this.changesetConfig != null;
	}

	[Equal.symbol](that: Equal.Equal): boolean {
		if (!(that instanceof WorkspaceAnalysis)) return false;
		return this.root === that.root;
	}

	[Hash.symbol](): number {
		return Hash.cached(this)(Hash.hash(this.root));
	}

	toString(): string {
		return `WorkspaceAnalysis(${this.root}, ${this.workspaces.length} workspaces)`;
	}

	/** Pretty-print a WorkspaceAnalysis instance. */
	static pretty: (self: WorkspaceAnalysis) => string;
}

// Wire pretty printer
WorkspaceAnalysis.pretty = Pretty.make(WorkspaceAnalysis);
