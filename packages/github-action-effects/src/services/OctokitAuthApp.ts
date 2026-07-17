import { Context } from "effect";

/**
 * Auth function returned by `createAppAuth`.
 *
 * @public
 */
export interface AppAuth {
	(options: { type: "app" }): Promise<{ token: string }>;
	(options: {
		type: "installation";
		installationId: number;
	}): Promise<{
		token: string;
		expiresAt: string;
		installationId: number;
		permissions: Record<string, string>;
	}>;
}

/**
 * Service shape for {@link OctokitAuthApp}.
 *
 * @public
 */
export interface OctokitAuthAppShape {
	readonly createAppAuth: (options: { appId: string; privateKey: string }) => AppAuth;
}

/**
 * Wrapper service for `@octokit/auth-app`.
 *
 * @public
 */
export class OctokitAuthApp extends Context.Service<OctokitAuthApp, OctokitAuthAppShape>()(
	"github-action-effects/OctokitAuthApp",
) {}
