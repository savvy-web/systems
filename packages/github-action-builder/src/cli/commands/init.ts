/* v8 ignore start - CLI commands require integration testing */
/**
 * Init command for GitHub Action Builder CLI.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Args, Command, Options } from "@effect/cli";
import { Console, Effect } from "effect";

/**
 * Action name positional argument.
 */
const actionNameArg = Args.text({ name: "action-name" }).pipe(
	Args.withDescription("Name of the GitHub Action (also the output directory)"),
);

/**
 * Force overwrite option.
 */
const forceOption = Options.boolean("force").pipe(
	Options.withAlias("f"),
	Options.withDescription("Overwrite existing files"),
	Options.withDefault(false),
);

/**
 * Get current package version (replaced at build time).
 */
const getPackageVersion = (): string => {
	return process.env.__PACKAGE_VERSION__ ?? "0.0.0";
};

/**
 * Generate package.json content.
 */
const generatePackageJson = (name: string): string => {
	const version = getPackageVersion();
	const pkg = {
		name,
		version: "0.0.0",
		private: true,
		type: "module",
		scripts: {
			build: "github-action-builder build",
			validate: "github-action-builder validate",
			typecheck: "tsc --noEmit",
		},
		devDependencies: {
			"@savvy-web/github-action-builder": `^${version}`,
			typescript: "^5.9.3",
		},
		dependencies: {
			"@actions/core": "^1.11.1",
			"@actions/github": "^6.0.0",
		},
	};
	return `${JSON.stringify(pkg, null, 2)}\n`;
};

/**
 * Generate tsconfig.json content.
 */
const generateTsConfig = (): string => {
	const config = {
		compilerOptions: {
			target: "ES2022",
			module: "NodeNext",
			moduleResolution: "NodeNext",
			strict: true,
			esModuleInterop: true,
			skipLibCheck: true,
			forceConsistentCasingInFileNames: true,
			declaration: false,
			outDir: "dist",
			rootDir: "src",
		},
		include: ["src/**/*.ts", "action.config.ts"],
		exclude: ["node_modules", "dist"],
	};
	return `${JSON.stringify(config, null, 2)}\n`;
};

/**
 * Generate action.yml content.
 */
const generateActionYml = (name: string): string => {
	return `name: "${name}"
description: "A GitHub Action built with @savvy-web/github-action-builder"
author: ""

inputs:
  example-input:
    description: "An example input"
    required: false
    default: "hello"

outputs:
  example-output:
    description: "An example output"

runs:
  using: "node24"
  main: "dist/main.js"
  pre: "dist/pre.js"
  post: "dist/post.js"

branding:
  icon: "zap"
  color: "blue"
`;
};

/**
 * Default configuration file content.
 */
const defaultConfig = `import { GitHubAction } from "@savvy-web/github-action-builder";

export default GitHubAction.create({
	// Entry points are auto-detected from src/main.ts, src/pre.ts, src/post.ts
	// Uncomment to customize:
	// entries: {
	//   main: "src/main.ts",
	//   pre: "src/pre.ts",
	//   post: "src/post.ts",
	// },

	// Build options
	// build: {
	//   minify: true,
	//   sourceMap: false,
	// },

	// Validation options
	// validation: {
	//   strict: undefined, // Auto-detects CI environment
	// },
});
`;

/**
 * Generate src/main.ts content.
 */
const mainTemplate = `import * as core from "@actions/core";

async function run(): Promise<void> {
	try {
		const input = core.getInput("example-input");
		core.info(\`Running main action with input: \${input}\`);

		// Your main action logic goes here

		core.setOutput("example-output", "success");
	} catch (error) {
		if (error instanceof Error) {
			core.setFailed(error.message);
		} else {
			core.setFailed("An unexpected error occurred");
		}
	}
}

run();
`;

/**
 * Generate src/pre.ts content.
 */
