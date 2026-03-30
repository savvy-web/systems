import { Equal, Function as Fn, Hash, Schema } from "effect";
import { CommentStyle as CommentStyleSchema } from "./CommentStyle.js";
import type { SectionDiff } from "./SectionResults.js";
import { SectionDiff as SectionDiffEnum } from "./SectionResults.js";

/**
 * The content between managed section markers.
 *
 * {@link Equal} compares normalized content only (trimmed, whitespace-collapsed).
 * Use {@link SectionBlock.diff | diff} to compute line-level differences.
 *
 * @since 0.2.0
 */
export class SectionBlock extends Schema.TaggedClass<SectionBlock>()("SectionBlock", {
	toolName: Schema.String,
	commentStyle: CommentStyleSchema,
	content: Schema.String,
}) {
	// ── Statics (dual API) ──────────────────────────────────────

	static diff: {
		(that: SectionBlock): (self: SectionBlock) => SectionDiff;
		(self: SectionBlock, that: SectionBlock): SectionDiff;
	} = Fn.dual(2, (self: SectionBlock, that: SectionBlock): SectionDiff => self.diff(that));

	static prepend: {
		(lines: string): (self: SectionBlock) => SectionBlock;
		(self: SectionBlock, lines: string): SectionBlock;
	} = Fn.dual(2, (self: SectionBlock, lines: string): SectionBlock => self.prepend(lines));

	static append: {
		(lines: string): (self: SectionBlock) => SectionBlock;
		(self: SectionBlock, lines: string): SectionBlock;
	} = Fn.dual(2, (self: SectionBlock, lines: string): SectionBlock => self.append(lines));

	// ── Instance ────────────────────────────────────────────────

	get text(): string {
		return this.content;
	}

	get normalized(): string {
		return this.content.trim().replace(/\s+/g, " ");
	}

	get rendered(): string {
		const begin = `${this.commentStyle} --- BEGIN ${this.toolName.toUpperCase()} MANAGED SECTION ---`;
		const end = `${this.commentStyle} --- END ${this.toolName.toUpperCase()} MANAGED SECTION ---`;
		return `${begin}\n${this.content}\n${end}`;
	}

	prepend(lines: string): SectionBlock {
		return SectionBlock.make({
			toolName: this.toolName,
			commentStyle: this.commentStyle,
			content: `${lines}\n${this.content}`,
		});
	}

	append(lines: string): SectionBlock {
		return SectionBlock.make({
			toolName: this.toolName,
			commentStyle: this.commentStyle,
			content: `${this.content}\n${lines}`,
		});
	}

	diff(that: SectionBlock): SectionDiff {
		if (this.normalized === that.normalized) {
			return SectionDiffEnum.Unchanged();
		}

		const selfLines = this.content.trim().split("\n");
		const thatLines = that.content.trim().split("\n");
		const selfSet = new Set(selfLines);
		const thatSet = new Set(thatLines);

		const removed = selfLines.filter((line) => !thatSet.has(line));
		const added = thatLines.filter((line) => !selfSet.has(line));

		return SectionDiffEnum.Changed({ added, removed });
	}

	// ── Equal/Hash on normalized content ────────────────────────

	[Equal.symbol](that: Equal.Equal): boolean {
		if (!(that instanceof SectionBlock)) return false;
		return this.normalized === that.normalized;
	}

	[Hash.symbol](): number {
		return Hash.cached(this)(Hash.hash(this.normalized));
	}
}
