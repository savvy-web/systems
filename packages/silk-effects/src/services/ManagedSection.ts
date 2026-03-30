import { FileSystem } from "@effect/platform";
import { Context, Effect, Equal, Function as Fn, Layer } from "effect";
import { SectionParseError } from "../errors/SectionParseError.js";
import { SectionWriteError } from "../errors/SectionWriteError.js";
import { SectionBlock } from "../schemas/SectionBlock.js";
import type { SectionDefinition } from "../schemas/SectionDefinition.js";
import type { CheckResult, SyncResult } from "../schemas/SectionResults.js";
import { CheckResult as CheckResultEnum, SyncResult as SyncResultEnum } from "../schemas/SectionResults.js";

// ── Internal helpers ────────────────────────────────────────────

function beginMarker(toolName: string, commentStyle: string): string {
	return `${commentStyle} --- BEGIN ${toolName.toUpperCase()} MANAGED SECTION ---`;
}

function endMarker(toolName: string, commentStyle: string): string {
	return `${commentStyle} --- END ${toolName.toUpperCase()} MANAGED SECTION ---`;
}

function parseContent(
	content: string,
	toolName: string,
	commentStyle: string,
): { before: string; managed: string; after: string } | null {
	const begin = beginMarker(toolName, commentStyle);
	const end = endMarker(toolName, commentStyle);
	const beginIndex = content.indexOf(begin);
	const endIndex = content.indexOf(end);

	if (beginIndex === -1 || endIndex === -1 || endIndex <= beginIndex) {
		return null;
	}

	let managed = content.slice(beginIndex + begin.length, endIndex);
	// Strip boundary newlines added by assembly so round-trips stay clean
	if (managed.startsWith("\n")) managed = managed.slice(1);
	if (managed.endsWith("\n")) managed = managed.slice(0, -1);

	return {
		before: content.slice(0, beginIndex),
		managed,
		after: content.slice(endIndex + end.length),
	};
}

function assembleContent(
	before: string,
	managed: string,
	after: string,
	toolName: string,
	commentStyle: string,
): string {
	const begin = beginMarker(toolName, commentStyle);
	const end = endMarker(toolName, commentStyle);
	return `${before}${begin}\n${managed}\n${end}${after}`;
}

// ── Service ─────────────────────────────────────────────────────

/**
 * Service for managing delimited sections in user-editable files.
 *
 * All methods use dual API (data-first and data-last).
 * Identity-only operations (`read`, `isManaged`) take a {@link SectionDefinition}.
 * Content operations (`write`, `sync`, `check`) take a {@link SectionBlock}.
 *
 * @since 0.2.0
 */
export class ManagedSection extends Context.Tag("@savvy-web/silk-effects/ManagedSection")<
	ManagedSection,
	{
		readonly read: {
			(definition: SectionDefinition): (path: string) => Effect.Effect<SectionBlock | null, SectionParseError>;
			(path: string, definition: SectionDefinition): Effect.Effect<SectionBlock | null, SectionParseError>;
		};

		readonly isManaged: {
			(definition: SectionDefinition): (path: string) => Effect.Effect<boolean>;
			(path: string, definition: SectionDefinition): Effect.Effect<boolean>;
		};

		readonly write: {
			(block: SectionBlock): (path: string) => Effect.Effect<void, SectionWriteError>;
			(path: string, block: SectionBlock): Effect.Effect<void, SectionWriteError>;
		};

		readonly sync: {
			(block: SectionBlock): (path: string) => Effect.Effect<SyncResult, SectionWriteError>;
			(path: string, block: SectionBlock): Effect.Effect<SyncResult, SectionWriteError>;
		};

		readonly check: {
			(block: SectionBlock): (path: string) => Effect.Effect<CheckResult, SectionParseError>;
			(path: string, block: SectionBlock): Effect.Effect<CheckResult, SectionParseError>;
		};
	}
>() {}

// ── Layer ───────────────────────────────────────────────────────

/**
 * Live implementation of {@link ManagedSection} backed by `@effect/platform` FileSystem.
 *
 * @since 0.2.0
 */
