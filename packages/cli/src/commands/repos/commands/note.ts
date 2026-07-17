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

import { Repos } from "@savvy-web/silk-effects";
import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/unstable/cli";

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
const nameArg = Argument.string("name");
const noteTextArg = Argument.string("text");
const noteIdArg = Argument.string("id");
const intoOption = Flag.choice("into", ["layout", "startHere"]).pipe(
	Flag.withDescription("Curated orientation field to promote the note into"),
);
const cwdOption = Flag.directory("cwd").pipe(
	Flag.withDescription("Repo root whose manifest holds the notes"),
	Flag.withDefault("."),
);

// v4's unstable/cli shares parent config with subcommands via
// `Command.withSharedFlags` — FLAGS only, so the v3 parent-positional grammar
// (`note <name> add <text>`) cannot be expressed. The repo name moves into
// each leaf: `note add <name> <text>`, `note remove <name> <id>`,
// `note promote <name> <id> --into <field>`.
const _noteGroup = Command.make("note").pipe(Command.withSharedFlags({ cwd: cwdOption }));

const addLeaf = Command.make("add", { name: nameArg, note: noteTextArg }, ({ name, note }) =>
	Effect.gen(function* () {
		const { cwd } = yield* _noteGroup;
		yield* runReposNote(cwd, name, { op: "add", note });
	}),
).pipe(Command.withDescription("Append an agent note to a vendored repo"));

const removeLeaf = Command.make("remove", { name: nameArg, id: noteIdArg }, ({ name, id }) =>
	Effect.gen(function* () {
		const { cwd } = yield* _noteGroup;
		yield* runReposNote(cwd, name, { op: "remove", id });
	}),
).pipe(Command.withDescription("Remove an agent note from a vendored repo"));

const promoteLeaf = Command.make("promote", { name: nameArg, id: noteIdArg, into: intoOption }, ({ name, id, into }) =>
	Effect.gen(function* () {
		const { cwd } = yield* _noteGroup;
		yield* runReposNote(cwd, name, { op: "promote", id, into });
	}),
).pipe(Command.withDescription("Promote an agent note into curated orientation (layout or startHere)"));

const _noteCommand = _noteGroup.pipe(
	Command.withSubcommands([addLeaf, removeLeaf, promoteLeaf]),
	Command.withDescription("Agent notes for a vendored repo: add, remove, promote"),
);

/**
 * The `savvy repos note` command group.
 */
export const noteCommand = _noteCommand;
/* v8 ignore stop */
