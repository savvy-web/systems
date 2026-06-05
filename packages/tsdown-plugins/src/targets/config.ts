/** A single object-form publish target. Uses `from` XOR `name` (never both). */
export interface PublishTargetObject {
	/** Registry endpoint. Required for custom keys; defaulted for `npm`/`github`. */
	readonly registry?: string | undefined;
	/** Name override for this target's own group. Mutually exclusive with `from`. */
	readonly name?: string | undefined;
	/** Reuse another target's group bytes (deploy them to this registry). Mutually exclusive with `name`. */
	readonly from?: string | undefined;
}

/** A `publishConfig.targets` value: `true` (well-known registry, base name), a string (name override), or an object. */
export type PublishTargetValue = true | string | PublishTargetObject;

/** The `publishConfig.targets` map, keyed by target id (`npm`, `github`, or a custom key). */
export type PublishTargets = Record<string, PublishTargetValue>;

/** A distinct byte-variant build group (one per distinct resolved name). */
export interface ResolvedGroup {
	/** Folder id; the group's output dir nests this id under dist/prod, with a pkg subfolder. */
	readonly id: string;
	/** The `package.json.name` this group's manifest carries. */
	readonly name: string;
	/** The group's pkg output dir, relative to the package root. */
	readonly dir: string;
}

/** A resolved registry target (one per `publishConfig.targets` key). */
export interface ResolvedTarget {
	/** The `publishConfig.targets` key. */
	readonly id: string;
	/** The group id whose bytes this target deploys. */
	readonly group: string;
	/** The resolved name for that group. */
	readonly name: string;
	/** The resolved registry endpoint. */
	readonly registry: string;
}

/** The full resolution of `publishConfig.targets`: the distinct groups to build, and every target bound to one. */
export interface TargetResolution {
	readonly groups: ReadonlyArray<ResolvedGroup>;
	readonly targets: ReadonlyArray<ResolvedTarget>;
}

/** True when a target value is the object form (carries registry/name/from). */
export function isTargetObject(value: PublishTargetValue): value is PublishTargetObject {
	return typeof value === "object" && value !== null;
}
