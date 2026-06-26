// packages/tsdown-plugins/src/dts/reexport-stub.ts
import ts from "typescript";

/**
 * The analysis of an entry source treated as a candidate re-export barrel.
 *
 * @public
 */
export interface ReexportBarrelAnalysis {
	/** Value (non-type-only) names the module re-exports, after `as` aliasing. */
	readonly valueNames: ReadonlyArray<string>;
	/** Type-only names the module re-exports (`export type { … }`), after `as` aliasing. */
	readonly typeNames: ReadonlyArray<string>;
	/**
	 * True iff EVERY top-level statement is a NAMED re-export `from` another module
	 * (`export { … } from "…"` / `export type { … } from "…"`). A module that declares anything
	 * locally, re-exports a namespace (`export * as NS from`), star-re-exports (`export * from`), or
	 * has a bare `export { … }` without `from` is NOT a pure named barrel and cannot be expressed as
	 * a thin re-export stub of another entry.
	 */
	readonly isPureNamedReexportBarrel: boolean;
}

/**
 * The set of names a module exports, plus whether that set is fully known.
 *
 * @public
 */
export interface ModuleExportNames {
	readonly names: ReadonlySet<string>;
	/**
	 * False when the module contains a star re-export (`export * from "…"`) whose target exports
	 * cannot be enumerated from this source alone — the name set is then a lower bound, not complete,
	 * so callers must not use it for a strict subset decision.
	 */
	readonly complete: boolean;
}

function parse(source: string, fileName: string): ts.SourceFile {
	return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, /*setParentNodes*/ false, ts.ScriptKind.TS);
}

/**
 * Analyze an entry source as a candidate pure re-export barrel: classify its re-exported names into
 * value vs type-only and report whether it is expressible as a thin stub. Pure parsing — no I/O.
 *
 * @public
 */
export function analyzeReexportBarrel(source: string, fileName = "entry.ts"): ReexportBarrelAnalysis {
	const sf = parse(source, fileName);
	const valueNames: string[] = [];
	const typeNames: string[] = [];
	let pure = true;
	for (const stmt of sf.statements) {
		if (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier !== undefined) {
			const clause = stmt.exportClause;
			if (clause !== undefined && ts.isNamedExports(clause)) {
				for (const el of clause.elements) {
					(stmt.isTypeOnly || el.isTypeOnly ? typeNames : valueNames).push(el.name.text);
				}
				continue;
			}
			// `export * from` (no clause) or `export * as NS from` (NamespaceExport): not a named barrel.
			pure = false;
			continue;
		}
		// A bare `export { … }` (no `from`), any local declaration, an import, or anything else means
		// the module is not a pure named re-export-from barrel.
		pure = false;
	}
	return { valueNames, typeNames, isPureNamedReexportBarrel: pure };
}

/**
 * Collect every name a module exports (named re-exports, namespace re-exports, and local `export`
 * declarations). Used to test whether a barrel's re-exports are a strict subset of a base entry, so
 * a stub re-exporting from that base resolves every symbol. Pure parsing — no I/O.
 *
 * @public
 */
export function collectExportNames(source: string, fileName = "entry.ts"): ModuleExportNames {
	const sf = parse(source, fileName);
	const names = new Set<string>();
	let complete = true;
	const addBindingName = (name: ts.BindingName): void => {
		if (ts.isIdentifier(name)) {
			names.add(name.text);
		} else {
			// Destructuring `export const { a, b } = …` — collect each bound identifier.
			for (const el of name.elements) {
				if (ts.isBindingElement(el)) addBindingName(el.name);
			}
		}
	};
	for (const stmt of sf.statements) {
		if (ts.isExportDeclaration(stmt)) {
			const clause = stmt.exportClause;
			if (clause === undefined) {
				// `export * from "…"` — cannot enumerate the target's names from here.
				if (stmt.moduleSpecifier !== undefined) complete = false;
				continue;
			}
			if (ts.isNamespaceExport(clause)) {
				names.add(clause.name.text);
				continue;
			}
			for (const el of clause.elements) names.add(el.name.text);
			continue;
		}
		const isExported = ts.canHaveModifiers(stmt)
			? (ts.getModifiers(stmt) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
			: false;
		if (!isExported) continue;
		if (ts.isVariableStatement(stmt)) {
			for (const decl of stmt.declarationList.declarations) addBindingName(decl.name);
		} else if (
			(ts.isFunctionDeclaration(stmt) ||
				ts.isClassDeclaration(stmt) ||
				ts.isInterfaceDeclaration(stmt) ||
				ts.isTypeAliasDeclaration(stmt) ||
				ts.isEnumDeclaration(stmt) ||
				ts.isModuleDeclaration(stmt)) &&
			stmt.name !== undefined &&
			ts.isIdentifier(stmt.name)
		) {
			names.add(stmt.name.text);
		}
	}
	return { names, complete };
}

/**
 * Render a thin re-export-stub `.d.ts`/`.d.cts` body: named re-exports of `valueNames` and
 * `typeNames` from `baseSpecifier` (the published file of the base entry, e.g. `./index.js` for the
 * ESM `.d.ts` or `./index.cjs` for the CJS `.d.cts`). Names are sorted so the output is
 * deterministic. Returns the empty string when there is nothing to re-export.
 *
 * @public
 */
export function renderReexportStub(options: {
	readonly valueNames: ReadonlyArray<string>;
	readonly typeNames: ReadonlyArray<string>;
	readonly baseSpecifier: string;
}): string {
	const sortedValues = [...options.valueNames].sort();
	const sortedTypes = [...options.typeNames].sort();
	const lines: string[] = [];
	if (sortedValues.length > 0) lines.push(`export { ${sortedValues.join(", ")} } from "${options.baseSpecifier}";`);
	if (sortedTypes.length > 0) lines.push(`export type { ${sortedTypes.join(", ")} } from "${options.baseSpecifier}";`);
	return lines.length > 0 ? `${lines.join("\n")}\n` : "";
}