const preTemplate = `import * as core from "@actions/core";

async function run(): Promise<void> {
	try {
		core.info("Running pre action...");

		// Your pre-action setup logic goes here
		// This runs before the main action
	} catch (error) {
		if (error instanceof Error) {
			core.setFailed(error.message);
		} else {
			core.setFailed("An unexpected error occurred");
		}
	}
}

run();
`;

/**
 * Generate src/post.ts content.
 */
const postTemplate = `import * as core from "@actions/core";

async function run(): Promise<void> {
	try {
		core.info("Running post action...");

		// Your post-action cleanup logic goes here
		// This runs after the main action, even if it fails
	} catch (error) {
		if (error instanceof Error) {
			core.warning(error.message);
		} else {
			core.warning("An unexpected error occurred during cleanup");
		}
	}
}

run();
`;

/**
 * Write a file if it doesn't exist or force is enabled.
 */
const writeFile = (
	path: string,
	content: string,
	force: boolean,
	createdFiles: string[],
	skippedFiles: string[],
): void => {
	if (existsSync(path) && !force) {
		skippedFiles.push(path);
		return;
	}
	writeFileSync(path, content, "utf-8");
	createdFiles.push(path);
};

/**
 * Init command handler.
 */
const initHandler = ({ actionName, force }: { actionName: string; force: boolean }) =>
	Effect.gen(function* () {
		const cwd = process.cwd();
		const projectDir = resolve(cwd, actionName);
		const createdFiles: string[] = [];
		const skippedFiles: string[] = [];

		// Check if directory already exists and is not empty
		if (existsSync(projectDir) && !force) {
			yield* Console.error(`Directory already exists: ${actionName}`);
			yield* Console.error("Use --force to overwrite existing files.");
			return yield* Effect.fail(new Error("Directory exists"));
		}

		// Create project directory
		if (!existsSync(projectDir)) {
			mkdirSync(projectDir, { recursive: true });
		}

		// Ensure src directory exists
		const srcDir = resolve(projectDir, "src");
		if (!existsSync(srcDir)) {
			mkdirSync(srcDir, { recursive: true });
		}

		// Write package.json
		writeFile(resolve(projectDir, "package.json"), generatePackageJson(actionName), force, createdFiles, skippedFiles);

		// Write tsconfig.json
		writeFile(resolve(projectDir, "tsconfig.json"), generateTsConfig(), force, createdFiles, skippedFiles);

		// Write action.yml
		writeFile(resolve(projectDir, "action.yml"), generateActionYml(actionName), force, createdFiles, skippedFiles);

		// Write action.config.ts
		writeFile(resolve(projectDir, "action.config.ts"), defaultConfig, force, createdFiles, skippedFiles);

		// Write entry point files
		writeFile(resolve(srcDir, "main.ts"), mainTemplate, force, createdFiles, skippedFiles);
		writeFile(resolve(srcDir, "pre.ts"), preTemplate, force, createdFiles, skippedFiles);
		writeFile(resolve(srcDir, "post.ts"), postTemplate, force, createdFiles, skippedFiles);

		// Report results
		yield* Console.log(`Created ${actionName}/`);
		if (createdFiles.length > 0) {
			for (const file of createdFiles) {
				yield* Console.log(`  ${file.replace(`${projectDir}/`, "")}`);
			}
		}

		if (skippedFiles.length > 0) {
			yield* Console.log("\nSkipped existing files (use --force to overwrite):");
			for (const file of skippedFiles) {
				yield* Console.log(`  ${file.replace(`${projectDir}/`, "")}`);
			}
		}

		yield* Console.log("\nNext steps:");
		yield* Console.log(`  cd ${actionName}`);
		yield* Console.log("  npm install");
		yield* Console.log("  npm run build");
	});

/**
 * Init command - creates a new GitHub Action project.
 */
export const initCommand = Command.make("init", { actionName: actionNameArg, force: forceOption }, initHandler);
