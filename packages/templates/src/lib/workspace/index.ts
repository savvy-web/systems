import { Schema } from "effect";
import { createBiome } from "../biome/index.js";
import { createChangeset } from "../changeset/index.js";
import { createGitignore } from "../gitignore/index.js";
import { createPackageJson } from "../package-json/index.js";
import { createPnpmWorkspace } from "../pnpm/index.js";
import { createReadme } from "../readme/index.js";
import { createTsConfig } from "../tsconfig/index.js";
import { createTurboRoot } from "../turbo/index.js";
import type { TemplateEntry } from "../types.js";
import { createVsCode } from "../vscode/index.js";

const Features = Schema.Struct({
	biome: Schema.optional(Schema.Boolean),
	vitest: Schema.optional(Schema.Boolean),
	turbo: Schema.optional(Schema.Boolean),
	changesets: Schema.optional(Schema.Boolean),
	vscode: Schema.optional(Schema.Boolean),
});

export const WorkspaceOptions = Schema.Struct({
	name: Schema.String,
	dirname: Schema.optional(Schema.String),
	packageManager: Schema.Literal("pnpm", "npm", "bun"),
	packageManagerVersion: Schema.String,
	nodeVersion: Schema.String,
	features: Schema.optional(Features),
});

export type WorkspaceOptionsType = typeof WorkspaceOptions.Type;

export function createWorkspace(options: unknown): TemplateEntry[] {
	const opts = Schema.decodeUnknownSync(WorkspaceOptions)(options);
	const features = opts.features ?? {};
	const entries: TemplateEntry[] = [];

	// Always included: package-json
	entries.push(
		...createPackageJson({
			name: opts.name,
			version: "0.0.0",
			private: true,
			type: "module",
			packageManager: `${opts.packageManager}@${opts.packageManagerVersion}`,
			engines: { node: `>=${opts.nodeVersion}` },
		}),
	);

	// Always included: tsconfig
	entries.push(...createTsConfig({}));

	// Always included: gitignore
	entries.push(
		...createGitignore({
			sections: {
				os: true,
				node: true,
				build: true,
				env: true,
				silk: !!features.changesets,
			},
		}),
	);

	// Always included: readme
	entries.push(...createReadme({ name: opts.name }));

	// pnpm workspace (when using pnpm)
	if (opts.packageManager === "pnpm") {
		entries.push(
			...createPnpmWorkspace({
				packages: ["packages/*"],
				autoInstallPeers: true,
			}),
		);
	}

	// Optional: biome
	if (features.biome) {
		entries.push(...createBiome({ version: "2.3.3", root: true }));
	}

	// Optional: turbo
	if (features.turbo) {
		entries.push(
			...createTurboRoot({
				tasks: {
					build: { dependsOn: ["^build"], outputs: ["dist/**"] },
					test: { dependsOn: ["build"] },
					"types:check": { cache: true, outputLogs: "errors-only" },
				},
				globalPassThroughEnv: ["CI", "GITHUB_ACTIONS"],
			}),
		);
	}

	// Optional: changesets
	if (features.changesets) {
		entries.push(...createChangeset({ access: "restricted" }));
	}

	// Optional: vscode
	if (features.vscode) {
		entries.push(
			...createVsCode({
				settings: {
					biome: !!features.biome,
					turbo: !!features.turbo,
					vitest: !!features.vitest,
				},
			}),
		);
	}

	return entries;
}
