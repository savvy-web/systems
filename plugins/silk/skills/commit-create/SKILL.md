---
name: commit-create
description: >
  Use when you are about to create a git commit, amend a commit, squash commits
  before merge, finalize a branch, open or edit a pull request, or compose a
  conventional commit message in any form. Defines the full commit-message
  contract enforced by @savvy-web/commitlint: type enum, tdd scope grammar,
  subject rules, body rules, DCO signoff, Closes trailers, signing posture, and
  a pre-commit checklist.
when_to_use: >
  Triggered by: "create a commit", "git commit", "commit this", "commit my
  changes", "write a commit message", "amend", "amend the last commit",
  "squash", "squash before merge", "finalize", "wrap up", "wrap up this
  branch", "ship", "ship this", "ship it", "open a PR", "open a pull request",
  "create a PR", "draft a PR title", "gh pr create", "gh pr edit", "merge
  this", "land this". Also applies whenever you are composing the subject or
  body of a conventional commit message, even if the user has not explicitly
  said the word "commit".
user-invocable: false
allowed-tools: Bash(git log *), Bash(git status *), Bash(git diff *), Bash(git show *), Bash(${CLAUDE_PLUGIN_ROOT}/skills/commit-create/scripts/validate-message.sh *), Bash(${CLAUDE_PLUGIN_ROOT}/skills/commit-create/scripts/commit.sh *)
---

# commit-create

This skill defines the complete commit-message contract for this repository.
Read it fully before you compose a subject line, body, or trailer. The rules
below are enforced by the `@savvy-web/commitlint` Silk preset — violations
cause the `commit-msg` husky hook to reject the commit.

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

body (optional)

Closes #N (optional, one per line)
Signed-off-by: Full Name <email@example.com>
```

Every part has constraints. Read each section.

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

The body is optional. Include it when the subject alone does not orient a
reader to the change. Omit it for trivial commits (`chore: bump lockfile`,
`style: apply biome formatting`).

When you write a body:

- Explain **what changed conceptually and why** — one level above the diff
- Target 2–5 lines maximum; trim aggressively
- Each bullet or paragraph is **one continuous line** — do not soft-wrap at 72 or any other column, that produces a stray indented continuation line that fails a different check (the `silk/body-prose-only`-adjacent soft-wrap heuristic)
- **Keep each line comfortably under 300 characters — target roughly 200 as a safe working limit, not the ceiling itself.** The hard limit is 300; writing up to the edge of it leaves no headroom for a miscount. If a single bullet or sentence is approaching 200 characters, that is a signal to split it into two bullets, not a reason to compress punctuation to squeeze under 300
- Name the concept or component that changed, not every file touched
- Avoid vague qualifiers: "for clarity", "to improve readability", "as a cleanup" — unless the diff is purely formatting
- Dependency updates: list only direct deps changed in the manifest; never enumerate transitive lockfile entries

Do not count characters by eye and do not estimate. Write the message to a
file and run `scripts/validate-message.sh` (or `scripts/commit.sh`, which
calls it for you) — it prints the exact length and line number of every
violation. See "Validate before you commit" above.

**Never include in the body:**

- Markdown headers (`##`), numbered lists (`1.`), code fences (` ``` `), links (`[text](url)`), bold (`**`), or italic (`_`)
- File-by-file implementation walkthroughs — name the concept, not every file modified
- References to plan files, design docs, or task IDs ("as decided in the plan", "see .claude/plans/...", "previously documented in")
- Routine updates to CLAUDE.md, `.claude/design/`, `.claude/skills/`, or any AI context file — skip unless the change is architecturally significant
- Config file tweaks (biome.jsonc, tsconfig, lint-staged) — skip unless the config change is the substantive point of the commit

---

## DCO signoff

This repository requires a Developer Certificate of Origin (DCO) signoff on
every commit. The trailer must appear as the **last line** of the commit
message (or immediately after any `Closes` trailers):

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

Any of `Closes`, `Fixes`, or `Resolves` followed by `#N` are accepted. Use
one trailer per issue. If the branch name contains a ticket number and the
work closes that issue, always include the trailer. Each trailer line is
subject to the same 100-character `footer-max-line-length` cap noted above.

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

### Feature commit with DCO

```text
feat(auth): add JWT refresh token rotation

Expiry is now tracked per-device rather than per-session. Clients that
present an expired access token receive a new pair if the refresh token
is still valid and the device is registered.

Signed-off-by: Spencer Beggs <spencer@savvyweb.systems>
```

### TDD cycle commit

```text
tdd(14:green): implement scope validator for tdd commits

Signed-off-by: Spencer Beggs <spencer@savvyweb.systems>
```

### Fix with Closes trailer

```text
fix(cli): resolve crash when config file is missing

The CLI threw an unhandled ENOENT when no commitlint config was found
in the project. It now falls back to the bundled Silk preset and emits
a warning instead of crashing.

Closes #87
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

---

## Composing the message: what to get right before you validate

The validator catches every violation listed in this skill, but composing a
message that passes on the first try (rather than the second or third) still
starts with getting these right:

1. Confirm the type is in the allowed list above.
2. For `tdd` commits, confirm the scope matches `^\d+:(spike|red|green|refactor)$`.
3. Check the subject: imperative mood, no period, under 100 characters total.
4. If you wrote a body, verify no markdown formatting, no plan-file references, and every line comfortably under 300 characters (target ~200 — see "Body rules").
5. Confirm `Signed-off-by: Full Name <email>` is present, each trailer line under 100 characters.
6. If the branch implies a ticket and the work closes it, add `Closes #N` above the signoff.
7. If `commit.gpgsign=true`, confirm the signing agent is responsive before committing.

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
