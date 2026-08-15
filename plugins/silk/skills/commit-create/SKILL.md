---
name: commit-create
description: >
  Use when you are about to create a git commit, amend a commit, squash commits
  before merge, finalize a branch, write a pull-request TITLE, or compose a
  conventional commit message in any form — including the contents of a
  proposed-squash-commit block. Defines the full commit-message contract
  enforced by @savvy-web/commitlint: type enum, tdd scope grammar, subject
  rules, the brevity doctrine for bodies (a few bullets or one to two short
  paragraphs — never a design document), DCO signoff, comma-separated Closes
  trailers, signing posture, and a pre-commit checklist. For a pull-request
  DESCRIPTION, use the pr-body skill instead — that document is markdown and
  is not held to this contract.
when_to_use: >
  Triggered by: "create a commit", "git commit", "commit this", "commit my
  changes", "write a commit message", "amend", "amend the last commit",
  "squash", "squash before merge", "finalize", "wrap up", "wrap up this
  branch", "ship", "ship this", "ship it", "merge this", "land this", "draft a
  PR title", "write the PR title". Also applies whenever you are composing the
  subject or body of a conventional commit message, even if the user has not
  explicitly said the word "commit" — including the contents of a
  proposed-squash-commit fence inside a PR description. Does NOT apply to the
  prose of a PR description; that is the pr-body skill.
user-invocable: false
allowed-tools: Bash(git log *), Bash(git status *), Bash(git diff *), Bash(git show *), Bash(${CLAUDE_PLUGIN_ROOT}/skills/commit-create/scripts/validate-message.sh *), Bash(${CLAUDE_PLUGIN_ROOT}/skills/commit-create/scripts/commit.sh *)
---

# commit-create

This skill defines the complete commit-message contract for this repository.
Read it fully before you compose a subject line, body, or trailer. The rules
below are enforced by the `@savvy-web/commitlint` Silk preset — violations
cause the `commit-msg` husky hook to reject the commit.

## Scope: this skill or `pr-body`?

The two skills split on document, not on command. Both can apply to one PR.

| You are writing | Skill | Held to the rules below? |
| --- | --- | --- |
| A commit message | `commit-create` | Yes |
| A pull-request **title** | `commit-create` | Yes — a PR title is a conventional-commit subject |
| The contents of a `proposed-squash-commit` fence | `commit-create` | Yes — it becomes a commit message |
| A pull-request **description** | `pr-body` | **No** — markdown, only `plan-leakage`/`closes-trailer` apply |

So `gh pr create --title` is this skill's business and `--body` is not, and a
single `gh pr create` call routinely needs both. When you are writing a PR
description that contains a squash-commit fence, follow `pr-body` for the
document and this skill for what goes inside the fence.

<EXTREMELY_IMPORTANT>
You CANNOT eyeball a 300-character body line, a 100-character header, or a
100-character trailer line and get it right. This is not a skill issue —
LLMs measurably cannot count characters by inspection. Guessing and retrying
is not a viable strategy: the `commit-msg` hook fires AFTER `lint-staged`
(biome + markdownlint + chmod over every staged file, tens of seconds), so
every wrong guess costs a full lint-staged cycle before you even find out.

The fix is not "be more careful." It is: never invoke `git commit` yourself.
Compose the message into a file, then run

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/commit-create/scripts/commit.sh" <message-file>
```

This validates the message against the REAL commitlint preset and, ONLY on
success, creates the commit. If validation fails, NOTHING is committed and
you fix the file and re-run the same command.

Do not run a length check yourself and then call `git commit` as a second,
separate command — EVEN IF the check says the message is fine. That exact
sequence is a known failure mode: a check can report a violation correctly
and the commit still happens anyway, because reading a check's output and
acting on it are two different steps, and under context pressure the second
step gets skipped. `commit.sh` exists precisely so there is no second step —
git commit is unreachable inside the script unless validation already
exited 0. Calling `git commit` directly, for any reason, bypasses this
guarantee. If `commit.sh` errors for a reason unrelated to the message
(missing config, wrong directory), fix that reason and rerun `commit.sh` —
do not fall back to a bare `git commit`.
</EXTREMELY_IMPORTANT>

For `--amend` or a signed commit, pass the git flags after `--`:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/commit-create/scripts/commit.sh" <message-file> -- --amend
bash "${CLAUDE_PLUGIN_ROOT}/skills/commit-create/scripts/commit.sh" <message-file> -- -S
```

