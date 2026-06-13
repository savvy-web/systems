// Ambient module + import.meta.env declarations for RSPress plugin runtimes built with
// @savvy-web/rspress-builder. Replaces the rslib-era @rslib/core/types reference.

type CSSModuleClasses = Readonly<Record<string, string>>;

declare module "*.module.css" {
	const classes: CSSModuleClasses;
	export default classes;
}
declare module "*.css" {}

interface ImportMetaEnv {
	readonly [key: string]: string | boolean | undefined;
	/** RSPress static-site-generation markdown flag, resolved per site build. */
	readonly SSG_MD?: boolean;
}
interface ImportMeta {
	readonly env: ImportMetaEnv;
}
