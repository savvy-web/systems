import { build } from "@savvy-web/bundler";
import { PnpmConfigPlugin } from "rolldown-pnpm-config";

await build({
	plugins: [
		PnpmConfigPlugin({
			name: "@savvy-web/pnpm-plugin-silk",
			catalogs: {
				build: {
					packages: {
						"@tsdown/exe": {
							range: "^0.22.14",
							peer: "^0.22.0",
							strategy: "lock-minor",
						},
						"@tsdown/css": {
							range: "^0.22.14",
							peer: "^0.22.0",
							strategy: "lock-minor",
						},
						"@rsbuild/core": {
							range: "^2.1.13",
							peer: "^2.1.0",
							strategy: "lock-minor",
						},
						"@types/bun": {
							range: "^1.3.14",
							peer: "^1.3.14",
							strategy: "lock",
						},
						"@types/node": {
							range: "^26.2.0",
							peer: "^26.2.0",
							strategy: "lock-minor",
						},
						"@types/react": {
							range: "^19.2.18",
							peer: "^19.2.0",
							strategy: "lock-minor",
						},
						"@types/react-dom": {
							range: "^19.2.4",
							peer: "^19.2.0",
							strategy: "lock-minor",
						},
						react: {
							range: "^19.2.8",
							peer: "^19.2.0",
							strategy: "lock-minor",
						},
						"react-dom": {
							range: "^19.2.8",
							peer: "^19.2.0",
							strategy: "lock-minor",
						},
						rolldown: {
							range: "^1.2.4",
							peer: "^1.2.0",
							strategy: "lock-minor",
						},
						tsdown: {
							range: "^0.22.14",
							peer: "^0.22.0",
							strategy: "lock-minor",
						},
						typescript: {
							range: "^7.0.2",
							peer: "^7.0.0",
							strategy: "lock-minor",
						},
						tsx: {
							range: "^4.23.12",
							peer: "^4.23.12",
							strategy: "lock",
						},
					},
				},
				docs: {
					packages: {
						"@rspress/core": {
							range: "^2.0.19",
							peer: "^2.0.0",
							strategy: "lock-minor",
						},
						"@rspress/plugin-sitemap": {
							range: "^2.0.19",
							peer: "^2.0.19",
							strategy: "lock",
						},
						"@types/node": {
							range: "^26.2.0",
							peer: "^26.2.0",
							strategy: "lock-minor",
						},
						"@types/react": {
							range: "^19.2.18",
							peer: "^19.2.0",
							strategy: "lock-minor",
						},
						"@types/react-dom": {
							range: "^19.2.4",
							peer: "^19.2.0",
							strategy: "lock-minor",
						},
						react: {
							range: "^19.2.8",
							peer: "^19.2.0",
							strategy: "lock-minor",
						},
						"react-dom": {
							range: "^19.2.8",
							peer: "^19.2.0",
							strategy: "lock-minor",
						},
						"rspress-plugin-mermaid": {
							range: "^1.0.1",
							peer: "^1.0.1",
							strategy: "lock",
						},
						typescript: {
							range: "^7.0.2",
							peer: "^7.0.0",
							strategy: "lock-minor",
						},
						vite: {
							range: "^8.2.1",
							peer: "^8.2.0",
							strategy: "lock-minor",
						},
						vitepress: {
							range: "^2.0.0-alpha.19",
							peer: "^2.0.0-alpha.19",
							strategy: "lock",
						},
					},
				},
				lint: {
					packages: {
						"@biomejs/biome": {
							range: "2.5.0",
							peer: "2.5.0",
							strategy: "lock",
						},
						"@changesets/cli": {
							range: "^3.0.0",
							peer: "^3.0.0",
							strategy: "lock",
						},
						"@commitlint/cli": {
							range: "^21.2.2",
							peer: "^21.2.2",
							strategy: "lock",
						},
						"@commitlint/config-conventional": {
							range: "^21.2.2",
							peer: "^21.2.2",
							strategy: "lock",
						},
						husky: {
							range: "^9.1.7",
							peer: "^9.1.7",
							strategy: "lock",
						},
						"lint-staged": {
							range: "^17.3.0",
							peer: "^17.3.0",
							strategy: "lock",
						},
						"markdownlint-cli2": {
							range: "^0.23.2",
							peer: "^0.23.2",
							strategy: "lock",
						},
						"markdownlint-cli2-formatter-codequality": {
							range: "^0.0.7",
							peer: "^0.0.7",
							strategy: "lock",
						},
						turbo: {
							range: "^2.10.10",
							peer: "^2.10.10",
							strategy: "lock",
						},
					},
				},
				silk: {
					packages: {
						"@types/bun": {
							range: "^1.3.14",
							peer: "^1.3.14",
							strategy: "lock",
						},
						"@types/node": {
							range: "^26.1.2",
							peer: "^26.1.0",
							strategy: "lock-minor",
						},
						"@types/react": {
							range: "^19.2.18",
							peer: "^19.2.0",
							strategy: "lock-minor",
						},
						"@types/react-dom": {
							range: "^19.2.4",
							peer: "^19.2.0",
							strategy: "lock-minor",
						},
						"@typescript/native-preview": {
							range: "^7.0.0-dev.20260707.2",
							peer: "^7.0.0-dev.20260707.2",
						},
						husky: {
							range: "^9.1.7",
							peer: "^9.1.7",
							strategy: "lock",
						},
						"lint-staged": {
							range: "^17.3.0",
							peer: "^17.3.0",
							strategy: "lock",
						},
						"markdownlint-cli2": {
							range: "^0.23.2",
							peer: "^0.23.2",
							strategy: "lock",
						},
						"markdownlint-cli2-formatter-codequality": {
							range: "^0.0.7",
							peer: "^0.0.7",
							strategy: "lock",
						},
						react: {
							range: "^19.2.8",
							peer: "^19.2.0",
							strategy: "lock-minor",
						},
						"react-dom": {
							range: "^19.2.8",
							peer: "^19.2.0",
							strategy: "lock-minor",
						},
						tsx: {
							range: "^4.23.4",
							peer: "^4.23.4",
							strategy: "lock",
						},
						typescript: {
							range: "^7.0.2",
							peer: "^7.0.0",
							strategy: "lock-minor",
						},
					},
				},
				test: {
					packages: {
						"@vitest/coverage-istanbul": {
							range: "^4.1.10",
							peer: "^4.1.0",
							strategy: "lock-minor",
						},
						"@vitest/coverage-v8": {
							range: "^4.1.10",
							peer: "^4.1.0",
							strategy: "lock-minor",
						},
						vitest: {
							range: "^4.1.10",
							peer: "^4.1.0",
							strategy: "lock-minor",
						},
					},
				},
			},
			confirmModulesPurge: false,
			minimumReleaseAge: 1440,
			minimumReleaseAgeExclude: [
				"@effected/*",
				"@savvy-web/*",
				"@oxc-parser/*",
				"@oxc-project/*",
				"@spencerbeggs/*",
				"@typescript/*",
				"@vitest-agent/*",
				"api-extractor-llms",
				"config-file-effect",
				"jsonc-effect",
				"json-schema-effect",
				"oxc-parser",
				"package-json-effect",
				"reposets",
				"rolldown-pnpm-config",
				"rspress-plugin-api-extractor",
				"runtime-resolver",
				"semver-effect",
				"std-osc8",
				"type-registry-effect",
				"workspaces-effect",
				"xdg-effect",
				"vitest-bats",
				"yaml-effect",
			],
			overrides: {
				"@microsoft/api-extractor>typescript": "^6.0.3",
			},
			publicHoistPattern: {
				excludeByRepo: {
					"savvy-web-systems": ["@savvy-web/changelog", "@savvy-web/cli", "@savvy-web/mcp"],
					"vitest-agent": ["@vitest-agent/cli", "@vitest-agent/mcp"],
				},
				value: [
					"@changesets/cli",
					"@commitlint/cli",
					"@commitlint/config-conventional",
					"@commitlint/cz-commitlint",
					"@savvy-web/changelog",
					"@savvy-web/cli",
					"@savvy-web/mcp",
					"@types/bun",
					"@types/node",
					"@types/react",
					"@types/react-dom",
					"@typescript/native-preview",
					"@vitest-agent/cli",
					"@vitest-agent/mcp",
					"@vitest/coverage-istanbul",
					"@vitest/coverage-v8",
					"husky",
					"lint-staged",
					"markdownlint-cli2",
					"markdownlint-cli2-formatter-codequality",
					"tsx",
					"turbo",
					"typescript",
					"vitest",
				],
			},
			allowBuilds: {
				"@modelcontextprotocol/inspector": true,
				"@parcel/watcher": true,
				"better-sqlite3": true,
				"core-js": true,
				esbuild: true,
				"msgpackr-extract": true,
			},
			allowedDeprecatedVersions: {
				glob: "*",
				inflight: "*",
				"prebuild-install": "*",
				"@types/acorn": "*",
				"git-raw-commits": "*",
				"node-domexception": "*",
			},
			strictDepBuilds: true,
			blockExoticSubdeps: true,
			peerDependencyRules: {
				allowedVersions: {
					"tsdown>typescript": "^5.0.0 || ^6.0.0 || ^7.0.0",
					"@effect/vitest>vitest": "^4.1.0",
					"@typescript-eslint/project-service>typescript": "^6.0.0",
					"@typescript-eslint/tsconfig-utils>typescript": "^6.0.0",
					"@typescript-eslint/typescript-estree>typescript": "^6.0.0",
					"@typescript-eslint/util>typescript": "^6.0.0",
					"@typescript-eslint/utils>typescript": "^6.0.0",
					"eslint-plugin-tsdoc>typescript": "^6.0.0",
					"ink-tab>ink": "^7.0.0",
				},
			},
		}),
	],
	bundleNodeModules: true,
	looseFiles: {
		"pnpmfile.mjs": "./src/pnpmfile.ts",
		"pnpmfile.cjs": "./src/pnpmfile.ts",
	},
});