export const ManagedSectionLive: Layer.Layer<ManagedSection, never, FileSystem.FileSystem> = Layer.effect(
	ManagedSection,
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;

		const read: ManagedSection["Type"]["read"] = Fn.dual(
			2,
			(path: string, definition: SectionDefinition): Effect.Effect<SectionBlock | null, SectionParseError> =>
				Effect.gen(function* () {
					const exists = yield* fs.exists(path).pipe(Effect.orElseSucceed(() => false));
					if (!exists) return null;

					const raw = yield* fs
						.readFileString(path)
						.pipe(Effect.mapError((cause) => new SectionParseError({ path, reason: String(cause) })));

					const parsed = parseContent(raw, definition.toolName, definition.commentStyle);
					if (parsed === null) return null;

					return SectionBlock.make({
						toolName: definition.toolName,
						commentStyle: definition.commentStyle,
						content: parsed.managed,
					});
				}),
		);

		const isManaged: ManagedSection["Type"]["isManaged"] = Fn.dual(
			2,
			(path: string, definition: SectionDefinition): Effect.Effect<boolean> =>
				Effect.gen(function* () {
					const exists = yield* fs.exists(path).pipe(Effect.orElseSucceed(() => false));
					if (!exists) return false;

					const raw = yield* fs.readFileString(path).pipe(Effect.orElseSucceed(() => ""));
					const begin = beginMarker(definition.toolName, definition.commentStyle);
					const end = endMarker(definition.toolName, definition.commentStyle);
					const beginIdx = raw.indexOf(begin);
					const endIdx = raw.indexOf(end);
					return beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx;
				}),
		);

		const write: ManagedSection["Type"]["write"] = Fn.dual(
			2,
			(path: string, block: SectionBlock): Effect.Effect<void, SectionWriteError> =>
				Effect.gen(function* () {
					const exists = yield* fs.exists(path).pipe(Effect.orElseSucceed(() => false));
					let fileContent: string;

					if (exists) {
						const raw = yield* fs
							.readFileString(path)
							.pipe(Effect.mapError((cause) => new SectionWriteError({ path, reason: String(cause) })));

						const parsed = parseContent(raw, block.toolName, block.commentStyle);

						if (parsed !== null) {
							fileContent = assembleContent(
								parsed.before,
								block.content,
								parsed.after,
								block.toolName,
								block.commentStyle,
							);
						} else {
							const trimmed = raw.trimEnd();
							const begin = beginMarker(block.toolName, block.commentStyle);
							const end = endMarker(block.toolName, block.commentStyle);
							fileContent = `${trimmed}\n\n${begin}\n${block.content}\n${end}\n`;
						}
					} else {
						const begin = beginMarker(block.toolName, block.commentStyle);
						const end = endMarker(block.toolName, block.commentStyle);
						fileContent = `${begin}\n${block.content}\n${end}\n`;
					}

					yield* fs
						.writeFileString(path, fileContent)
						.pipe(Effect.mapError((cause) => new SectionWriteError({ path, reason: String(cause) })));
				}),
		);

		const sync: ManagedSection["Type"]["sync"] = Fn.dual(
			2,
			(path: string, block: SectionBlock): Effect.Effect<SyncResult, SectionWriteError> =>
				Effect.gen(function* () {
					const onDisk = yield* (
						read(path, {
							toolName: block.toolName,
							commentStyle: block.commentStyle,
						} as SectionDefinition) as Effect.Effect<SectionBlock | null, SectionParseError>
					).pipe(Effect.mapError((cause) => new SectionWriteError({ path, reason: String(cause) })));

					if (onDisk === null) {
						yield* write(path, block);
						return SyncResultEnum.Created();
					}

					if (Equal.equals(onDisk, block)) {
						return SyncResultEnum.Unchanged();
					}

					const d = SectionBlock.diff(onDisk, block);
					yield* write(path, block);
					return SyncResultEnum.Updated({ diff: d });
				}),
		);

		const check: ManagedSection["Type"]["check"] = Fn.dual(
			2,
			(path: string, block: SectionBlock): Effect.Effect<CheckResult, SectionParseError> =>
				Effect.gen(function* () {
					const onDisk = yield* read(path, {
						toolName: block.toolName,
						commentStyle: block.commentStyle,
					} as SectionDefinition) as Effect.Effect<SectionBlock | null, SectionParseError>;

					if (onDisk === null) {
						return CheckResultEnum.NotFound();
					}

					const isUpToDate = Equal.equals(onDisk, block);
					const d = SectionBlock.diff(onDisk, block);
					return CheckResultEnum.Found({ isUpToDate, diff: d });
				}),
		);

		return { read, write, isManaged, sync, check };
	}),
);
