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

/** A managed section located anywhere in a file, regardless of which tool owns it. */
interface FoundSection {
	/** Stable identity: uppercased tool name + comment style. */
	readonly key: string;
	readonly commentStyle: string;
	/** Inner content with the assembly boundary newlines stripped. */
	readonly content: string;
	/** Exact `[begin … end]` marker block as it appears in the file. */
	readonly raw: string;
	readonly start: number;
	readonly end: number;
}

const BEGIN_MARKER_RE = /^(#|\/\/) --- BEGIN (.+?) MANAGED SECTION ---$/gm;

function sectionKey(toolName: string, commentStyle: string): string {
	return `${toolName.toUpperCase()}::${commentStyle}`;
}

/**
 * Locate every managed section in `content`, in document order, across all tools and
 * comment styles. Unterminated begin markers are skipped.
 */
function findAllSections(content: string): FoundSection[] {
	const results: FoundSection[] = [];
	for (const match of content.matchAll(BEGIN_MARKER_RE)) {
		const style = match[1];
		const name = match[2];
		const beginStart = match.index;
		const beginEnd = beginStart + match[0].length;
		const end = `${style} --- END ${name} MANAGED SECTION ---`;
		const endIdx = content.indexOf(end, beginEnd);
		if (endIdx === -1) continue;

		let inner = content.slice(beginEnd, endIdx);
		if (inner.startsWith("\n")) inner = inner.slice(1);
		if (inner.endsWith("\n")) inner = inner.slice(0, -1);

		results.push({
			key: sectionKey(name, style),
			commentStyle: style,
			content: inner,
			raw: content.slice(beginStart, endIdx + end.length),
			start: beginStart,
			end: endIdx + end.length,
		});
	}
	return results;
}

/** A document broken into preserved text spans and managed-section placeholders. */
type SectionItem =
	| { kind: "text"; value: string }
	| { kind: "section"; key: string; raw: string; render: SectionBlock | null };

// ── Service ─────────────────────────────────────────────────────

/**
 * Service for managing delimited sections in user-editable files.
 *
 * All methods use dual API (data-first and data-last).
 * Identity-only operations (`read`, `isManaged`) take a {@link SectionDefinition}.
 * Content operations (`write`, `sync`, `check`) take a {@link SectionBlock}.
 *
 * @since 0.2.0
 * @public
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

		readonly syncMany: {
			(
				blocks: ReadonlyArray<SectionBlock>,
			): (path: string) => Effect.Effect<ReadonlyArray<SyncResult>, SectionWriteError>;
			(path: string, blocks: ReadonlyArray<SectionBlock>): Effect.Effect<ReadonlyArray<SyncResult>, SectionWriteError>;
		};

		readonly check: {
			(block: SectionBlock): (path: string) => Effect.Effect<CheckResult, SectionParseError>;
			(path: string, block: SectionBlock): Effect.Effect<CheckResult, SectionParseError>;
		};

		readonly remove: {
			(definition: SectionDefinition): (path: string) => Effect.Effect<boolean, SectionWriteError>;
			(path: string, definition: SectionDefinition): Effect.Effect<boolean, SectionWriteError>;
		};
	}
>() {}

// ── Layer ───────────────────────────────────────────────────────

/**
 * Live implementation of {@link ManagedSection} backed by `@effect/platform` FileSystem.
 *
 * @since 0.2.0
 * @public
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
						/* v8 ignore next -- error path requires filesystem read failure */
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
							/* v8 ignore next -- error path requires filesystem read failure */
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
						/* v8 ignore next -- error path requires filesystem write failure */
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
					)
						/* v8 ignore next -- error path requires the upstream read to fail */
						.pipe(Effect.mapError((cause) => new SectionWriteError({ path, reason: String(cause) })));

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

		const syncMany: ManagedSection["Type"]["syncMany"] = Fn.dual(
			2,
			(
				path: string,
				blocks: ReadonlyArray<SectionBlock>,
			): Effect.Effect<ReadonlyArray<SyncResult>, SectionWriteError> =>
				Effect.gen(function* () {
					const exists = yield* fs.exists(path).pipe(Effect.orElseSucceed(() => false));
					const original = exists
						? yield* fs
								.readFileString(path)
								/* v8 ignore next -- error path requires filesystem read failure */
								.pipe(Effect.mapError((cause) => new SectionWriteError({ path, reason: String(cause) })))
						: "";

					const keyOf = (b: SectionBlock): string => sectionKey(b.toolName, b.commentStyle);
					const found = findAllSections(original);

					// First occurrence per key — the current on-disk content for each tool.
					const onDiskByKey = new Map<string, FoundSection>();
					for (const f of found) {
						if (!onDiskByKey.has(f.key)) onDiskByKey.set(f.key, f);
					}

					// One result per input block, in input order. Tags are content-based,
					// matching `sync`: a pure reorder of identical content reports Unchanged.
					const results: SyncResult[] = blocks.map((block) => {
						const onDisk = onDiskByKey.get(keyOf(block));
						if (onDisk === undefined) return SyncResultEnum.Created();
						const current = SectionBlock.make({
							toolName: block.toolName,
							commentStyle: block.commentStyle,
							content: onDisk.content,
						});
						if (Equal.equals(current, block)) return SyncResultEnum.Unchanged();
						return SyncResultEnum.Updated({ diff: SectionBlock.diff(current, block) });
					});

					// Break the document into preserved text spans and section placeholders.
					const items: SectionItem[] = [];
					let cursor = 0;
					for (const f of found) {
						items.push({ kind: "text", value: original.slice(cursor, f.start) });
						items.push({ kind: "section", key: f.key, raw: f.raw, render: null });
						cursor = f.end;
					}
					items.push({ kind: "text", value: original.slice(cursor) });

					const targetKeys = new Set(blocks.map(keyOf));
					const slotIndices: number[] = [];
					items.forEach((item, idx) => {
						if (item.kind === "section" && targetKeys.has(item.key)) slotIndices.push(idx);
					});

					// Reassign present blocks (declared order) into existing slots (doc order).
					// This updates content in place and normalizes order around fixed text and
					// unrelated sections. Track where each present block landed for anchoring.
					const itemIndexByDeclared = new Map<number, number>();
					let slotCursor = 0;
					blocks.forEach((block, declaredIdx) => {
						if (!onDiskByKey.has(keyOf(block))) return;
						if (slotCursor >= slotIndices.length) return;
						const itemIdx = slotIndices[slotCursor];
						const item = items[itemIdx];
						if (item.kind === "section") item.render = block;
						itemIndexByDeclared.set(declaredIdx, itemIdx);
						slotCursor += 1;
					});

					// Place missing blocks: before the nearest present successor sibling, else
					// after the nearest present predecessor, else append at the end.
					const beforeAnchor = new Map<number, SectionBlock[]>();
					const afterAnchor = new Map<number, SectionBlock[]>();
					const appendList: SectionBlock[] = [];
					const pushInto = (map: Map<number, SectionBlock[]>, anchor: number, block: SectionBlock) => {
						const arr = map.get(anchor) ?? [];
						arr.push(block);
						map.set(anchor, arr);
					};

					blocks.forEach((block, i) => {
						if (onDiskByKey.has(keyOf(block))) return;
						let placed = false;
						for (let j = i + 1; j < blocks.length && !placed; j += 1) {
							const itemIdx = itemIndexByDeclared.get(j);
							if (itemIdx !== undefined) {
								pushInto(beforeAnchor, itemIdx, block);
								placed = true;
							}
						}
						for (let j = i - 1; j >= 0 && !placed; j -= 1) {
							const itemIdx = itemIndexByDeclared.get(j);
							if (itemIdx !== undefined) {
								pushInto(afterAnchor, itemIdx, block);
								placed = true;
							}
						}
						if (!placed) appendList.push(block);
					});

					// Render: preserved text verbatim, unrelated sections from raw, target
					// sections (and inserts) canonically. Inserts carry a blank-line separator.
					const out: string[] = [];
					items.forEach((item, idx) => {
						if (item.kind === "text") {
							out.push(item.value);
							return;
						}
						for (const block of beforeAnchor.get(idx) ?? []) {
							out.push(block.rendered, "\n\n");
						}
						out.push(item.render === null ? item.raw : item.render.rendered);
						for (const block of afterAnchor.get(idx) ?? []) {
							out.push("\n\n", block.rendered);
						}
					});

					let output = out.join("");
					for (const block of appendList) {
						output =
							output.trim() === "" ? `${block.rendered}\n` : `${output.replace(/\n+$/, "")}\n\n${block.rendered}\n`;
					}
					if (output !== "" && !output.endsWith("\n")) output += "\n";

					if (output !== original) {
						yield* fs
							.writeFileString(path, output)
							/* v8 ignore next -- error path requires filesystem write failure */
							.pipe(Effect.mapError((cause) => new SectionWriteError({ path, reason: String(cause) })));
					}

					return results;
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

		const remove: ManagedSection["Type"]["remove"] = Fn.dual(
			2,
			(path: string, definition: SectionDefinition): Effect.Effect<boolean, SectionWriteError> =>
				Effect.gen(function* () {
					const exists = yield* fs.exists(path).pipe(Effect.orElseSucceed(() => false));
					if (!exists) return false;

					const raw = yield* fs
						.readFileString(path)
						/* v8 ignore next -- error path requires filesystem read failure */
						.pipe(Effect.mapError((cause) => new SectionWriteError({ path, reason: String(cause) })));

					const parsed = parseContent(raw, definition.toolName, definition.commentStyle);
					if (parsed === null) return false;

					// Drop the markers' span, then collapse the surrounding blank lines into a
					// single separator so repeated removals never accumulate empty gaps.
					const before = parsed.before.replace(/\n+$/, "");
					const after = parsed.after.replace(/^\n+/, "");
					let next: string;
					if (before !== "" && after !== "") {
						next = `${before}\n\n${after}`;
					} else if (before !== "") {
						next = `${before}\n`;
					} else {
						next = after;
					}

					yield* fs
						.writeFileString(path, next)
						/* v8 ignore next -- error path requires filesystem write failure */
						.pipe(Effect.mapError((cause) => new SectionWriteError({ path, reason: String(cause) })));

					return true;
				}),
		);

		return { read, write, isManaged, sync, syncMany, check, remove };
	}),
);
