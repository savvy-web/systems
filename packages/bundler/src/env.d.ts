// Ambient process.env declaration for packages built with @savvy-web/bundler.

declare namespace NodeJS {
	interface ProcessEnv {
		/**
		 * The built package's version, injected at build time by `@savvy-web/bundler`
		 * (`buildTargetGroups`'s `define`, `process.env.__PACKAGE_VERSION__`). Absent when running
		 * unbuilt source — a consumer reading it should fall back, e.g. `?? "0.0.0"`.
		 */
		readonly __PACKAGE_VERSION__?: string;
	}
}
