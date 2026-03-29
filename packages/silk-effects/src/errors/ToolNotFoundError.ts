import { Data } from "effect";

export class ToolNotFoundError extends Data.TaggedError("ToolNotFoundError")<{
	readonly name: string;
	readonly reason: string;
}> {
	get message() {
		return `Tool not found: ${this.name} — ${this.reason}`;
	}
}
