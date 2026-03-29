import { FileSystem } from "@effect/platform";
import { Context, Effect, Layer } from "effect";
import { ManagedSectionParseError, ManagedSectionWriteError } from "./errors.js";
import type { ManagedSectionResult } from "./schemas.js";

/** Build the BEGIN marker line for a given tool and comment style. */
function beginMarker(toolName: string, commentStyle: string): string {
	return `${commentStyle} --- BEGIN ${toolName.toUpperCase()} MANAGED SECTION ---`;
}

/** Build the END marker line for a given tool and comment style. */
function endMarker(toolName: string, commentStyle: string): string {
	return `${commentStyle} --- END ${toolName.toUpperCase()} MANAGED SECTION ---`;
}

/**
 * Parse raw file content into before/managed/after parts.
 * Returns null when no markers are found.
 */
function parseContent(content: string, toolName: string, commentStyle: string): ManagedSectionResult | null {
	const begin = beginMarker(toolName, commentStyle);
	const end = endMarker(toolName, commentStyle);

	const beginIndex = content.indexOf(begin);
	const endIndex = content.indexOf(end);

	if (beginIndex === -1 || endIndex === -1 || endIndex <= beginIndex) {
		return null;
	}

	const before = content.slice(0, beginIndex);
	const managed = content.slice(beginIndex + begin.length, endIndex);
	const after = content.slice(endIndex + end.length);

	return { before, managed, after };
}

/**
 * Assemble file content from before/managed/after parts plus markers.
 */
function assembleContent(
	before: string,
	managed: string,
	after: string,
	toolName: string,
	commentStyle: string,
): string {
	const begin = beginMarker(toolName, commentStyle);
	const end = endMarker(toolName, commentStyle);
	return `${before}${begin}${managed}${end}${after}`;
}

/**
 * Service providing managed section operations for tool-owned regions
 * within user-editable files (e.g. husky hooks).
 *
 * @remarks
 * A managed section is a delimited block in a file bounded by BEGIN/END marker comments.
 * The markers embed the tool name so multiple tools can manage independent sections in
 * the same file. User content outside the markers is always preserved.
 *
 * @example
 * ```typescript
 * const result = await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const section = yield* ManagedSection;
 *     yield* section.write(".husky/pre-commit", "silk", "\nnpx lint-staged\n");
 *     return yield* section.read(".husky/pre-commit", "silk");
 *   }).pipe(
 *     Effect.provide(ManagedSectionLive),
 *     Effect.provide(NodeContext.layer),
 *   )
 * );
 * ```
 *
 * @since 0.1.0
 */
export class ManagedSection extends Context.Tag("@savvy-web/silk-effects/ManagedSection")<
	ManagedSection,
	{
		/**
		 * Read and parse the managed section from a file.
		 *
		 * @param path - Absolute path to the file.
		 * @param toolName - Tool identifier embedded in the section markers.
		 * @param commentStyle - Comment prefix to use (`"#"` or `"//"`, defaults to `"#"`).
		 * @returns An `Effect` that succeeds with a {@link ManagedSectionResult} when markers
		 *   are found, `null` when the file has no markers, or fails with
		 *   {@link ManagedSectionParseError} on I/O errors.
		 *
		 * @since 0.1.0
		 */
		readonly read: (
			path: string,
			toolName: string,
			commentStyle?: string,
		) => Effect.Effect<ManagedSectionResult | null, ManagedSectionParseError>;

		/**
		 * Write managed content to a file.
		 *
		 * @remarks
		 * - Replaces the existing managed section when markers are already present.
		 * - Appends a new managed section when the file exists but has no markers.
		 * - Creates the file when it does not exist.
		 *
		 * @param path - Absolute path to the file.
		 * @param toolName - Tool identifier embedded in the section markers.
		 * @param content - Content to place inside the managed section (between markers).
		 * @param commentStyle - Comment prefix to use (`"#"` or `"//"`, defaults to `"#"`).
		 * @returns An `Effect` that succeeds with `void` or fails with {@link ManagedSectionWriteError}.
		 *
		 * @since 0.1.0
		 */
		readonly write: (
			path: string,
			toolName: string,
			content: string,
			commentStyle?: string,
		) => Effect.Effect<void, ManagedSectionWriteError>;

		/**
		 * Read-then-write convenience method that replaces managed content while
		 * preserving surrounding user content.
		 *
		 * @param path - Absolute path to the file.
		 * @param toolName - Tool identifier embedded in the section markers.
		 * @param content - Replacement content for the managed section.
		 * @param commentStyle - Comment prefix to use (`"#"` or `"//"`, defaults to `"#"`).
		 * @returns An `Effect` that succeeds with `void` or fails with {@link ManagedSectionWriteError}.
		 *
		 * @since 0.1.0
		 */
		readonly update: (
			path: string,
			toolName: string,
			content: string,
			commentStyle?: string,
		) => Effect.Effect<void, ManagedSectionWriteError>;

		/**
		 * Return `true` when the file contains both BEGIN and END markers for the given tool.
		 *
		 * @param path - Absolute path to the file.
		 * @param toolName - Tool identifier to search for in the markers.
		 * @param commentStyle - Comment prefix to match (`"#"` or `"//"`, defaults to `"#"`).
		 * @returns An `Effect` that always succeeds with a boolean.
		 *
		 * @since 0.1.0
		 */
		readonly isManaged: (path: string, toolName: string, commentStyle?: string) => Effect.Effect<boolean>;
	}
