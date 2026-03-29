import { Command } from "@effect/platform";
import { Equal, Hash, Schema } from "effect";
import { ToolCommand } from "../utils/ToolCommand.js";
import { ToolSource as ToolSourceSchema } from "./ToolResults.js";

const PackageManager = Schema.Literal("npm", "pnpm", "yarn", "bun");

/**
 * Result of resolving a {@link ToolDefinition}.
 *
 * Provides {@link exec} and {@link dlx} to build commands for the resolved tool.
 *
 * @since 0.2.0
 */
export class ResolvedTool extends Schema.TaggedClass<ResolvedTool>()("ResolvedTool", {
	name: Schema.String,
	source: ToolSourceSchema,
	version: Schema.OptionFromSelf(Schema.String),
	globalVersion: Schema.OptionFromSelf(Schema.String),
	localVersion: Schema.OptionFromSelf(Schema.String),
	packageManager: PackageManager,
	mismatch: Schema.Boolean,
}) {
	get isGlobal(): boolean {
		return this.source === "global";
	}

	get isLocal(): boolean {
		return this.source === "local";
	}

	get hasVersionMismatch(): boolean {
		return this.mismatch;
	}

	exec(...args: string[]): ToolCommand {
		if (this.source === "global") {
			return new ToolCommand(Command.make(this.name, ...args));
		}

		switch (this.packageManager) {
			case "pnpm":
				return new ToolCommand(Command.make("pnpm", "exec", this.name, ...args));
			case "npm":
				return new ToolCommand(Command.make("npx", "--no", "--", this.name, ...args));
			case "yarn":
				return new ToolCommand(Command.make("yarn", "exec", this.name, ...args));
			case "bun":
				return new ToolCommand(Command.make("bun", "x", "--no-install", this.name, ...args));
		}
	}

	dlx(...args: string[]): ToolCommand {
		switch (this.packageManager) {
			case "pnpm":
				return new ToolCommand(Command.make("pnpm", "dlx", this.name, ...args));
			case "npm":
				return new ToolCommand(Command.make("npx", this.name, ...args));
			case "yarn":
				return new ToolCommand(Command.make("yarn", "dlx", this.name, ...args));
			case "bun":
				return new ToolCommand(Command.make("bun", "x", this.name, ...args));
		}
	}

	[Equal.symbol](that: Equal.Equal): boolean {
		if (!(that instanceof ResolvedTool)) return false;
		return this.name === that.name && this.source === that.source && Equal.equals(this.version, that.version);
	}

	[Hash.symbol](): number {
		let h = Hash.hash(this.name);
		h = Hash.combine(h)(Hash.hash(this.source));
		h = Hash.combine(h)(Hash.hash(this.version));
		return Hash.cached(this)(h);
	}
}
