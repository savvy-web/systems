/**
 * Directory vendored reference repos live under, relative to the repo root.
 * @public
 */
export const REPOS_DIR = ".repos";

/**
 * Path of the committed vendored-repos manifest, relative to the repo root.
 * @public
 */
export const MANIFEST_PATH = ".repos/config.json";

/**
 * Maximum notes per vendored repo; enforced at write time to force
 * consolidation into orientation.
 * @public
 */
export const NOTE_LIMIT = 10;
