import type { Effect } from "effect";
import { Context } from "effect";
import type { WorkspaceDetectorError } from "../errors/WorkspaceDetectorError.js";
import type { WorkspaceInfo, WorkspacePackage } from "../schemas/Workspace.js";

/**
 * Service shape for {@link WorkspaceDetector}.
 *
 * @public
 */
export interface WorkspaceDetectorShape {
	readonly detect: () => Effect.Effect<WorkspaceInfo, WorkspaceDetectorError>;
	readonly listPackages: () => Effect.Effect<Array<WorkspacePackage>, WorkspaceDetectorError>;
	readonly getPackage: (nameOrPath: string) => Effect.Effect<WorkspacePackage, WorkspaceDetectorError>;
}

/**
 * Service for workspace/monorepo detection.
 *
 * @public
 */
export class WorkspaceDetector extends Context.Service<WorkspaceDetector, WorkspaceDetectorShape>()(
	"github-action-effects/WorkspaceDetector",
) {}
