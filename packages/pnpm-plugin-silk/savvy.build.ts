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
							range: "^2.1.9",
							peer: "^2.1.0",
							strategy: "lock-minor",
						},
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
							range: "^1.2.1",
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
							range: "^4.23.4",
							peer: "^4.23.4",
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
							range: "^8.2.0",
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
							range: "^21.2.1",
							peer: "^21.2.1",
							strategy: "lock",
						},
						"@commitlint/config-conventional": {
							range: "^21.2.0",
							peer: "^21.2.0",
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
							range: "^2.10.8",
							peer: "^2.10.8",
							strategy: "lock",
						},
					},
				},
				silk: {
					packages: {
						"@changesets/cli": {
							range: "^3.0.0",
							peer: "^3.0.0",
							strategy: "lock",
						},
						"@commitlint/cli": {
							range: "^21.2.1",
							peer: "^21.2.1",
							strategy: "lock",
						},
						"@commitlint/config-conventional": {
							range: "^21.2.0",
							peer: "^21.2.0",
							strategy: "lock",
						},
						"@effect/ai": {
							range: "^0.36.0",
							peer: "^0.36.0",
							strategy: "interop",
						},
						"@effect/ai-amazon-bedrock": {
							range: "^0.16.1",
							peer: "^0.16.1",
							strategy: "interop",
						},
						"@effect/ai-anthropic": {
							range: "^0.26.0",
							peer: "^0.26.0",
							strategy: "interop",
						},
						"@effect/ai-google": {
							range: "^0.15.0",
							peer: "^0.15.0",
							strategy: "interop",
						},
						"@effect/ai-openai": {
							range: "^0.40.1",
							peer: "^0.40.1",
							strategy: "interop",
						},
						"@effect/cli": {
							range: "^0.75.2",
							peer: "^0.75.2",
							strategy: "interop",
						},
						"@effect/cluster": {
							range: "^0.59.0",
							peer: "^0.59.0",
							strategy: "interop",
						},
						"@effect/experimental": {
							range: "^0.60.0",
							peer: "^0.60.0",
							strategy: "interop",
						},
						"@effect/language-service": {
							range: "^0.86.6",
							peer: "^0.86.6",
							strategy: "interop",
						},
						"@effect/opentelemetry": {
							range: "^0.63.0",
							peer: "^0.63.0",
							strategy: "interop",
						},
						"@effect/platform": {
							range: "^0.96.2",
							peer: "^0.96.0",
							strategy: "interop",
						},
						"@effect/platform-browser": {
							range: "^0.76.0",
							peer: "^0.76.0",
							strategy: "interop",
						},
						"@effect/platform-bun": {
							range: "^0.90.0",
							peer: "^0.90.0",
							strategy: "interop",
						},
						"@effect/platform-node": {
							range: "^0.107.0",
							peer: "^0.107.0",
							strategy: "interop",
						},
						"@effect/platform-node-shared": {
							range: "^0.60.0",
							peer: "^0.60.0",
							strategy: "interop",
						},
						"@effect/printer": {
							range: "^0.49.0",
							peer: "^0.49.0",
							strategy: "interop",
						},
						"@effect/printer-ansi": {
							range: "^0.49.0",
							peer: "^0.49.0",
							strategy: "interop",
						},
						"@effect/rpc": {
							range: "^0.75.1",
							peer: "^0.75.1",
							strategy: "interop",
						},
						"@effect/sql": {
							range: "^0.51.1",
							peer: "^0.51.0",
							strategy: "interop",
						},
						"@effect/sql-clickhouse": {
							range: "^0.49.0",
							peer: "^0.49.0",
							strategy: "interop",
						},
						"@effect/sql-d1": {
							range: "^0.49.0",
							peer: "^0.49.0",
							strategy: "interop",
						},
						"@effect/sql-drizzle": {
							range: "^0.50.0",
							peer: "^0.50.0",
							strategy: "interop",
						},
						"@effect/sql-kysely": {
							range: "^0.47.0",
							peer: "^0.47.0",
							strategy: "interop",
						},
						"@effect/sql-libsql": {
							range: "^0.41.0",
							peer: "^0.41.0",
							strategy: "interop",
						},
						"@effect/sql-mssql": {
							range: "^0.52.0",
							peer: "^0.52.0",
							strategy: "interop",
						},
						"@effect/sql-mysql2": {
							range: "^0.52.0",
							peer: "^0.52.0",
							strategy: "interop",
						},
						"@effect/sql-pg": {
							range: "^0.52.1",
							peer: "^0.52.1",
							strategy: "interop",
						},
						"@effect/sql-sqlite-bun": {
							range: "^0.52.0",
							peer: "^0.52.0",
							strategy: "interop",
						},
						"@effect/sql-sqlite-do": {
							range: "^0.29.0",
							peer: "^0.29.0",
							strategy: "interop",
						},
						"@effect/sql-sqlite-node": {
							range: "^0.52.0",
							peer: "^0.52.0",
							strategy: "interop",
						},
						"@effect/sql-sqlite-react-native": {
							range: "^0.54.0",
							peer: "^0.54.0",
							strategy: "interop",
						},
						"@effect/sql-sqlite-wasm": {
							range: "^0.52.0",
							peer: "^0.52.0",
							strategy: "interop",
						},
						"@effect/tsgo": {
							range: "^0.19.0",
							peer: "^0.19.0",
							strategy: "interop",
						},
						"@effect/typeclass": {
							range: "^0.40.0",
							peer: "^0.40.0",
							strategy: "interop",
						},
						"@effect/vitest": {
							range: "^0.29.0",
							peer: "^0.29.0",
							strategy: "interop",
						},
						"@effect/workflow": {
							range: "^0.18.2",
							peer: "^0.18.2",
							strategy: "interop",
						},
						"@rsbuild/core": {
							range: "^2.1.9",
							peer: "^2.1.0",
							strategy: "lock-minor",
						},
						"@rspress/core": {
							range: "^2.0.19",
							peer: "^2.0.0",
							strategy: "lock-minor",
						},
						"@tsdown/exe": {
							range: "^0.22.14",
							peer: "^0.22.14",
							strategy: "lock",
						},
						"@tsdown/css": {
							range: "^0.22.14",
							peer: "^0.22.14",
							strategy: "lock",
						},
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
						effect: {
							range: "^3.21.4",
							peer: "^3.21.0",
							strategy: "interop",
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
						rolldown: {
							range: "^1.2.1",
							peer: "^1.2.0",
							strategy: "lock-minor",
						},
						tsdown: {
							range: "^0.22.14",
							peer: "^0.22.0",
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
						turbo: {
							range: "^2.10.8",
							peer: "^2.10.8",
							strategy: "lock",
						},
						vitest: {
							range: "^4.1.10",
							peer: "^4.1.0",
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