`commit.sh` refuses `--no-verify`/`-n` outright — it would skip lint-staged
and the commit-msg hook for the actual commit. If a hook seems wrong, fix
the hook; do not bypass it.

### Which repository the commit lands in

`commit.sh` and `validate-message.sh` resolve the target repository the same
way, and the current working directory is the primary authority:

1. **Your cwd, if it is inside a git repository, wins.** They run
   `git -C "$PWD" rev-parse --show-toplevel` first. Inside a linked git
   worktree (e.g. `.claude/worktrees/agent-*/`) this correctly resolves to
   the WORKTREE's own root, never the primary checkout — that is where the
   commit belongs.
2. **`CLAUDE_PROJECT_DIR` is a fallback, not an override.** It is the host's
   pin to the session's primary checkout and is expected to differ from cwd
   whenever you are working in a worktree — that disagreement is silently
   ignored and cwd still wins. If `CLAUDE_PROJECT_DIR` instead names a
   genuinely different repository (no shared git history with cwd — a
   cross-repo agent session, or a stale value left over from earlier,
   unrelated work) the scripts refuse rather than guess, printing an error
   that names both paths. Fix this by `cd`-ing to the repo you mean to
   operate on, or by setting `SILK_PROJECT_DIR` (below).
3. **`SILK_PROJECT_DIR` is an explicit, deliberate override.** Set it to
   force resolution to a specific repository regardless of cwd — the
   documented lever for a cross-repo agent session that genuinely needs to
   target a repo other than the one it is standing in. It always wins over
   cwd, and a one-line `NOTICE` goes to stderr whenever it overrides a
   differing cwd, so the override is never silent:

   ```bash
   SILK_PROJECT_DIR=/path/to/intended/repo bash "${CLAUDE_PLUGIN_ROOT}/skills/commit-create/scripts/commit.sh" <message-file>
   ```

4. Outside any git repository entirely (cwd resolution itself fails), the
   fallback chain is `SILK_PROJECT_DIR` → `CLAUDE_PROJECT_DIR` → the literal
   cwd.

This is the fix for a family of reproduced bugs — savvy-web/systems issues
474, 434 and 418 — where an inherited, stale
`SILK_PROJECT_DIR`/`CLAUDE_PROJECT_DIR` silently outranked the actual working
tree, including a near-miss where one agent's commit almost landed on another
agent's staged tree. If `commit.sh` ever reports the wrong repository, that
is a bug in the resolution above, not something to work around by exporting
an env var and moving on without understanding why it was necessary.

If the commit is being made through an MCP tool (GitKraken) or as a `gh pr
create`/`gh pr edit` body instead of a Bash `git commit` — where there is no
wrapper script to call — the same discipline still applies without the
structural guarantee: run

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/commit-create/scripts/validate-message.sh" <message-file>
```

and treat a non-zero exit as an absolute stop. Do not call the MCP tool or
`gh` command in the same turn as a failed validation "to save time" — fix
the message and re-validate first.

---

## Commit format

```text
type(scope): subject

body (optional — a few bullets, or one to two short paragraphs)

Closes #N, #N, #N (optional, all issues on ONE comma-separated line)

