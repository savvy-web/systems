/**
 * Simple logging utility for changelog generation.
 *
 * @remarks
 * Provides environment-aware warning output:
 * - **GitHub Actions**: emits `::warning::` annotations that surface in
 *   the Actions UI
 * - **Local development**: falls back to `console.warn`
 * - **Test environment**: suppressed entirely when `process.env.VITEST`
 *   is set, preventing noisy test output
 *
 * @internal
 */

/**
 * Log a warning message.
 *
 * @remarks
 * Detection order:
 * 1. If `process.env.VITEST` is set, the message is silently discarded.
 * 2. If `process.env.GITHUB_ACTIONS === "true"`, the message is emitted
 *    as a `::warning::` annotation.
 * 3. Otherwise, `console.warn` is used.
 *
 * @param message - The warning message
 * @param args - Additional arguments (concatenated with a space in CI mode)
 *
 * @example
 * ```typescript
 * import { logWarning } from "../utils/logger.js";
 *
 * logWarning("Duplicate dependency entry", "effect@3.19.0");
 * // In CI: "::warning::Duplicate dependency entry effect@3.19.0"
 * // Locally: console.warn("Duplicate dependency entry", "effect@3.19.0")
 * ```
 *
 * @internal
 */
export function logWarning(message: string, ...args: unknown[]): void {
	/* v8 ignore start — environment-specific */
	if (typeof process !== "undefined" && process.env.VITEST) {
		return;
	}
	if (typeof process !== "undefined" && process.env.GITHUB_ACTIONS === "true") {
		const text = args.length > 0 ? `${message} ${args.join(" ")}` : message;
		console.warn(`::warning::${text}`);
	} else {
		console.warn(message, ...args);
	}
	/* v8 ignore stop */
}
