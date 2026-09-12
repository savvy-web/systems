/**
 * Where the ten tool values and their handlers meet: {@link SilkToolkit} is
 * the served toolkit a structural test can import with no bin and no platform
 * layer; {@link ToolsLayer} binds every handler to one project directory.
 *
 * @packageDocumentation
 */

import type { Layer } from "effect";
import type { Tool } from "effect/unstable/ai";
import { Toolkit } from "effect/unstable/ai";

import { biomeCheckTool, handleBiomeCheck } from "./tools/biome-check.js";
import { changesetDepsDetectTool, handleChangesetDepsDetect } from "./tools/changeset-deps-detect.js";
import { changesetDepsRegenTool, handleChangesetDepsRegen } from "./tools/changeset-deps-regen.js";
import { changesetInspectTool, handleChangesetInspect } from "./tools/changeset-inspect.js";
import { changesetPreviewTool, handleChangesetPreview } from "./tools/changeset-preview.js";
import { changesetValidateTool, handleChangesetValidate } from "./tools/changeset-validate.js";
import { handleReposInspect, reposInspectTool } from "./tools/repos-inspect.js";
import { handleReposManage, reposManageTool } from "./tools/repos-manage.js";
import { handleTurboInspect, turboInspectTool } from "./tools/turbo-inspect.js";
import { handleWorkspaceInfo, workspaceInfoTool } from "./tools/workspace-info.js";

/**
 * The served tool record, keyed by wire name. Spelled out through the
 * exported `Toolkit.ToolsByName` (rather than inferred through
 * `Toolkit.make`) so the exported toolkit and handler layer have nameable
 * declaration types — inference reaches into silk-effects' unexported
 * `*Shape` interfaces and fails declaration emit (TS4023).
 *
 * @public
 */
export type SilkTools = Toolkit.ToolsByName<
	readonly [
		typeof workspaceInfoTool,
		typeof turboInspectTool,
		typeof changesetInspectTool,
		typeof changesetValidateTool,
		typeof changesetDepsDetectTool,
		typeof changesetPreviewTool,
		typeof changesetDepsRegenTool,
		typeof reposInspectTool,
		typeof reposManageTool,
		typeof biomeCheckTool,
	]
>;

/**
 * The ten savvy-mcp tools — seven read-only, three mutating (`biome_check`
 * with `write`/`unsafe`, `changeset_deps_regen`, `repos_manage`) — in the
 * order `tools/list` serves them.
 *
 * @public
 */
export const SilkToolkit: Toolkit.Toolkit<SilkTools> = Toolkit.make(
	workspaceInfoTool,
	turboInspectTool,
	changesetInspectTool,
	changesetValidateTool,
	changesetDepsDetectTool,
	changesetPreviewTool,
	changesetDepsRegenTool,
	reposInspectTool,
	reposManageTool,
	biomeCheckTool,
);

/**
 * The handler layer. `cwd` — the project directory `main.ts` resolved once at
 * startup — is closed over as every handler's fallback when a call omits its
 * own `cwd`; the handlers' declared service dependencies are discharged by
 * `makeSilkRuntimeLayer(cwd)` in `server.ts`.
 *
 * @public
 */
export const ToolsLayer = (cwd: string): Layer.Layer<Tool.HandlersFor<SilkTools>> =>
	SilkToolkit.toLayer({
		workspace_info: (params) => handleWorkspaceInfo(cwd, params),
		turbo_inspect: (params) => handleTurboInspect(cwd, params),
		changeset_inspect: (params) => handleChangesetInspect(cwd, params),
		changeset_validate: (params) => handleChangesetValidate(cwd, params),
		changeset_deps_detect: (params) => handleChangesetDepsDetect(cwd, params),
		changeset_preview: (params) => handleChangesetPreview(cwd, params),
		changeset_deps_regen: (params) => handleChangesetDepsRegen(cwd, params),
		repos_inspect: (params) => handleReposInspect(cwd, params),
		repos_manage: (params) => handleReposManage(cwd, params),
		biome_check: (params) => handleBiomeCheck(cwd, params),
	});
