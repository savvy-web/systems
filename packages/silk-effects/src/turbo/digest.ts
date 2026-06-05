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
				globalEnvVars: [
					...g.environmentVariables.configured,
					...g.environmentVariables.inferred,
					...(g.environmentVariables.specified.passThroughEnv ?? []),
				],
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

	/** Build the affected result from a changed-package list and the dry-run graph. */
	static affected(base: string, changed: readonly string[], dry: TurboDryRunType): AffectedResultType {
		const changedSet = new Set(changed);
		const dependents = new Set<string>();
		for (const t of dry.tasks) {
			if (changedSet.has(t.package)) {
				for (const d of t.dependents) {
					const pkg = d.split("#")[0];
					if (pkg && !changedSet.has(pkg)) dependents.add(pkg);
				}
			}
		}
		return {
			base,
			packages: [...changedSet],
			dependents: [...dependents],
		};
	}
}
