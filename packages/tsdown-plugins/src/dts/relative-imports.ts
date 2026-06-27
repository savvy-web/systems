// packages/tsdown-plugins/src/dts/relative-imports.ts
import ts from "typescript";

const isRelative = (s: string): boolean => s.startsWith("./") || s.startsWith("../");

/**
 * Find every relative module specifier in a declaration source: static `import`/`export … from`,
 * `import("…")` type nodes, and `/// <reference path="…" />`. Pure parsing — no I/O.
 *
 * A non-empty result means the file is NOT self-contained and would break when copied verbatim to a
 * flattened output location, so the ambient-copy step rejects it.
 * @public
 */
export function findRelativeSpecifiers(source: string, fileName = "ambient.d.ts"): string[] {
	const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, /*setParentNodes*/ false, ts.ScriptKind.TS);
	const found = new Set<string>();
	for (const ref of sf.referencedFiles) if (isRelative(ref.fileName)) found.add(ref.fileName);
	const visit = (node: ts.Node): void => {
		if (
			(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
			node.moduleSpecifier !== undefined &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			if (isRelative(node.moduleSpecifier.text)) found.add(node.moduleSpecifier.text);
		} else if (
			ts.isImportTypeNode(node) &&
			ts.isLiteralTypeNode(node.argument) &&
			ts.isStringLiteral(node.argument.literal)
		) {
			if (isRelative(node.argument.literal.text)) found.add(node.argument.literal.text);
		} else if (
			ts.isImportEqualsDeclaration(node) &&
			ts.isExternalModuleReference(node.moduleReference) &&
			ts.isStringLiteral(node.moduleReference.expression)
		) {
			if (isRelative(node.moduleReference.expression.text)) found.add(node.moduleReference.expression.text);
		}
		ts.forEachChild(node, visit);
	};
	visit(sf);
	return [...found];
}
