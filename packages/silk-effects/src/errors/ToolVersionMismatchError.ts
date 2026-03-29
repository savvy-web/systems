import { Data } from "effect";

export class ToolVersionMismatchError extends Data.TaggedError("ToolVersionMismatchError")<{
	readonly name: string;
	readonly globalVersion: string;
	readonly localVersion: string;
}> {
	get message() {
		return `Tool version mismatch: ${this.name} — global ${this.globalVersion} vs local ${this.localVersion}`;
	}
}
