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
 * three are real failures, failing as a `CommandError` (exit 1) with a hint.
 *
 * Each leaf's positionals are optional to the parser so a person can leave
 * them off: at a terminal a missing repo name is picked from the vendored
 * repos (`Select`) and a missing note text or id typed (`TextInput`), and a
 * missing `promote --into` is picked from `layout`/`startHere` while parsing
 * (`CliUi.fallback`). Anywhere else a missing one is the usage error it always
 * was, exit 64.
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

import { CliUi, Select } from "@effected/cli/ui";
import { Repos } from "@savvy-web/silk-effects";
import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { Report } from "../../../internal/report.js";
import { ReposCli } from "../shared.js";

/** A note operation whose text or id may have been left off. */
export type ReposNoteRequest =
	| { readonly op: "add"; readonly note?: string | undefined }
	| { readonly op: "remove"; readonly id?: string | undefined }
	| { readonly op: "promote"; readonly id?: string | undefined; readonly into: "layout" | "startHere" };

/** `request` with its missing text or id asked for (or a usage error), as `ReposManager.note` takes it. */
const complete = (name: string, request: ReposNoteRequest) => {
	switch (request.op) {
		case "add":
			return Effect.map(
				ReposCli.textOrAsk(request.note, {
					command: ["note", "add"],
					argument: "text",
					message: `Note to add to ${name}:`,
				}),
				(note) => ({ op: "add" as const, note }),
			);
		case "remove":
			return Effect.map(
				ReposCli.textOrAsk(request.id, {
					command: ["note", "remove"],
					argument: "id",
					message: `Id of the ${name} note to remove:`,
				}),
				(id) => ({ op: "remove" as const, id }),
			);
		case "promote":
			return Effect.map(
				ReposCli.textOrAsk(request.id, {
					command: ["note", "promote"],
					argument: "id",
					message: `Id of the ${name} note to promote:`,
				}),
				(id) => ({ op: "promote" as const, id, into: request.into }),
			);
	}
};

/**
 * Note handler; exported for tests. `name` is `undefined` when left off.
 *
 * @internal
 */
export const runReposNote = (cwd: string, name: string | undefined, request: ReposNoteRequest) =>
	Effect.gen(function* () {
		const target = yield* ReposCli.nameOrPick(cwd, name, {
			command: ["note", request.op],
			argument: "name",
			message: `Which repo's notes (${request.op})?`,
		});
		const op = yield* complete(target, request);
		const manager = yield* Repos.ReposManager;
		const result = yield* manager.note(cwd, target, op);
		yield* Report.print([Report.ok(`${result.name}: ${result.op} note ${result.id} (${result.noteCount} notes)`)]);
	}).pipe(
		Effect.catchTag("ReposConfigError", (error) =>
			error.kind === "missing" ? ReposCli.nothingVendored : ReposCli.fail(`${request.op} the note`)(error),
		),
		Effect.catchTag(
			["RepoNotFoundError", "NoteNotFoundError", "GitSubmoduleError"],
			ReposCli.fail(`${request.op} the note`),
		),
	);

/* v8 ignore start -- CLI registration; handler tested via runReposNote */
const nameArg = Argument.String("name").pipe(Argument.optional);
const noteTextArg = Argument.String("text").pipe(Argument.optional);
const noteIdArg = Argument.String("id").pipe(Argument.optional);
const intoOption = Flag.Literals("into", ["layout", "startHere"]).pipe(
	Flag.withDescription("Curated orientation field to promote the note into"),
	// Picked at a terminal when left off; a missing-flag usage error everywhere else (no `otherwise`).
	Flag.withFallbackPrompt(
		CliUi.fallback(
			Select.screen({
				message: "Promote the note into which orientation field?",
				choices: [
					{ label: "layout", value: "layout" as const, detail: "where things live in the vendored tree" },
					{ label: "startHere", value: "startHere" as const, detail: "where an agent should begin reading" },
				],
			}),
			{ flag: "into" },
		),
	),
);
const cwdOption = Flag.Directory("cwd").pipe(
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
		yield* runReposNote(cwd, Option.getOrUndefined(name), { op: "add", note: Option.getOrUndefined(note) });
	}),
).pipe(Command.withDescription("Append an agent note to a vendored repo"));

const removeLeaf = Command.make("remove", { name: nameArg, id: noteIdArg }, ({ name, id }) =>
	Effect.gen(function* () {
		const { cwd } = yield* _noteGroup;
		yield* runReposNote(cwd, Option.getOrUndefined(name), { op: "remove", id: Option.getOrUndefined(id) });
	}),
).pipe(Command.withDescription("Remove an agent note from a vendored repo"));

const promoteLeaf = Command.make("promote", { name: nameArg, id: noteIdArg, into: intoOption }, ({ name, id, into }) =>
	Effect.gen(function* () {
		const { cwd } = yield* _noteGroup;
		yield* runReposNote(cwd, Option.getOrUndefined(name), { op: "promote", id: Option.getOrUndefined(id), into });
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
