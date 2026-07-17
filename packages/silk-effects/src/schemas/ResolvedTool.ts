import { Equal, Hash, Schema } from "effect";
import { ChildProcess } from "effect/unstable/process";
import { ToolCommand } from "../utils/ToolCommand.js";
import { ToolSource as ToolSourceSchema } from "./ToolResults.js";

const PackageManager = Schema.Literals(["npm", "pnpm", "yarn", "bun"]);

/**
 * Result of resolving a {@link ToolDefinition}.
 *
 * Provides `exec` and `dlx` to build commands for the resolved tool.
 *
 * @since 0.2.0
 * @public
 */
export class ResolvedTool extends Schema.TaggedClass<ResolvedTool>()("ResolvedTool", {
	name: Schema.String,
	source: ToolSourceSchema,
	version: Schema.Option(Schema.String),
	globalVersion: Schema.Option(Schema.String),
	localVersion: Schema.Option(Schema.String),
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
			return new ToolCommand(ChildProcess.make(this.name, args));
		}

		switch (this.packageManager) {
			case "pnpm":
				return new ToolCommand(ChildProcess.make("pnpm", ["exec", this.name, ...args]));
			case "npm":
				return new ToolCommand(ChildProcess.make("npx", ["--no", "--", this.name, ...args]));
			case "yarn":
				return new ToolCommand(ChildProcess.make("yarn", ["exec", this.name, ...args]));
			case "bun":
				return new ToolCommand(ChildProcess.make("bun", ["x", "--no-install", this.name, ...args]));
		}
	}

	dlx(...args: string[]): ToolCommand {
		switch (this.packageManager) {
			case "pnpm":
				return new ToolCommand(ChildProcess.make("pnpm", ["dlx", this.name, ...args]));
			case "npm":
				return new ToolCommand(ChildProcess.make("npx", [this.name, ...args]));
			case "yarn":
				return new ToolCommand(ChildProcess.make("yarn", ["dlx", this.name, ...args]));
			case "bun":
				return new ToolCommand(ChildProcess.make("bun", ["x", this.name, ...args]));
		}
	}

	[Equal.symbol](that: Equal.Equal): boolean {
		if (!(that instanceof ResolvedTool)) return false;
		return this.name === that.name && this.source === that.source && Equal.equals(this.version, that.version);
	}

	[Hash.symbol](): number {
		let h = Hash.hash(this.name);
		h = Hash.combine(h, Hash.hash(this.source));
		h = Hash.combine(h, Hash.hash(this.version));
		return Hash.optimize(h);
	}
}