Signed-off-by: Full Name <email@example.com>
```

Every part has constraints. Read each section.

Blank lines separate the subject, the body, the closing trailer, and the
signoff. Squashing them together is not an error — commitlint accepts it —
but the spaced form is the house style. Write it that way.

<IMPORTANT_BREVITY>
A commit message is a scannable index entry, not a design document. This repo
squash-merges, and commits are sometimes rebased — a long body is discarded at
merge or stranded on a commit nobody reads, after costing real time and tokens
to write. Explanation that deserves to survive belongs in the PR description,
the changeset, or a design doc, all of which outlive the commit.

Agents here produce large commits, and that is fine. A large commit does NOT
earn a large message. Report the few changes that matter and drop the rest.
See "Body rules" for the length target and what qualifies as "matters".
</IMPORTANT_BREVITY>

---

## Allowed commit types

Use exactly one of the following lowercase identifiers as the type:

| Type | When to use |
| --- | --- |
| `ai` | AI/LLM agent document updates — CLAUDE.md, context files, design docs |
| `build` | Changes to the build system or external dependencies |
| `chore` | Housekeeping that does not touch src or test files |
| `ci` | CI configuration and pipeline scripts |
| `docs` | Documentation-only changes |
| `feat` | A new user-facing feature |
| `fix` | A bug fix |
| `perf` | A change that improves performance |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `release` | Version bumps and changelog commits |
| `revert` | Reverts a previous commit |
| `style` | Formatting, whitespace, semicolons — no logic change |
| `tdd` | TDD agent commit — **requires a mandatory scope** (see below) |
| `test` | Adding or correcting tests (non-TDD workflow) |

Do not invent types. Do not use a type not in this list.

---

## Scope rules

Scope is optional for most types. When provided, it names the logical
component, module, or concern being changed. Examples: `(deps)`, `(cli)`,
`(config)`, `(detection)`.

### TDD scope is mandatory and structured

`tdd` commits require a scope in the format `goalId:state` where:

- `goalId` is a positive integer identifying the TDD goal
- `state` is one of: `spike`, `red`, `green`, `refactor`

Pattern: `^\d+:(spike|red|green|refactor)$`

Valid: `tdd(42:red)`, `tdd(7:green)`, `tdd(1:refactor)`, `tdd(99:spike)`
Invalid: `tdd(red)`, `tdd(42)`, `tdd(green:42)`, `tdd` (no scope)

A `tdd` commit without a valid scope will be rejected by the hook.

---

## Subject line rules

- **Mood:** imperative ("add", "fix", "remove" — not "added", "adding", "fixes")
- **Case:** prefer a lowercase first letter after the colon for consistency with the rest of this repo's history and rendered changelogs. Note this is a style preference, not a mechanically enforced rule — the Silk preset explicitly disables commitlint's built-in `subject-case` check (`AI tools often capitalize, which is acceptable`) — so getting it wrong will not fail the hook, but match the convention anyway
- **Length:** max 100 characters for the full `type(scope): subject` header
- **No period:** do not end the subject with a period or any punctuation
- **No markdown:** no backticks, bold, italic, or links in the subject
- **Be specific:** describe what changed, not that "things were updated"

Bad: `feat: Updated the user authentication flow`
Good: `feat: add JWT refresh token rotation to auth flow`

Bad: `fix: fix bug`
Good: `fix(cli): handle missing config file with a clear error message`

---

## Body rules

The body is optional. Omit it entirely when the subject already says the whole
thing (`chore: bump lockfile`, `style: apply biome formatting`, most `tdd`
cycle commits). An absent body is a correct body — do not manufacture one.

### Length

**Three to five bullets, or one to two short paragraphs. Not both, and never
more than about eight body lines total.** Pick the shape that fits:

- **Bullets** for a commit that did several separable things. One line each,
  imperative, roughly 10–20 words. This is the default shape.
- **Prose** for a commit whose point is a single idea that needs a sentence or
  two of "why" — a subtle trap, a non-obvious constraint, a behavior change a
  reader would otherwise misread.

Each bullet or paragraph is **one continuous line** — do not soft-wrap at 72
or any other column. A wrapped continuation line reads as a stray indented
line and trips the soft-wrap heuristic. The hard cap is 300 characters per
line, but a line anywhere near that is already too long for this format:
**if a line passes roughly 200 characters, the content is wrong, not the
formatting.** Split it or cut it.

### What earns a line

Write the line only if a reader scanning `git log` next quarter needs it:

- The user-visible or API-visible change
- A behavior change a consumer could trip over
- A non-obvious constraint or trap the diff does not reveal on its own

### What does not earn a line — cut these

- Restating the subject in longer words
- Narrating the change's motivation when the subject already implies it
- Test counts, coverage deltas, or "pinned by tests that…" — the tests are in
  the diff
- Reasoning, investigation notes, or the evidence behind a decision — that is
  PR-description and design-doc material
- File-by-file or module-by-module walkthroughs
- Refactors, renames, and mechanical churn carried along by the real change
- Routine updates to CLAUDE.md, `.claude/design/`, skills, or any AI context
  file — unless that update IS the commit
- Config tweaks (biome.jsonc, tsconfig, lint-staged) — unless the config
  change is the substantive point
- Vague qualifiers: "for clarity", "to improve readability", "as a cleanup"
- Dependency updates: name only direct deps changed in the manifest; never
  enumerate transitive lockfile entries

The test for any candidate line: **would you lose something if this line were
deleted?** If not, delete it. Most first drafts lose half their lines to this
question and improve.

Do not count characters by eye and do not estimate. Write the message to a
file and run `scripts/validate-message.sh` (or `scripts/commit.sh`, which
calls it for you) — it prints the exact length and line number of every
violation. See "Validate before you commit" above.

### Formatting the preset rejects

- Markdown headers (`##`), numbered lists (`1.`), code fences (` ``` `), links (`[text](url)`), bold (`**text**`), horizontal rules (`---`), or more than two inline-code spans
- References to plan files, design docs, or task IDs ("as decided in the plan", "see .claude/plans/...", "previously documented in")

