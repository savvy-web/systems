import { Data } from "effect";

export class ToolResolutionError extends Data.TaggedError("ToolResolutionError")<{
	readonly name: string;
	readonly reason: string;
}> {
	get message() {
		return `Tool resolution failed: ${this.name} — ${this.reason}`;
	}
}
