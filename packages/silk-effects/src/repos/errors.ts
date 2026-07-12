import { Data } from "effect";

/** @internal */
export const ReposConfigErrorBase = Data.TaggedError("ReposConfigError");
/**
 * The .repos/config.json manifest is missing, unreadable, or invalid.
 * @public
 */
export class ReposConfigError extends ReposConfigErrorBase<{
	readonly path: string;
	readonly reason: string;
}> {
	get message(): string {
		return `repos manifest error at ${this.path}: ${this.reason}`;
	}
}

/** @internal */
export const GitSubmoduleErrorBase = Data.TaggedError("GitSubmoduleError");
/**
 * A git submodule operation failed.
 * @public
 */
export class GitSubmoduleError extends GitSubmoduleErrorBase<{
	readonly command: string;
	readonly cwd: string;
	readonly reason: string;
}> {
	get message(): string {
		return `git command failed in ${this.cwd}: ${this.command}\n${this.reason}`;
	}
}

/** @internal */
export const RepoNotFoundErrorBase = Data.TaggedError("RepoNotFoundError");
/**
 * The named repo is not present in the manifest.
 * @public
 */
export class RepoNotFoundError extends RepoNotFoundErrorBase<{ readonly name: string }> {
	get message(): string {
		return `no vendored repo named "${this.name}" in the manifest`;
	}
}

/** @internal */
export const NoteNotFoundErrorBase = Data.TaggedError("NoteNotFoundError");
/**
 * The note id does not exist on the named repo.
 * @public
 */
export class NoteNotFoundError extends NoteNotFoundErrorBase<{
	readonly name: string;
	readonly id: string;
}> {
	get message(): string {
		return `no note "${this.id}" on vendored repo "${this.name}"`;
	}
}
