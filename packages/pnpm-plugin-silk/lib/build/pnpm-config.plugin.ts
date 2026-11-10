import { PnpmConfigPlugin } from "rolldown-pnpm-config";

// Holds the catalog literal at its PnpmConfigPlugin(...) call, which the upgrade CLI walks statically.
// The annotation names the return type, which inference would have to reach through rolldown, not a dependency here.
const plugin: ReturnType<typeof PnpmConfigPlugin> = PnpmConfigPlugin({
	name: "@savvy-web/pnpm-plugin-silk",
	catalogs: {
		// The build chain and toolchain (typescript, tsx, @types/node, react and its types) come from
		// @effected/pnpm-plugin-effected's effected:build catalog, in every catalog here; only what the kit
		// does not catalog stays. Its release-age excludes and root hoists for that chain are the kit's too.
		build: {
			packages: {
				"@types/bun": {
					range: "^1.4.4",
					peer: "^1.4.4",
					strategy: "lock",
				},
			},
		},
		docs: {
			packages: {
				"@rspress/core": {
					range: "^2.0.23",
					peer: "^2.0.0",
					strategy: "lock-minor",
				},
				"@rspress/plugin-sitemap": {
					range: "^2.0.23",
					peer: "^2.0.23",
					strategy: "lock",
				},
				"rspress-plugin-mermaid": {
					range: "^1.0.3",
					peer: "^1.0.3",
					strategy: "lock",
				},
				vite: {
					range: "^8.3.5",
					peer: "^8.3.0",
					strategy: "lock-minor",
				},
				vitepress: {
					range: "^2.0.0-alpha.21",
					peer: "^2.0.0-alpha.21",
					strategy: "lock",
				},
			},
		},
		lint: {
			packages: {
				"@biomejs/biome": {
					range: "2.6.6",
					peer: "2.6.6",
					strategy: "lock",
				},
				"@changesets/cli": {
					range: "^3.0.3",
					peer: "^3.0.3",
					strategy: "lock",
				},
				"@commitlint/cli": {
					range: "^21.2.4",
					peer: "^21.2.4",
					strategy: "lock",
				},
				"@commitlint/config-conventional": {
					range: "^21.2.4",
					peer: "^21.2.4",
					strategy: "lock",
				},
				husky: {
					range: "^9.1.7",
					peer: "^9.1.7",
					strategy: "lock",
				},
				"lint-staged": {
					range: "^17.6.0",
					peer: "^17.6.0",
					strategy: "lock",
				},
				"markdownlint-cli2": {
					range: "^0.24.0",
					peer: "^0.24.0",
					strategy: "lock",
				},
				"markdownlint-cli2-formatter-codequality": {
					range: "^0.0.8",
					peer: "^0.0.8",
					strategy: "lock",
				},
				turbo: {
					range: "^2.11.10",
					peer: "^2.11.10",
					strategy: "lock",
				},
			},
		},
		silk: {
			packages: {
				"@types/bun": {
					range: "^1.4.4",
					peer: "^1.4.4",
					strategy: "lock",
				},
				ink: {
					range: "^8.0.0",
					peer: "^8.0.0",
					strategy: "lock-minor",
				},
			},
		},
		test: {
			packages: {
				"@vitest/expect": {
					range: "^5.0.5",
					peer: "^5.0.0",
					strategy: "lock-minor",
				},
				"@vitest/coverage-istanbul": {
					range: "^5.0.5",
					peer: "^5.0.0",
					strategy: "lock-minor",
				},
				"@vitest/coverage-v8": {
					range: "^5.0.5",
					peer: "^5.0.0",
					strategy: "lock-minor",
				},
				vitest: {
					range: "^5.0.5",
					peer: "^5.0.0",
					strategy: "lock-minor",
				},
				vite: {
					range: "^8.3.5",
					peer: "^8.3.0",
					strategy: "lock-minor",
				},
				"@yarnpkg/cli-dist": {
					range: "^4.18.1",
					peer: "^4.18.0",
					strategy: "lock-minor",
				},
			},
		},
	},
	confirmModulesPurge: false,
	minimumReleaseAge: 1440,
	minimumReleaseAgeExclude: [
		"@oxc-parser/*",
		"@savvy-web/*",
		"@okfit/*",
		"@pluginfinity/*",
		"@pnpm/*",
		"@tsdoctor/*",
		"@vitest/*",
		"@vitest-agent/*",
		"@yarnpkg/*",
		"oxc-parser",
		"pluginfinity",
		"pnpm",
		"reposets",
		"rolldown-pnpm-config",
		"rspress-plugin-api-extractor",
		"runtime-resolver",
		"std-osc8",
		"vitepress-plugin-api-extractor",
		"vitest",
		"vitest-bats",
		"yarn",
	],
	local: {
		minimumReleaseAgeExclude: {
			value: ["@effected/pnpm-plugin-effected"],
			strategy: "merge",
		},
		peerDependencyRules: {
			allowedVersions: {
				"@typescript/vfs>typescript": "^5.5.0 || ^6.0.0 || ^7.0.0 || ^7.1.0-beta",
				"@commitlint/load>typescript": "^5.5.0 || ^6.0.0 || ^7.0.0 || ^7.1.0-beta",
				"@shikijs/twoslash>typescript": "^5.5.0 || ^6.0.0 || ^7.0.0 || ^7.1.0-beta",
				"tsdown>typescript": "^5.5.0 || ^6.0.0 || ^7.0.0 || ^7.1.0-beta",
				"twoslash-vue>typescript": "^5.5.0 || ^6.0.0 || ^7.0.0 || ^7.1.0-beta",
				"twoslash>typescript": "^5.5.0 || ^6.0.0 || ^7.0.0 || ^7.1.0-beta",
				"cosmiconfig>typescript": "^5.5.0 || ^6.0.0 || ^7.0.0 || ^7.1.0-beta",
				"vue>typescript": "^5.5.0 || ^6.0.0 || ^7.0.0 || ^7.1.0-beta",
			},
			ignoreMissing: [
				"typescript",
				"@types/node",
				"@changesets/cli",
				"@commitlint/cli",
				"@commitlint/config-conventional",
				"@types/bun",
				"@vitest/coverage-istanbul",
				"@vitest/coverage-v8",
				"husky",
				"@vitest/expect",
				"lint-staged",
				"markdownlint-cli2",
				"markdownlint-cli2-formatter-codequality",
				"tsx",
				"turbo",
				"vite",
				"vitest",
			],
		},
	},
	publicHoistPattern: {
		excludeByRepo: {
			// @savvy-web/cli and @savvy-web/mcp are gone from `value` below (silk
			// now owns the `savvy`/`savvy-mcp` bins itself as shims, systems#631),
			// so there is nothing left to exclude for either of them here.
			// @savvy-web/changelog stays excluded HERE: the hub declares it as a root
			// devDependency (a workspace link the changesets engine resolves by id from
			// the root); a public hoist would shadow that link with a second copy.
			"savvy-web-systems": ["@savvy-web/changelog"],
		},
		value: [
			"@changesets/cli",
			"@commitlint/cli",
			"@commitlint/config-conventional",
			"@commitlint/cz-commitlint",
			// Resolved BY ID, not a bin: the changesets engine looks up the
			// changelog id named in .changeset/config.json from the consumer
			// root, so it must be reachable there — unlike cli/mcp (removed;
			// silk now carries their bins itself), this is a resolution need.
			"@savvy-web/changelog",
			"@types/bun",
			"@vitest/coverage-istanbul",
			"@vitest/coverage-v8",
			"husky",
			"lint-staged",
			"markdownlint-cli2",
			"markdownlint-cli2-formatter-codequality",
			"turbo",
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
			"@typescript/vfs>typescript": "^5.5.0 || ^6.0.0 || ^7.0.0 || ^7.1.0-beta",
			"@commitlint/load>typescript": "^5.5.0 || ^6.0.0 || ^7.0.0 || ^7.1.0-beta",
			"@shikijs/twoslash>typescript": "^5.5.0 || ^6.0.0 || ^7.0.0 || ^7.1.0-beta",
			"tsdown>typescript": "^5.5.0 || ^6.0.0 || ^7.0.0 || ^7.1.0-beta",
			"twoslash-vue>typescript": "^5.5.0 || ^6.0.0 || ^7.0.0 || ^7.1.0-beta",
			"twoslash>typescript": "^5.5.0 || ^6.0.0 || ^7.0.0 || ^7.1.0-beta",
			"cosmiconfig>typescript": "^5.5.0 || ^6.0.0 || ^7.0.0 || ^7.1.0-beta",
			"vue>typescript": "^5.5.0 || ^6.0.0 || ^7.0.0 || ^7.1.0-beta",
		},
	},
});

export default plugin;
