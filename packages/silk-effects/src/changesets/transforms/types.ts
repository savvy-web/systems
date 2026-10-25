/**
 * Shared type for the kit-node changelog transforms.
 *
 * @internal
 */

import type { Root } from "@effected/markdown";

/**
 * A changelog transform: takes a kit `Root` and returns the transformed `Root`.
 *
 * @remarks
 * Kit nodes are immutable, so a transform never mutates its input; it returns
 * a new `Root` (or the same instance when nothing changed).
 *
 * @internal
 */
export type ChangelogTransform = (root: Root) => Root;
