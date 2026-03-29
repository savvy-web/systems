import { Schema } from "effect";

/**
 * Parsed result of reading a managed section from a file.
 *
 * @remarks
 * Produced by {@link ManagedSection.read}. The `before` and `after` strings
 * contain the file content surrounding the managed block; `managed` holds the
 * content between the BEGIN and END markers (excluding the markers themselves).
 *
 * @since 0.1.0
 */
export const ManagedSectionResult = Schema.Struct({
	before: Schema.String,
	managed: Schema.String,
	after: Schema.String,
});
/** @since 0.1.0 */
export type ManagedSectionResult = typeof ManagedSectionResult.Type;

/**
 * Comment syntax used to write managed section markers.
 *
 * @remarks
 * - `"#"` — shell/YAML style, suitable for hook scripts and `.env` files.
 * - `"//"` — C-style, suitable for JavaScript/TypeScript files.
 *
 * @since 0.1.0
 */
export const CommentStyle = Schema.Literal("#", "//");
/** @since 0.1.0 */
export type CommentStyle = typeof CommentStyle.Type;

/**
 * Options controlling how managed sections are identified in a file.
 *
 * @remarks
 * `toolName` is embedded in the BEGIN/END markers so multiple tools can coexist
 * in the same file without collision. `commentStyle` defaults to `"#"`.
 *
 * @since 0.1.0
 */
export const ManagedSectionOptions = Schema.Struct({
	toolName: Schema.String,
	commentStyle: Schema.optionalWith(CommentStyle, { default: () => "#" as const }),
});
/** @since 0.1.0 */
export type ManagedSectionOptions = typeof ManagedSectionOptions.Type;
