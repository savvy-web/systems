/**
 * `repos note` command group -- agent notes for a vendored `.repos/` repo.
 *
 * @remarks
 * A thin adapter over {@link Repos.ReposManager.note}: `add` appends a note
 * (capped at the manifest's per-repo note limit), `remove` deletes one, and
 * `promote` folds a note's text into the entry's curated orientation
 * (`layout` or `startHere`) and removes it from the note list. `name` and
 * `--cwd` are parsed on the parent `note` command and threaded to whichever
 * leaf ran via Effect's `Command.Context` mechanism (the parent `Command`
 * doubles as an `Effect` requiring its own context tag, which
 * `Command.withSubcommands` provides to the chosen leaf's handler).
 *
 * A `ReposConfigError` with kind `"missing"` -- nothing vendored yet -- is
 * the common, friendly case and always exits 0. A `ReposConfigError` with
 * kind `"invalid"` means the manifest exists but is corrupt or unreadable,
 * `RepoNotFoundError` means the named repo isn't in the manifest, and
 * `NoteNotFoundError` means the note id doesn't exist on that repo -- all
 * three are real failures, logged and reported via a non-zero exit code.
 *
 * @example
 * ```bash
 * savvy repos note my-repo add "entry point is src/index.ts"
 * savvy repos note my-repo remove n-1234
 * savvy repos note my-repo promote n-1234 --into startHere
 * ```
 *
 * @internal
 */

import { Args, Command, Options } from "@effect/cli";
import { Repos } from "@savvy-web/silk-effects";
import { Effect } from "effect";

/**
 * Note handler; exported for tests.
 *
 * @internal
 */
export const runReposNote = (cwd: string, name: string, op: Parameters<Repos.ReposManagerShape["note"]>[2]) =>
	Effect.gen(function* () {
		const manager = yield* Repos.ReposManager;
		const result = yield* manager.note(cwd, name, op);
		yield* Effect.log(`${result.name}: ${result.op} note ${result.id} (${result.noteCount} notes)`);
	}).pipe(
		Effect.catchTag("ReposConfigError", (error) => {
			if (error.kind === "missing") {
				return Effect.log("no .repos/config.json — nothing vendored");
			}
			process.exitCode = 1;
			return Effect.log(error.message);
		}),
		Effect.catchTag("RepoNotFoundError", (error) => {
			process.exitCode = 1;
			return Effect.log(error.message);
		}),
		Effect.catchTag("NoteNotFoundError", (error) => {
			process.exitCode = 1;
			return Effect.log(error.message);
		}),
	);

/* v8 ignore start -- CLI registration; handler tested via runReposNote */
const nameArg = Args.text({ name: "name" });
const noteTextArg = Args.text({ name: "text" });
const noteIdArg = Args.text({ name: "id" });
const intoOption = Options.choice("into", ["layout", "startHere"]).pipe(
	Options.withDescription("Curated orientation field to promote the note into"),
);
const cwdOption = Options.directory("cwd").pipe(
	Options.withDescription("Repo root whose manifest holds the notes"),
	Options.withDefault("."),
);

const _noteGroup = Command.make("note", { name: nameArg, cwd: cwdOption });

const addLeaf = Command.make("add", { note: noteTextArg }, ({ note }) =>
	Effect.gen(function* () {
		const { name, cwd } = yield* _noteGroup;
		yield* runReposNote(cwd, name, { op: "add", note });
	}),
).pipe(Command.withDescription("Append an agent note to a vendored repo"));

const removeLeaf = Command.make("remove", { id: noteIdArg }, ({ id }) =>
	Effect.gen(function* () {
		const { name, cwd } = yield* _noteGroup;
		yield* runReposNote(cwd, name, { op: "remove", id });
	}),
).pipe(Command.withDescription("Remove an agent note from a vendored repo"));

const promoteLeaf = Command.make("promote", { id: noteIdArg, into: intoOption }, ({ id, into }) =>
	Effect.gen(function* () {
		const { name, cwd } = yield* _noteGroup;
		yield* runReposNote(cwd, name, { op: "promote", id, into });
	}),
).pipe(Command.withDescription("Promote an agent note into curated orientation (layout or startHere)"));

const _noteCommand = _noteGroup.pipe(
	Command.withSubcommands([addLeaf, removeLeaf, promoteLeaf]),
	Command.withDescription("Agent notes for a vendored repo: add, remove, promote"),
);

/**
 * The `savvy repos note` command group.
 *
 * @remarks
 * Typed as `unknown` at the export boundary to avoid TypeScript declaration-emit
 * errors from Effect's internal types (TS4023), matching the `reposCommand`
 * export pattern.
 */
// biome-ignore lint/suspicious/noExplicitAny: Effect Command type infers unexportable internal types from effect
export const noteCommand: Command.Command<"note", any, any, any> = _noteCommand as Command.Command<
	"note",
	// biome-ignore lint/suspicious/noExplicitAny: required to suppress TS4023 unexportable-type errors
	any,
	// biome-ignore lint/suspicious/noExplicitAny: required to suppress TS4023 unexportable-type errors
	any,
	// biome-ignore lint/suspicious/noExplicitAny: required to suppress TS4023 unexportable-type errors
	any
>;
/* v8 ignore stop */
