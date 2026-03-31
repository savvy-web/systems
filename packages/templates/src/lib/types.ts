/**
 * A generated content entry from a template.
 *
 * Templates produce content with a logical name and suggested filename.
 * The consumer decides where (and whether) to write the content.
 */
export interface TemplateEntry {
	/** Logical name for this entry (e.g., "tsconfig", "biome", "vscode-settings") */
	readonly name: string;
	/** Suggested default filename (e.g., "tsconfig.json", ".vscode/settings.json") */
	readonly filename: string;
	/** The generated file content */
	readonly content: string;
}

/** A template: typed options in, content entries out. */
export type Template<O> = (options: O) => TemplateEntry[];

/** An update template: existing content + partial options in, content entries out. */
export type UpdateTemplate<O> = (existing: string, options: Partial<O>) => TemplateEntry[];
