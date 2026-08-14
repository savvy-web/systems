// Ambient module + import.meta.env declarations for RSPress plugin runtimes built with
// @savvy-web/rspress-builder. Replaces the rslib-era @rslib/core/types reference.

type CSSModuleClasses = Readonly<Record<string, string>>;

declare module "*.module.css" {
	const classes: CSSModuleClasses;
	export default classes;
}
declare module "*.css" {}

/**
 * The `ImportMetaEnv` interface defines the shape of the `import.meta.env` object, which contains environment variables
 * injected by Vite during the build process. These variables provide information about the build environment,
 * such as whether the app is running in development or production mode, whether it is being server-side rendered, and other relevant details.
 * @see {@link https://vite.dev/guide/env-and-mode|Vite | Env and Modes }
 */
interface ImportMetaEnv {
	/**
	 * Environment variable so React components can distinguish SSG-MD (markdown)
	 * rendering from browser rendering and customize their output
	 * @example
	 * ```typescript
	 * export function Tab({ label }: { label: string }) {
	 *     if (import.meta.env.SSG_MD) {
	 *         // This will be returned as a static string in the markdown output
	 *         return <>{`** Here is a Tab named ${label}**`}</>;
	 *     }
	 *     // This will be returned as a React component in the browser
	 *     return <div class="tab">{label}</div>;
	 * }
	 * ```
	 * @see {@link https://rspress.rs/guide/basic/ssg-md|RSPress | SSG-MD }
	 * @see {@link https://vite.dev/guide/env-and-mode|Vite | Env and Modes }
	 * */

	readonly SSG_MD: boolean;
	/**
	 * whether the Vite app is running in SSR (server-side rendering) mode. Allows you to
	 * conditionally render React components differently for SSR vs. browser rendering.
	 *
	 * @example
	 * ```typescript
	 * export function DebugInfo() {
	 *     if (import.meta.env.SSR) {
	 *         return <div class="debug-info">Debug info here</div>;
	 *     }
	 *     return null;
	 * }
	 * @see {@link https://vite.dev/guide/env-and-mode|Vite | Env and Modes }
	 */
	readonly SSR: boolean;

	/**
	 * Environment variable so React components can distinguish between development and
	 * production builds
	 *
	 *  @example
	 *  ```typescript
	 *  export function DebugInfo() {
	 *      if (import.meta.env.MODE === "development") {
	 *          return <div class="debug-info">Debug info here</div>;
	 *      }
	 *      return null;
	 *  }
	 *  ```
	 * @see {@link https://vite.dev/guide/env-and-mode#modes|Vite | Modes }
	 */
	readonly MODE: "development" | "production";

	/**
	 * Base public path when served in development or production. Valid values include:
	 * Absolute URL pathname, e.g. `/foo/`
	 *   - Full URL, e.g. `https://bar.com/foo/` (The origin part won't be used in development so the value is the same as /foo/)
	 *   - Empty string or `./` (for embedded deployment)
	 * @see {@link https://vite.dev/guide/env-and-mode|Vite | Env and Modes }
	 */
	readonly BASE_URL: string;

	/**
	 * whether the Vite app is running in production mode:
	 *   - running the dev server with `NODE_ENV='production'`
	 *   - running an app built with `NODE_ENV='production'`)
	 *
	 *  Always the opposite of `import.meta.env.DEV`
	 *
	 * @see {@link https://vite.dev/guide/env-and-mode#env-files|Vite | Modes }
	 */
	readonly PROD: boolean;

	/**
	 * whether the Vite app is running in development mode:
	 *   - running the dev server with `NODE_ENV='development'`
	 *   - running an app built with `NODE_ENV='development'`
	 *
	 *  Always the opposite of `import.meta.env.PROD`.
	 * @see {@link https://vite.dev/guide/env-and-mode#env-files|Vite | Modes }
	 */
	readonly DEV: boolean;
}

interface ImportMeta {
	/**
	 * The `import.meta` object contains metadata about the current module. It is a standard
	 * feature in JavaScript modules. The `env` property on `import.meta` is a custom property injected
	 * by Vite that provides access to environment variables defined in the Vite configuration or `.env` files.
	 * RSPress uses this to provide information about the build environment, such as whether the app is running
	 * in development or production mode, whether it is being server-side rendered, and other relevant environment details.
	 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import.meta|}
	 * @see {@link https://vite.dev/guide/env-and-mode|Vite | Env and Modes }
	 */
	env: ImportMetaEnv;
}
