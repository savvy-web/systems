import { Context } from "effect";
import type { BuildReport, DiagnosticEntry, EmittedFile, PassReport, TargetGroupReport } from "./schema.js";

export type PassKind = PassReport["id"];

export interface DiagnosticInput {
	readonly source: DiagnosticEntry["source"];
	readonly level: DiagnosticEntry["level"];
	readonly text: string;
	readonly file?: string;
	readonly line?: number;
	readonly column?: number;
}

interface MutablePass {
	files: EmittedFile[];
	ms: number;
}

interface MutableGroup {
	id: string;
	entries: string[];
	passes: Map<PassKind, MutablePass>;
	warnings: DiagnosticEntry[];
	errors: DiagnosticEntry[];
	/** Tracks output paths already recorded for this group (first-write-wins dedup). */
	seenPaths: Set<string>;
	/** Tracks diagnostic keys already recorded for this group (first-write-wins dedup). */
	seenDiagnostics: Set<string>;
}

/**
 * Stateful build-event accumulator. The write surface is synchronous so it can be called directly
 * from tsdown's customLogger and API Extractor's messageCallback (both invoked synchronously).
 * `snapshot` builds the immutable BuildReport the Effect render pipeline consumes.
 */
export class BuildCollector {
	private readonly groups = new Map<string, MutableGroup>();

	private group(groupId: string): MutableGroup {
		let g = this.groups.get(groupId);
		if (g === undefined) {
			g = {
				id: groupId,
				entries: [],
				passes: new Map(),
				warnings: [],
				errors: [],
				seenPaths: new Set(),
				seenDiagnostics: new Set(),
			};
			this.groups.set(groupId, g);
		}
		return g;
	}

	private pass(groupId: string, pass: PassKind): MutablePass {
		const g = this.group(groupId);
		let p = g.passes.get(pass);
		if (p === undefined) {
			p = { files: [], ms: 0 };
			g.passes.set(pass, p);
		}
		return p;
	}

	registerGroup(groupId: string, entries: ReadonlyArray<string>): void {
		this.group(groupId).entries = [...entries];
	}

	recordEmitted(groupId: string, pass: PassKind, file: EmittedFile): void {
		const g = this.group(groupId);
		// For dual-format builds the dts pass re-emits the same .cjs chunk (to apply the cjs interop
		// footer). Count each output path once per group, attributed to the first pass that emits it.
		if (g.seenPaths.has(file.path)) return;
		g.seenPaths.add(file.path);
		this.pass(groupId, pass).files.push(file);
	}

	recordPassTiming(groupId: string, pass: PassKind, ms: number): void {
		this.pass(groupId, pass).ms += ms;
	}

	recordWarning(groupId: string, entry: DiagnosticInput): void {
		const g = this.group(groupId);
		const key = diagnosticKey(entry);
		if (g.seenDiagnostics.has(key)) return;
		g.seenDiagnostics.add(key);
		g.warnings.push(toEntry(entry));
	}

	recordError(groupId: string, entry: DiagnosticInput): void {
		const g = this.group(groupId);
		const key = diagnosticKey(entry);
		if (g.seenDiagnostics.has(key)) return;
		g.seenDiagnostics.add(key);
		g.errors.push(toEntry(entry));
	}

	snapshot(packageName: string): ReadonlyArray<BuildReport> {
		const targetGroups: TargetGroupReport[] = [];
		for (const g of this.groups.values()) {
			const passes: PassReport[] = [];
			let totalMs = 0;
			for (const [id, p] of g.passes) {
				passes.push({ id, files: p.files, ms: p.ms });
				totalMs += p.ms;
			}
			targetGroups.push({
				id: g.id,
				entries: g.entries,
				passes,
				warnings: g.warnings,
				errors: g.errors,
				timings: { totalMs },
			});
		}
		return [{ package: packageName, targetGroups }];
	}
}

function diagnosticKey(input: DiagnosticInput): string {
	return [
		input.source,
		input.level,
		input.text,
		input.file ?? "",
		String(input.line ?? ""),
		String(input.column ?? ""),
	].join("\x00");
}

function toEntry(input: DiagnosticInput): DiagnosticEntry {
	return {
		source: input.source,
		level: input.level,
		text: input.text,
		...(input.file !== undefined ? { file: input.file } : {}),
		...(input.line !== undefined ? { line: input.line } : {}),
		...(input.column !== undefined ? { column: input.column } : {}),
	};
}

export class BuildCollectorTag extends Context.Tag("@savvy-web/tsdown-plugins/BuildCollector")<
	BuildCollectorTag,
	BuildCollector
>() {}
