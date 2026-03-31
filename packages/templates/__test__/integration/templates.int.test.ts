import { describe, expect, it } from "vitest";
import {
	createBiome,
	createChangeset,
	createGitignore,
	createPackageJson,
	createPnpmWorkspace,
	createReadme,
	createTsConfig,
	createTurboRoot,
	createTurboWorkspace,
	createVsCode,
	createWorkspace,
} from "../../src/index.js";

describe("template snapshots", () => {
	it("package-json: full ecosystem package", () => {
		const result = createPackageJson({
			name: "@savvy-web/silk-effects",
			version: "0.2.2",
			private: true,
			description: "Shared Effect library for Silk Suite conventions",
			homepage: "https://github.com/savvy-web/systems/tree/main/packages/silk-effects",
			bugs: { url: "https://github.com/savvy-web/systems/issues" },
			repository: {
				type: "git",
				url: "git+https://github.com/savvy-web/systems.git",
				directory: "packages/silk-effects",
			},
			license: "MIT",
			author: {
				name: "C. Spencer Beggs",
				email: "spencer@savvyweb.systems",
				url: "https://savvyweb.systems",
			},
			sideEffects: false,
			type: "module",
			exports: { ".": "./src/index.ts" },
			scripts: {
				build: "turbo run build:dev build:prod --log-order=grouped",
				"build:dev": "rslib build --config-loader native --env-mode dev",
				"build:prod": "rslib build --config-loader native --env-mode npm",
				"types:check": "tsgo --noEmit",
			},
			dependencies: {
				"@effect/platform": "catalog:silk",
				"jsonc-effect": "^0.2.1",
			},
			devDependencies: {
				"@savvy-web/rslib-builder": "^0.19.1",
				"@savvy-web/vitest": "^1.2.1",
				effect: "catalog:silk",
			},
			peerDependencies: { effect: "catalog:silkPeers" },
			publishConfig: {
				access: "public",
				directory: "dist/dev",
				linkDirectory: true,
				targets: [
					{
						protocol: "npm",
						registry: "https://npm.pkg.github.com/",
						directory: "dist/npm",
						access: "public",
						provenance: true,
					},
					{
						protocol: "npm",
						registry: "https://registry.npmjs.org/",
						directory: "dist/npm",
						access: "public",
						provenance: true,
					},
				],
			},
		});
		expect(result).toMatchSnapshot();
	});

	it("package-json: minimal", () => {
		const result = createPackageJson({ name: "bare-package" });
		expect(result).toMatchSnapshot();
	});

	it("tsconfig: with extends and references", () => {
		const result = createTsConfig({
			extends: ["@savvy-web/rslib-builder/tsconfig/ecma/lib.json"],
			composite: true,
			include: ["src/**/*.ts"],
			exclude: ["node_modules", "dist"],
			references: [{ path: "./packages/a" }, { path: "./packages/b" }],
		});
		expect(result).toMatchSnapshot();
	});

	it("tsconfig: minimal", () => {
		const result = createTsConfig({});
		expect(result).toMatchSnapshot();
	});

	it("biome: root with extends", () => {
		const result = createBiome({
			version: "2.3.3",
			extends: ["@savvy-web/biome-config"],
			root: true,
		});
		expect(result).toMatchSnapshot();
	});

	it("turbo: root with full options", () => {
		const result = createTurboRoot({
			tasks: {
				"build:dev": {
					cache: false,
					dependsOn: [],
					outputs: ["dist/dev/**"],
				},
				"build:prod": {
					cache: true,
					dependsOn: ["types:check"],
					outputs: ["dist/npm/**"],
				},
				"types:check": {
					cache: true,
					dependsOn: [],
					outputLogs: "errors-only",
				},
			},
			globalPassThroughEnv: ["GITHUB_ACTIONS", "CI"],
			globalDependencies: ["tsconfig.json"],
		});
		expect(result).toMatchSnapshot();
	});

	it("turbo: workspace with task overrides", () => {
		const result = createTurboWorkspace({
			tasks: {
				"build:dev": {
					cache: true,
					dependsOn: ["types:check"],
					outputLogs: "errors-only",
					outputs: ["dist/dev/**", ".rslib/declarations/dev/**"],
				},
			},
		});
		expect(result).toMatchSnapshot();
	});

	it("pnpm: workspace with catalog", () => {
		const result = createPnpmWorkspace({
			packages: [".", "packages/*"],
			autoInstallPeers: true,
			catalogMode: "strict",
			catalog: {
				effect: "^3.21.0",
				"@types/node": "^24.0.0",
			},
		});
		expect(result).toMatchSnapshot();
	});

	it("gitignore: all sections enabled", () => {
		const result = createGitignore({});
		expect(result).toMatchSnapshot();
	});

	it("gitignore: with additional patterns", () => {
		const result = createGitignore({
			sections: { silk: false },
			additional: ["*.log", "tmp/", ".worktrees"],
		});
		expect(result).toMatchSnapshot();
	});

	it("changeset: with repo", () => {
		const result = createChangeset({
			access: "public",
			repo: "savvy-web/systems",
			baseBranch: "main",
		});
		expect(result).toMatchSnapshot();
	});

	it("vscode: all features enabled", () => {
		const result = createVsCode({
			settings: { biome: true, turbo: true, vitest: true },
			extensions: ["biomejs.biome", "vitest.explorer", "eamodio.gitlens", "Anthropic.claude-code"],
		});
		expect(result).toMatchSnapshot();
	});

	it("readme: with description", () => {
		const result = createReadme({
			name: "Silk Suite Systems",
			description: "Coordination hub for the Silk Suite open-source ecosystem.",
		});
		expect(result).toMatchSnapshot();
	});

	it("workspace: full pnpm workspace with all features", () => {
		const result = createWorkspace({
			name: "savvy-web-systems",
			packageManager: "pnpm",
			packageManagerVersion: "10.33.0",
			nodeVersion: "24.11.0",
			features: {
				biome: true,
				vitest: true,
				turbo: true,
				changesets: true,
				vscode: true,
			},
		});
		expect(result).toMatchSnapshot();
	});

	it("workspace: minimal npm project", () => {
		const result = createWorkspace({
			name: "simple-project",
			packageManager: "npm",
			packageManagerVersion: "10.9.2",
			nodeVersion: "24.11.0",
		});
		expect(result).toMatchSnapshot();
	});
});
