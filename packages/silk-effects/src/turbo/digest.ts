import type { TurboDryRunType, TurboDryTaskType } from "./schemas/DryRun.js";
import type { AffectedResultType, CacheDiagnosisType, TaskGraphResultType } from "./schemas/results.js";

/**
 * Pure transforms from decoded turbo dry-run JSON to digested result shapes.
 * No dependency injection — directly unit-testable.
 *
 * @remarks All members are `static`.
 * @since 0.7.0
 */
export class TurboDigest {
	private constructor() {}

	/** Env vars that actually feed a task's hash: configured + inferred. */
	private static hashedEnv(task: TurboDryTaskType): readonly string[] {
		return [...task.environmentVariables.configured, ...task.environmentVariables.inferred];
	}

	static cacheDiagnosis(task: string, dry: TurboDryRunType): CacheDiagnosisType {
		const statuses = dry.tasks.map((t) => ({
			package: t.package,
			taskId: t.taskId,
			hash: t.hash,
			status: t.cache.status,
			timeSaved: t.cache.timeSaved,
		}));
		const misses = dry.tasks.filter((t) => t.cache.status === "MISS");
		const explanations = misses.map((t) => ({
			package: t.package,
			taskId: t.taskId,
			hash: t.hash,
			inputFileCount: Object.keys(t.inputs).length,
			hashedEnvVars: TurboDigest.hashedEnv(t),
			externalDependenciesHash: t.hashOfExternalDependencies,
			dependsOn: t.dependencies,
		}));
		const g = dry.globalCacheInputs;
		return {
			task,
			totalTasks: dry.tasks.length,
			hits: dry.tasks.length - misses.length,
			misses: misses.length,
			statuses,
			explanations,
			global: {
				rootKey: g.rootKey,
				globalFileCount: Object.keys(g.files).length,
				externalDependenciesHash: g.hashOfExternalDependencies,
				internalDependenciesHash: g.hashOfInternalDependencies,
				globalEnvVars: [...g.environmentVariables.configured, ...g.environmentVariables.inferred],
			},
		};
	}

	static taskGraph(dry: TurboDryRunType, task?: string): TaskGraphResultType {
		const nodes = dry.tasks.map((t) => ({
			taskId: t.taskId,
			package: t.package,
			dependsOn: t.dependencies,
		}));
		return {
			...(task !== undefined ? { task } : {}),
			nodeCount: nodes.length,
			nodes,
			criticalPath: TurboDigest.criticalPath(dry.tasks),
		};
	}

	/** Longest dependency chain by node count (memoized DFS over the dependency edges). */
	private static criticalPath(tasks: readonly TurboDryTaskType[]): readonly string[] {
		const byId = new Map(tasks.map((t) => [t.taskId, t]));
		const memo = new Map<string, readonly string[]>();
		const longest = (id: string, seen: ReadonlySet<string>): readonly string[] => {
			const cached = memo.get(id);
			if (cached) return cached;
			if (seen.has(id)) return [id]; // cycle guard
			const node = byId.get(id);
			if (!node || node.dependencies.length === 0) {
				const self = [id];
				memo.set(id, self);
				return self;
			}
			const nextSeen = new Set(seen).add(id);
			let best: readonly string[] = [];
			for (const dep of node.dependencies) {
				const chain = longest(dep, nextSeen);
				if (chain.length > best.length) best = chain;
			}
			const path = [...best, id];
			memo.set(id, path);
			return path;
		};
		let overall: readonly string[] = [];
		for (const t of tasks) {
			const chain = longest(t.taskId, new Set());
			if (chain.length > overall.length) overall = chain;
		}
		return overall;
	}

	/**
	 * Split an `--affected` dry-run into directly-changed packages and their dependents.
	 *
	 * @remarks
	 * `turbo run <task> --affected --dry=json` already expands the set to include the
	 * directly-changed packages *and* their transitive dependents, so every task in
	 * `dry.tasks` is in the affected set. To recover the split we need the set of files
	 * that actually changed (`changedFiles`, from `git diff --name-only <base>...HEAD`):
	 * a package is *directly changed* when a changed file lives under its `directory`,
	 * and everything else in the affected set is therefore a *dependent*. When the change
	 * is outside any affected package (e.g. a root file like `pnpm-lock.yaml`, which makes
	 * the whole graph affected), no package is directly changed and the full set is reported
	 * as dependents.
	 */
	static affected(base: string, changedFiles: readonly string[], dry: TurboDryRunType): AffectedResultType {
		const packageDir = new Map<string, string>();
		for (const t of dry.tasks) packageDir.set(t.package, t.directory);
		const affectedPackages = [...packageDir.keys()];
		const isDirectlyChanged = (pkg: string): boolean => {
			const dir = packageDir.get(pkg);
			if (dir === undefined) return false;
			const prefix = dir.endsWith("/") ? dir : `${dir}/`;
			return changedFiles.some((file) => file === dir || file.startsWith(prefix));
		};
		return {
			base,
			packages: affectedPackages.filter(isDirectlyChanged),
			dependents: affectedPackages.filter((pkg) => !isDirectlyChanged(pkg)),
		};
	}
}