**Dash bullets (`- item`) are allowed and are the preferred body shape.** The
`silk/body-no-markdown` rule does not flag them, and the stricter
`silk/body-prose-only` rule is not enabled in this repo's config. Numbered
lists (`1.`) are still rejected — use dashes.

---

## DCO signoff

This repository requires a Developer Certificate of Origin (DCO) signoff on
every commit. The trailer must be the **last line** of the commit message,
separated from any `Closes` trailer above it by a blank line:

```text
Signed-off-by: Full Name <email@example.com>
```

Use the committer's real name and the email associated with their git config.
Run `git config user.name` and `git config user.email` if unsure.

Do not paraphrase or abbreviate — the exact format `Signed-off-by: Name <email>` is required.

**The trailer line itself is capped at 100 characters** — the
`footer-max-line-length` rule from `@commitlint/config-conventional` applies
to every trailer line (`Signed-off-by:`, `Closes #N`, `Fixes #N`,
`Resolves #N`), not just the body. It is easy to miss because nothing else
in this contract calls it out, and it normally never comes up — but a very
long name/email combination or a stacked list of `Closes` trailers can trip
it. `validate-message.sh` measures this too.

---

## Closes / Fixes / Resolves trailers

When the commit resolves a tracked GitHub issue, add a closing trailer above
the `Signed-off-by` line:

```text
Closes #42

Signed-off-by: Spencer Beggs <spencer@example.com>
```

Any of `Closes`, `Fixes`, or `Resolves` followed by `#N` are accepted.

**Multiple issues go on ONE line, comma-separated — never one trailer per
line.** A stacked column of `Closes` lines is noise in `git log` and eats the
footer's 100-character budget for nothing.

```text
Closes #247, #248, #251, #252, #253, #254

Signed-off-by: Spencer Beggs <spencer@savvyweb.systems>
```

Not:

```text
Closes #247
Closes #248
Closes #251
```

If the list would exceed 100 characters (roughly a dozen issues), start a
second `Closes` line rather than wrapping the first. If the branch name
contains a ticket number and the work closes that issue, always include it.

---

## Signing posture

If the project's git config has `commit.gpgsign=true`, commits must be
signed. The SessionStart context block includes a `<signing_diagnostic>`
element that reports the current signing state. Consult it when composing a
commit on a machine where signing is configured.

If signing is required and the key does not resolve or the agent is
unresponsive, do not silently create an unsigned commit. Report the signing
failure to the user and suggest they verify their gpg-agent or ssh-agent
configuration.

---

## Good examples

These are the target. Note how much they leave out.

### Bullets — a commit that did several separable things

```text
feat(actions): canonicalize GitHub Actions skills

- Consolidate Actions skills into indexed guidance with focused references
- Add action design and repository structure skills
- Preload the complete Actions skill suite in action-engineer
- Validate construct coverage across exported package APIs

Signed-off-by: Spencer Beggs <spencer@savvyweb.systems>
```

### Bullets with a Closes trailer

```text
feat: add deferred runtime action capabilities

- Add branch, cache digest, child environment, lockfile, and npm cache APIs
- Document schemastore usage and correct its example
- Publish changesets for package and dependency updates

Closes #218

Signed-off-by: Spencer Beggs <spencer@savvyweb.systems>
```

### Prose — one idea worth two sentences

Reach for this shape only when the point is a trap or constraint the diff
does not reveal on its own.

```text
ai(design): record the duplicate-service-identity trap

Two resolved copies of one @effected package are two distinct Context.Service tags, so a layer built from one does not satisfy a requirement expressed by the other.

It surfaces as a service reading unprovided in a graph that visibly provides it, not as a version error, which sends a reader looking for a signature change that never happened.

Closes #16, #17, #18

Signed-off-by: Spencer Beggs <spencer@savvyweb.systems>
```

### No body at all

