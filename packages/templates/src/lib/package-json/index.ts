import { Schema } from "effect";
import { sortPackageJson } from "sort-package-json";
import type { TemplateEntry } from "../types.js";

const Author = Schema.Struct({
	name: Schema.String,
	email: Schema.optional(Schema.String),
	url: Schema.optional(Schema.String),
});

const Bugs = Schema.Struct({
	url: Schema.String,
});

const Repository = Schema.Struct({
	type: Schema.String,
	url: Schema.String,
	directory: Schema.optional(Schema.String),
});

const PublishConfig = Schema.Struct({
	access: Schema.optional(Schema.String),
	directory: Schema.optional(Schema.String),
	linkDirectory: Schema.optional(Schema.Boolean),
	targets: Schema.optional(Schema.Unknown),
});

export const PackageJsonOptions = Schema.Struct({
	name: Schema.String,
	version: Schema.optionalWith(Schema.String, { default: () => "0.0.0" }),
	private: Schema.optional(Schema.Boolean),
	description: Schema.optional(Schema.String),
	homepage: Schema.optional(Schema.String),
	bugs: Schema.optional(Bugs),
	repository: Schema.optional(Repository),
	license: Schema.optional(Schema.String),
	author: Schema.optional(Author),
	sideEffects: Schema.optional(Schema.Boolean),
	type: Schema.optional(Schema.Literal("module", "commonjs")),
	exports: Schema.optional(Schema.Unknown),
	scripts: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
	dependencies: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
	devDependencies: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
	peerDependencies: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
	engines: Schema.optional(
		Schema.Struct({
			node: Schema.optional(Schema.String),
			pnpm: Schema.optional(Schema.String),
		}),
	),
	packageManager: Schema.optional(Schema.String),
	devEngines: Schema.optional(Schema.Unknown),
	publishConfig: Schema.optional(PublishConfig),
	keywords: Schema.optional(Schema.Array(Schema.String)),
});

export type PackageJsonOptionsType = typeof PackageJsonOptions.Type;

export function createPackageJson(options: unknown): TemplateEntry[] {
	const opts = Schema.decodeUnknownSync(PackageJsonOptions)(options);

	const pkg: Record<string, unknown> = { name: opts.name, version: opts.version };

	if (opts.private !== undefined) pkg.private = opts.private;
	if (opts.description) pkg.description = opts.description;
	if (opts.homepage) pkg.homepage = opts.homepage;
	if (opts.bugs) pkg.bugs = opts.bugs;
	if (opts.repository) pkg.repository = opts.repository;
	if (opts.license) pkg.license = opts.license;
	if (opts.author) pkg.author = opts.author;
	if (opts.sideEffects !== undefined) pkg.sideEffects = opts.sideEffects;
	if (opts.type) pkg.type = opts.type;
	if (opts.exports) pkg.exports = opts.exports;
	if (opts.scripts && Object.keys(opts.scripts).length > 0) pkg.scripts = opts.scripts;
	if (opts.dependencies && Object.keys(opts.dependencies).length > 0) pkg.dependencies = opts.dependencies;
	if (opts.devDependencies && Object.keys(opts.devDependencies).length > 0) pkg.devDependencies = opts.devDependencies;
	if (opts.peerDependencies && Object.keys(opts.peerDependencies).length > 0)
		pkg.peerDependencies = opts.peerDependencies;
	if (opts.engines) pkg.engines = opts.engines;
	if (opts.packageManager) pkg.packageManager = opts.packageManager;
	if (opts.devEngines) pkg.devEngines = opts.devEngines;
	if (opts.publishConfig) pkg.publishConfig = opts.publishConfig;
	if (opts.keywords && opts.keywords.length > 0) pkg.keywords = opts.keywords;

	const sorted = sortPackageJson(pkg);
	const content = JSON.stringify(sorted, null, "\t");

	return [{ name: "package-json", filename: "package.json", content }];
}
