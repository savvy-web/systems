import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Resolved JSX transform settings, mirroring the subset of rolldown's JsxOptions the bundler forwards. */
export interface JsxConfig {
	/** "automatic" auto-imports the JSX factories (react-jsx); "classic" does not (React.createElement). */
	readonly runtime?: "classic" | "automatic" | undefined;
	/** The JSX import source for the automatic runtime (e.g. "react", "preact"). */
	readonly importSource?: string | undefined;
}

/** The jsx-relevant slice of a tsconfig's compilerOptions. */
export interface TsconfigJsx {
	readonly jsx?: string | undefined;
	readonly jsxImportSource?: string | undefined;
}

/**
 * Resolve the effective JSX config: an explicit override wins; otherwise infer from the tsconfig
 * values. Returns undefined when no JSX transform is needed (preserve/none).
 */
export function resolveJsxConfig(tsconfig: TsconfigJsx, override: JsxConfig | undefined): JsxConfig | undefined {
	if (override !== undefined) {
		return override.runtime === "automatic"
			? { runtime: "automatic", importSource: override.importSource ?? "react" }
			: override;
	}
	const ts = tsconfig.jsx;
	if (ts === "react-jsx" || ts === "react-jsxdev") {
		return { runtime: "automatic", importSource: tsconfig.jsxImportSource ?? "react" };
	}
	if (ts === "react") {
		return { runtime: "classic" };
	}
	// "preserve" / "react-native" / undefined: nothing for the bundler to configure.
	return undefined;
}

/**
 * Read the jsx-relevant compilerOptions from a package's own tsconfig.json (best-effort;
 * returns empty on absence or parse error).
 */
export function readTsconfigJsx(cwd: string): TsconfigJsx {
	const path = join(cwd, "tsconfig.json");
	if (!existsSync(path)) return {};
	try {
		const raw = JSON.parse(readFileSync(path, "utf-8")) as { compilerOptions?: TsconfigJsx };
		const co = raw.compilerOptions ?? {};
		return {
			...(co.jsx !== undefined ? { jsx: co.jsx } : {}),
			...(co.jsxImportSource !== undefined ? { jsxImportSource: co.jsxImportSource } : {}),
		};
	} catch {
		return {};
	}
}