```text
tdd(14:green): implement scope validator for tdd commits

Signed-off-by: Spencer Beggs <spencer@savvyweb.systems>
```

---

## Bad examples

```text
feat: Updated Things
```

Problems: past tense ("Updated"), vague ("Things"), capital U.

```text
fix: fixed the bug where the thing crashes when the other thing is missing and also updated the error message and added a test
```

Problems: past tense, run-on subject over 100 chars, multiple distinct changes crammed into one line.

```text
chore: dependency updates

## Changes
- Updated `effect` from 3.1.0 to 3.14.0
- Updated `@effect/cli` from 0.46.0 to 0.52.0
- Updated 47 transitive dependencies in the lockfile
```

Problems: markdown header in body, enumerating transitive lockfile entries.

### The failure mode this skill exists to prevent

```text
feat(github-actions): serve a test payload and emit per-step summaries

ActionEnvironment.makeTest and layerTest take the webhook payload as a second argument, serving it directly rather than through a GITHUB_EVENT_PATH read.

The layer hard-provides a noop filesystem and captures it at construction, so seeding the path had no route to a payload, and every event-driven suite rebuilt the double by hand.

ActionLogger.withStep adds the summary line withBuffer alone cannot reach: discard on success plus one info line, and a failure header emitted ahead of the transcript it announces.

Docstrings now cover two failure modes that ship green. An explicitly empty input cannot be read through Config.withDefault, confirmed against runner source and a live probe.

A bare ConfigProvider.fromEnv composed beneath the input provider uppercases the path, so an input-name key never matches and the read silently takes its default.

Also lifts the GitHubMarkdown rename out of the does-not-ship list it was filed under, and adds a legacy-to-kit symbol map for ports that change every import and no pipeline step.

Closes #247
Closes #248
Closes #251
Closes #252

Signed-off-by: Spencer Beggs <spencer@savvyweb.systems>
```

Every sentence here is accurate and well written, and the message is still
wrong. It passes commitlint, so nothing will stop you. Problems: six
paragraphs where three bullets would do; the investigation evidence
("confirmed against runner source and a live probe") belongs in the PR;
mechanical carry-along changes ("also lifts the rename…") promoted to a
paragraph; stacked `Closes` lines instead of one comma-separated line. On a
squash merge, all of it is discarded.

The same commit, correctly:

```text
feat(github-actions): serve a test payload and emit per-step summaries

- Take the webhook payload as an argument to ActionEnvironment.makeTest and layerTest, replacing the GITHUB_EVENT_PATH read that the hard-provided noop filesystem made unreachable
- Add ActionLogger.withStep for per-step summaries: discard on success, failure header ahead of the transcript
- Document two silent-default traps: an empty input is unreadable through Config.withDefault, and a bare ConfigProvider.fromEnv beneath the input provider uppercases the key so it never matches

Closes #247, #248, #251, #252

Signed-off-by: Spencer Beggs <spencer@savvyweb.systems>
```

---

## Composing the message: what to get right before you validate

The validator catches every violation listed in this skill, but composing a
message that passes on the first try (rather than the second or third) still
starts with getting these right:

1. Confirm the type is in the allowed list above.
2. For `tdd` commits, confirm the scope matches `^\d+:(spike|red|green|refactor)$`.
3. Check the subject: imperative mood, no period, under 100 characters total.
4. **Count your body lines. More than about eight, or any line past ~200 characters, means cut — not reformat.** Re-read "What does not earn a line" and delete every line that survives the "would you lose something?" test only because you wrote it.
5. If you wrote a body, verify no markdown headers, numbered lists, code fences, or plan-file references, and every line under 300 characters.
6. Confirm `Signed-off-by: Full Name <email>` is present, each trailer line under 100 characters.
7. If the branch implies a ticket and the work closes it, add `Closes #N` above the signoff — all issues on one comma-separated line.
8. If `commit.gpgsign=true`, confirm the signing agent is responsive before committing.

## The one command that actually commits

Write the composed message to a file, then run:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/commit-create/scripts/commit.sh" <message-file>
```

This is not an optional pre-check — it is the entire mechanism by which a
commit gets created in this workflow. It validates against the real
commitlint preset and only execs `git commit -F <message-file>` on success.
See "Validate before you commit" at the top of this skill for why a separate
"check, then commit" sequence is the specific failure this replaces, and for
the `--amend`/`-S` passthrough form.
