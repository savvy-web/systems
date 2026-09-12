import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { Run } from "@effected/commands";
import { Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";

/**
 * A copy of `process.env` with `NODE_V8_COVERAGE` removed so spawned package
 * managers do not write coverage temp files that race vitest's V8 provider
 * (an intermittent `coverage/.tmp/*.json` ENOENT and an exit-1 even though
 * every test passes). Same contract as `e2e/bundler`.
 */
const { NODE_V8_COVERAGE: _omit, ...SPAWN_ENV_BASE } = process.env;
export const SPAWN_ENV: NodeJS.ProcessEnv = SPAWN_ENV_BASE;

/** Monorepo root, walked up from this harness package. */
export const REPO_ROOT = resolve(import.meta.dirname, "..", "..", "..", "..");

/**
 * The carrier plus the five companions its exact-pinned `dependencies` reach.
 * Order does not matter: each is packed independently.
 */
export const APP_PACKAGES = [
	"@savvy-web/silk",
	"@savvy-web/cli",
	"@savvy-web/mcp",
	"@savvy-web/changelog",
	"@savvy-web/silk-effects",
	"@savvy-web/silk-core",
] as const;

export type AppPackage = (typeof APP_PACKAGES)[number];

/** `@savvy-web/silk` -> `packages/silk` — the source package dir, not `dist/dev/pkg`. */
export const sourceDir = (name: AppPackage): string => join(REPO_ROOT, "packages", name.slice("@savvy-web/".length));

/**
 * Pack the six app packages into `<dest>` and return a name -> absolute tarball
 * path map.
 *
 * @remarks
 * `pnpm pack` runs with `cwd` = the SOURCE package dir, not `dist/dev/pkg`:
 * pnpm honours `publishConfig.directory`, so the tarball's contents ARE the
 * built `dist/dev/pkg`, while the manifest goes through pnpm's publish
 * rewrite that turns `workspace:*` into the sibling's exact version and
 * `catalog:` into the catalogued range. Packing from inside `dist/dev/pkg`
 * fails outright (`ERR_PNPM_CANNOT_RESOLVE_WORKSPACE_PROTOCOL`): that dir is
 * not a workspace member, and `devManifest: "preserve"` leaves the protocol
 * specifiers in it. `ignore-scripts` skips silk's `prepare` (a turbo build)
 * that pack would otherwise replay per package.
 */
export function packAll(dest: string): Record<AppPackage, string> {
	mkdirSync(dest, { recursive: true });
	const out = {} as Record<AppPackage, string>;
	for (const name of APP_PACKAGES) {
		const stdout = execFileSync("pnpm", ["pack", "--config.ignore-scripts=true", "--pack-destination", dest], {
			cwd: sourceDir(name),
			env: SPAWN_ENV,
			encoding: "utf8",
			stdio: "pipe",
		});
		// pnpm prints the absolute tarball path as the final stdout line.
		const line = stdout
			.trim()
			.split("\n")
			.map((s) => s.trim())
			.filter((s) => s.endsWith(".tgz"))
			.at(-1);
		if (line === undefined || !existsSync(line)) {
			throw new Error(`pnpm pack for ${name} did not report a tarball path:\n${stdout}`);
		}
		out[name] = line;
	}
	return out;
}

/** Read `package/package.json` out of a `.tgz` without extracting it to disk. */
export function tarballManifest(tarball: string): Record<string, unknown> {
	const json = execFileSync("tar", ["-xzOf", tarball, "package/package.json"], { encoding: "utf8", stdio: "pipe" });
	return JSON.parse(json) as Record<string, unknown>;
}

/** Whether `<pm>` resolves on PATH; the caller `it.skip`s the run if not. */
export function hasBinary(pm: string): boolean {
	try {
		execFileSync("sh", ["-c", `command -v ${pm}`], { stdio: "ignore", env: SPAWN_ENV });
		return true;
	} catch {
		return false;
	}
}

const readVersion = (dir: string): string =>
	(JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { version: string }).version;

/** The real dir of `@savvy-web/<short>` as seen from the `@savvy-web` scope dir beside `fromRealDir`. */
const sibling = (fromRealDir: string, name: AppPackage): string =>
	realpathSync(join(fromRealDir, "..", name.slice("@savvy-web/".length)));

/**
 * The versions of the six app packages as INSTALLED in a scratch project,
 * walked the way node resolves them rather than through `require.resolve`
 * (several of these packages do not export `./package.json`, and a `require`
 * miss would fall through to the host repo's own copies).
 *
 * Under npm the tree is flat, so every sibling lookup lands in
 * `node_modules/@savvy-web/`. Under pnpm each package's dependencies are
 * symlinked beside its real dir in the virtual store, so the walk follows
 * silk's direct dependencies from silk's real dir and silk-core from
 * silk-effects' real dir — exactly the resolution the bins go through.
 */
export function installedVersions(projectDir: string): Record<AppPackage, string> {
	const silk = realpathSync(join(projectDir, "node_modules", "@savvy-web", "silk"));
	const cli = sibling(silk, "@savvy-web/cli");
	const mcp = sibling(silk, "@savvy-web/mcp");
	const changelog = sibling(silk, "@savvy-web/changelog");
	const silkEffects = sibling(silk, "@savvy-web/silk-effects");
	const silkCore = sibling(silkEffects, "@savvy-web/silk-core");
	return {
		"@savvy-web/silk": readVersion(silk),
		"@savvy-web/cli": readVersion(cli),
		"@savvy-web/mcp": readVersion(mcp),
		"@savvy-web/changelog": readVersion(changelog),
		"@savvy-web/silk-effects": readVersion(silkEffects),
		"@savvy-web/silk-core": readVersion(silkCore),
	};
}

/**
 * Run `<command> ...args` with `cwd` = the scratch project, with the same
 * spawn contract as the in-repo test in
 * `packages/silk/__test__/e2e/bins.e2e.test.ts`: env is passed whole (no
 * `extendEnv`), so `PATH` and `HOME` are listed explicitly; `stdin` is a
 * `ChildProcess.CommandOptions` field taking a byte `Stream`, which closes
 * stdin when it ends.
 *
 * `command` is the `node_modules/.bin` entry itself rather than
 * `process.execPath`: pnpm materialises `.bin` entries as POSIX shell shims,
 * npm as symlinks to the shebang'd JS file, and running the entry directly is
 * what `pnpm exec savvy` / `npx savvy` do in a consumer. `PATH` carries the
 * running node's dir so the shim's `node` resolves to the same runtime.
 */
export const runBin = (cwd: string, command: string, args: ReadonlyArray<string>, stdin?: string) =>
	Run.collect(
		ChildProcess.make(command, [...args], {
			cwd,
			env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", NO_COLOR: "1" },
			...(stdin === undefined ? {} : { stdin: Stream.make(new TextEncoder().encode(stdin)) }),
		}),
	);

export const initializeRequest = `${JSON.stringify({
	jsonrpc: "2.0",
	id: 1,
	method: "initialize",
	params: {
		protocolVersion: "2025-06-18",
		capabilities: {},
		clientInfo: { name: "silk-packed-install-e2e", version: "0.0.0" },
	},
})}\n`;