>() {}

/**
 * Live implementation of {@link ManagedSection} backed by `@effect/platform` FileSystem.
 *
 * @remarks
 * Requires `FileSystem` from `@effect/platform`. Provide `NodeContext.layer` or
 * `BunContext.layer` to satisfy this dependency.
 *
 * @since 0.1.0
 */
export const ManagedSectionLive: Layer.Layer<ManagedSection, never, FileSystem.FileSystem> = Layer.effect(
	ManagedSection,
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;

		const read = (
			path: string,
			toolName: string,
			commentStyle = "#",
		): Effect.Effect<ManagedSectionResult | null, ManagedSectionParseError> =>
			Effect.gen(function* () {
				const exists = yield* fs.exists(path).pipe(Effect.orElseSucceed(() => false));
				if (!exists) return null;

				const raw = yield* fs.readFileString(path).pipe(
					Effect.mapError(
						(cause) =>
							new ManagedSectionParseError({
								path,
								reason: String(cause),
							}),
					),
				);

				return parseContent(raw, toolName, commentStyle);
			});

		const write = (
			path: string,
			toolName: string,
			content: string,
			commentStyle = "#",
		): Effect.Effect<void, ManagedSectionWriteError> =>
			Effect.gen(function* () {
				const exists = yield* fs.exists(path).pipe(Effect.orElseSucceed(() => false));

				let fileContent: string;

				if (exists) {
					const raw = yield* fs.readFileString(path).pipe(
						Effect.mapError(
							(cause) =>
								new ManagedSectionWriteError({
									path,
									reason: String(cause),
								}),
						),
					);

					const parsed = parseContent(raw, toolName, commentStyle);

					if (parsed !== null) {
						// Replace existing managed section, preserving before/after
						fileContent = assembleContent(parsed.before, content, parsed.after, toolName, commentStyle);
					} else {
						// Append managed section to existing content
						const trimmed = raw.trimEnd();
						const begin = beginMarker(toolName, commentStyle);
						const end = endMarker(toolName, commentStyle);
						fileContent = `${trimmed}\n\n${begin}${content}${end}\n`;
					}
				} else {
					// Create new file with only the managed section
					const begin = beginMarker(toolName, commentStyle);
					const end = endMarker(toolName, commentStyle);
					fileContent = `${begin}${content}${end}\n`;
				}

				yield* fs.writeFileString(path, fileContent).pipe(
					Effect.mapError(
						(cause) =>
							new ManagedSectionWriteError({
								path,
								reason: String(cause),
							}),
					),
				);
			});

		const update = (
			path: string,
			toolName: string,
			content: string,
			commentStyle = "#",
		): Effect.Effect<void, ManagedSectionWriteError> => write(path, toolName, content, commentStyle);

		const isManaged = (path: string, toolName: string, commentStyle = "#"): Effect.Effect<boolean> =>
			Effect.gen(function* () {
				const exists = yield* fs.exists(path).pipe(Effect.orElseSucceed(() => false));
				if (!exists) return false;

				const raw = yield* fs.readFileString(path).pipe(Effect.orElseSucceed(() => ""));

				const begin = beginMarker(toolName, commentStyle);
				const end = endMarker(toolName, commentStyle);
				const beginIdx = raw.indexOf(begin);
				const endIdx = raw.indexOf(end);
				return beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx;
			});

		return { read, write, update, isManaged };
	}),
);
