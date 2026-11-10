/**
 * The kit services `ReleasePlanner.layer` requires besides `ConfigInspector`
 * and the platform: `WorkspaceDiscovery` (every call lists the workspace it is
 * given, explicitly rooted, so the layer-bound root is never consulted) and
 * `Git` (the commit that added each changeset). Provide `NodeServices.layer`
 * after it.
 */
import { Git } from "@effected/git";
import { WorkspaceDiscovery, WorkspaceRoot } from "@effected/workspaces";
import { Layer } from "effect";

export const PlannerDeps = Layer.mergeAll(
	WorkspaceDiscovery.layer().pipe(Layer.provide(WorkspaceRoot.layer)),
	Git.layer,
);
