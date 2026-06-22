import { Schema } from "effect";

/**
 * Comment syntax used to write managed section markers.
 *
 * @remarks
 * - `"#"` — shell/YAML style, suitable for hook scripts and `.env` files.
 * - `"//"` — C-style, suitable for JavaScript/TypeScript files.
 *
 * @since 0.1.0
 * @public
 */
export const CommentStyle = Schema.Literal("#", "//");
/**
 * @since 0.1.0
 * @public
 */
export type CommentStyle = typeof CommentStyle.Type;
