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
allowed-tools: Bash(git log *) Bash(git status *) Bash(git diff *) Bash(git show *)
---

# commit-create

This skill defines the complete commit-message contract for this repository.
Read it fully before you compose a subject line, body, or trailer. The rules
below are enforced by the `@savvy-web/commitlint` Silk preset — violations
cause the `commit-msg` husky hook to reject the commit.

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
- **Case:** lowercase first letter after the colon; the entire header is lowercase except proper nouns
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
- Each bullet or paragraph is **one continuous line** — do not soft-wrap at 72 or any other column. The 300-character-per-line limit makes wrapping unnecessary
- Name the concept or component that changed, not every file touched
- Avoid vague qualifiers: "for clarity", "to improve readability", "as a cleanup" — unless the diff is purely formatting
- Dependency updates: list only direct deps changed in the manifest; never enumerate transitive lockfile entries

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
work closes that issue, always include the trailer.

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

## Before you run `git commit`

1. Confirm the type is in the allowed list above.
2. For `tdd` commits, confirm the scope matches `^\d+:(spike|red|green|refactor)$`.
3. Check the subject: imperative mood, lowercase first letter, no period, under 100 characters total.
4. If you wrote a body, verify no markdown formatting and no plan-file references.
5. Confirm `Signed-off-by: Full Name <email>` is the last trailer.
6. If the branch implies a ticket and the work closes it, add `Closes #N` above the signoff.
7. If `commit.gpgsign=true`, confirm the signing agent is responsive before committing.
