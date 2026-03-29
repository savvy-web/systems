import { Effect, Equal, Function as Fn, Hash, Schema } from "effect";
import { SectionValidationError } from "../errors/SectionValidationError.js";
import type { CommentStyle } from "./CommentStyle.js";
import { CommentStyle as CommentStyleSchema } from "./CommentStyle.js";
import { SectionBlock } from "./SectionBlock.js";
import type { SectionDiff } from "./SectionResults.js";
import { SectionDiff as SectionDiffEnum } from "./SectionResults.js";

/**
 * Identity envelope for a managed section type.
 *
 * {@link Equal} compares on `toolName` + `commentStyle`.
 * Use {@link SectionDefinition.block | block()} to create a {@link SectionBlock},
 * or {@link SectionDefinition.generate | generate()} for a typed factory.
 *
 * @since 0.2.0
 */
export class SectionDefinition extends Schema.TaggedClass<SectionDefinition>()("SectionDefinition", {
	toolName: Schema.String,
	commentStyle: Schema.optionalWith(CommentStyleSchema, { default: () => "#" as const }),
}) {
	// ── Non-schema property: validation ─────────────────────────

	private _validate?: (block: SectionBlock) => boolean;

	// ── Statics (dual API) ──────────────────────────────────────

	static generate: {
		<C>(fn: (config: C) => string): (self: SectionDefinition) => (config: C) => SectionBlock;
		<C>(self: SectionDefinition, fn: (config: C) => string): (config: C) => SectionBlock;
	} = Fn.dual(2, <C>(self: SectionDefinition, fn: (config: C) => string): ((config: C) => SectionBlock) => {
		return (config: C) => self.block(fn(config));
	});

	static generateEffect: {
		<C, E, R>(
			fn: (config: C) => Effect.Effect<string, E, R>,
		): (self: SectionDefinition) => (config: C) => Effect.Effect<SectionBlock, E | SectionValidationError, R>;
		<C, E, R>(
			self: SectionDefinition,
			fn: (config: C) => Effect.Effect<string, E, R>,
		): (config: C) => Effect.Effect<SectionBlock, E | SectionValidationError, R>;
	} = Fn.dual(
		2,
		<C, E, R>(
			self: SectionDefinition,
			fn: (config: C) => Effect.Effect<string, E, R>,
		): ((config: C) => Effect.Effect<SectionBlock, E | SectionValidationError, R>) => {
			return (config: C) =>
				Effect.flatMap(fn(config), (content) => {
					try {
						return Effect.succeed(self.block(content));
					} catch (e) {
						return Effect.fail(e as SectionValidationError);
					}
				});
		},
	);

	static withValidation: {
		(fn: (block: SectionBlock) => boolean): (self: SectionDefinition) => SectionDefinition;
		(self: SectionDefinition, fn: (block: SectionBlock) => boolean): SectionDefinition;
	} = Fn.dual(2, (self: SectionDefinition, fn: (block: SectionBlock) => boolean): SectionDefinition => {
		const copy = SectionDefinition.make({ toolName: self.toolName, commentStyle: self.commentStyle });
		copy._validate = fn;
		return copy;
	});

	static diff: {
		(that: SectionDefinition): (self: SectionDefinition) => SectionDiff;
		(self: SectionDefinition, that: SectionDefinition): SectionDiff;
	} = Fn.dual(2, (self: SectionDefinition, that: SectionDefinition): SectionDiff => self.diff(that));

	// ── Instance ────────────────────────────────────────────────

	block(content: string): SectionBlock {
		const block = SectionBlock.make({
			toolName: this.toolName,
			commentStyle: this.commentStyle,
			content,
		});

		if (this._validate && !this._validate(block)) {
			throw new SectionValidationError({
				toolName: this.toolName,
				reason: "Content failed validation",
			});
		}

		return block;
	}

	generate<C>(fn: (config: C) => string): (config: C) => SectionBlock {
		return (config: C) => this.block(fn(config));
	}

	generateEffect<C, E, R>(
		fn: (config: C) => Effect.Effect<string, E, R>,
	): (config: C) => Effect.Effect<SectionBlock, E | SectionValidationError, R> {
		return (config: C) =>
			Effect.flatMap(fn(config), (content) => {
				try {
					return Effect.succeed(this.block(content));
				} catch (e) {
					return Effect.fail(e as SectionValidationError);
				}
			});
	}

	diff(that: SectionDefinition): SectionDiff {
		if (Equal.equals(this, that)) {
			return SectionDiffEnum.Unchanged();
		}
		return SectionDiffEnum.Changed({
			added: [
				that.toolName !== this.toolName ? `toolName: ${that.toolName}` : "",
				that.commentStyle !== this.commentStyle ? `commentStyle: ${that.commentStyle}` : "",
			].filter(Boolean),
			removed: [
				that.toolName !== this.toolName ? `toolName: ${this.toolName}` : "",
				that.commentStyle !== this.commentStyle ? `commentStyle: ${this.commentStyle}` : "",
			].filter(Boolean),
		});
	}

	get beginMarker(): string {
		return `${this.commentStyle} --- BEGIN ${this.toolName.toUpperCase()} MANAGED SECTION ---`;
	}

	get endMarker(): string {
		return `${this.commentStyle} --- END ${this.toolName.toUpperCase()} MANAGED SECTION ---`;
	}

	// ── Equal/Hash on toolName + commentStyle ───────────────────

	[Equal.symbol](that: Equal.Equal): boolean {
		if (!(that instanceof SectionDefinition)) return false;
		return this.toolName === that.toolName && this.commentStyle === that.commentStyle;
	}

	[Hash.symbol](): number {
		return Hash.cached(this)(Hash.combine(Hash.hash(this.toolName))(Hash.hash(this.commentStyle)));
	}
}

/**
 * Convenience section definition for shell hooks.
 *
 * `commentStyle` is always `"#"` — only `toolName` is required.
 *
 * @since 0.2.0
 */
export class ShellSectionDefinition extends Schema.TaggedClass<ShellSectionDefinition>()("ShellSectionDefinition", {
	toolName: Schema.String,
}) {
	get commentStyle(): CommentStyle {
		return "#";
	}

	block(content: string): SectionBlock {
		return SectionBlock.make({ toolName: this.toolName, commentStyle: "#", content });
	}

	generate<C>(fn: (config: C) => string): (config: C) => SectionBlock {
		return (config: C) => this.block(fn(config));
	}

	generateEffect<C, E, R>(
		fn: (config: C) => Effect.Effect<string, E, R>,
	): (config: C) => Effect.Effect<SectionBlock, E, R> {
		return (config: C) => Effect.map(fn(config), (content) => this.block(content));
	}

	get beginMarker(): string {
		return `# --- BEGIN ${this.toolName.toUpperCase()} MANAGED SECTION ---`;
	}

	get endMarker(): string {
		return `# --- END ${this.toolName.toUpperCase()} MANAGED SECTION ---`;
	}
}
