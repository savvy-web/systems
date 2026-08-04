# GitKraken AI prompt templates

Working drafts for GitKraken's seven AI prompt fields, aligned with this repository's commit and pull-request contract.

This is a living document. The GitKraken integration used to produce usable output and no longer does reliably, so treat every template below as a hypothesis rather than a settled answer. Change one field at a time, record what happened in the observations log at the bottom, and keep the templates and the log in sync.

The authorities these templates encode are `plugins/silk/skills/commit-create/SKILL.md` (the commit contract) and `plugins/silk/skills/pr-body/SKILL.md` (the PR contract). When those change, these templates are stale until updated. They are a copy of the rules, not the rules themselves.

## Why a copy, and what that costs

GitKraken's AI cannot run `validate-message.sh`, cannot read the commitlint preset, and cannot load a skill. It sees only the prompt text and the diff. Everything the contract enforces has to be restated inline, which means these templates drift out of sync the moment the contract moves. That is the accepted cost of using the integration at all.

It also means **GitKraken output is a draft, never a final commit.** The `commit-msg` hook is still the authority and will still reject a message these prompts got wrong.

## The seven fields

| # | Field | Carries |
| --- | --- | --- |
| 1 | Global instructions | Shared voice, the hard bans, and the "draft not final" framing |
| 2 | Commit message generation | The full commit contract |
| 3 | Explain changes | Review-oriented summary, no format constraints |
| 4 | Stash message generation | One short line |
| 5 | Pull request | Title under the commit contract, body as markdown |
| 6 | Conflict resolution | Resolution guidance, no message format |
| 7 | Commit composer | How to split work into commits, each message under the contract |

## 1. Global instructions

Applies to the other six unless a field overrides it. Keep it short — it is prepended to every call, and a long global prompt crowds out the field-specific one.

```text
You are assisting on a TypeScript monorepo that uses Conventional Commits with a strict commitlint preset. Output is a draft a human will review, not a final artifact.

Voice: plain, direct, technical. Write for a teammate reading git log in six months. No marketing language, no filler ("this commit updates...", "various improvements"), no praise.

Describe what changed and why it matters. Do not narrate the diff file by file, and do not restate the subject line in the body.

Never invent facts you cannot see in the diff. If you cannot tell why a change was made, describe what changed and stop — do not guess at motivation.

Never output a placeholder like TODO, XXX, or <description>. If you lack the information, write less rather than filling space.
```

## 2. Commit message generation

The most constrained field. Every rule here is enforced by the `commit-msg` hook, so a violation costs a full lint-staged cycle before it is even reported.

```text
Write one Conventional Commits message for the staged changes.

SUBJECT LINE
Format: type(scope): subject
Type must be exactly one of: ai, build, chore, ci, docs, feat, fix, perf, refactor, release, revert, style, test
Scope is optional; use the package or component name (cli, silk, commitlint, deps).
Imperative mood: "add", "fix", "remove" — never "added", "adds", "adding".
Lowercase first letter after the colon.
No trailing period.
The whole line, including type and scope, must be under 100 characters.

BODY
Optional. Omit it entirely when the subject says everything — that is a correct message, not a lazy one.
When you write one: three to five bullets, or one to two short paragraphs. Never both. Never more than eight lines.
Bullets start with "- " and each is ONE line. Do not wrap a bullet across lines. Keep each line under 200 characters.
Separate the subject from the body with one blank line.

Include a line only if it is one of these:
- the user-visible or API-visible change
- a behavior change a consumer could trip over
- a non-obvious constraint or trap the diff does not reveal on its own

Leave out: restating the subject, test counts, coverage numbers, investigation notes, reasoning about why you chose an approach, file-by-file walkthroughs, renames and mechanical churn carried along by the real change, and vague qualifiers like "for clarity" or "as a cleanup".

FORBIDDEN IN THE BODY — these are rejected by the hook
No markdown headings (lines starting with #).
No code fences (three backticks).
No numbered lists (1. 2. 3.). Use "- " bullets instead.
No bold (**text**), no links, no horizontal rules (---).
Avoid backticks entirely — more than two inline code spans is rejected.
No references to internal paths like .claude/plans/ or .claude/design/, and no phrases like "as decided in the plan" or "see the design doc".

TRAILERS
If the change closes tracked issues, put them ALL on one line, comma separated:
Closes #12, #34, #56
Never one Closes line per issue. Keep the line under 100 characters; start a second Closes line if it would be longer.
Put a blank line before the Closes line and another before the signoff.

FINAL SHAPE
type(scope): subject
<blank>
- bullet
- bullet
- bullet
<blank>
Closes #12, #34
<blank>
Signed-off-by: Name <email>
```

**On the signoff.** This repository requires a DCO trailer. If GitKraken is configured to add `Signed-off-by` itself, delete the last two lines of the template above — two signoffs is a malformed message. Verify which is happening before trusting either. See the log.

## 3. Explain changes

No format contract applies here; the output is read, not committed. This is the field where detail is welcome — it is the natural place for everything the commit body is forbidden to carry.

```text
Explain these changes to a reviewer who knows the codebase but has not seen this work.

Lead with the outcome: what behaves differently now? A reader should be able to stop after the first short paragraph and know whether they care.

Then cover, only where the diff supports it:
- the mechanism — how the change achieves that outcome
- anything a reviewer must check by hand: a migration, a behavior change a consumer could trip over, a deliberate omission
- risk: what could break that the diff does not make obvious

Markdown is fine here. Headings, lists and code blocks are all allowed.

Do not list every changed file. Do not restate the diff line by line — the reviewer can read it. Spend the space on the reasoning the diff cannot show.
```

## 4. Stash message generation

```text
Write one short line describing what this stash contains, so it can be identified in a list of stashes weeks later.

Under 60 characters. Imperative or noun phrase, no trailing period. No Conventional Commits prefix — a stash is not a commit.

Name the work in progress, not the mechanics. "half-migrated auth layer" beats "changes to 4 files".
```

## 5. Pull request

Two documents with different rules, which is the thing this field most often gets wrong. **The title is a conventional-commit subject; the body is ordinary markdown.**

The description also carries the marker structure the rest of the toolchain reads. Marker regions are what let a human, this integration, a local agent and `silk-release-action` all write to one description without destroying each other's work, so the generator has to emit them correctly rather than produce free-form prose.

### The structure it should emit

````markdown
<!-- silk-release:start -->
<!-- silk-release:summary:start -->
Prose summary goes here. Ordinary markdown.
<!-- silk-release:summary:end -->

```proposed-squash-commit
type(scope): subject

- bullet
- bullet

Closes #123, #456

Signed-off-by: Name <email>
```

<!-- silk-release:references:start -->
Closes #123
Closes #456
<!-- silk-release:references:end -->
<!-- silk-release:end -->
````

### The template

```text
Write a pull request title and description.

TITLE — same contract as a commit subject
Format: type(scope): subject
Type must be one of: ai, build, chore, ci, docs, feat, fix, perf, refactor, release, revert, style, test
Imperative mood, lowercase after the colon, no trailing period, under 100 characters.

DESCRIPTION — emit the marker structure exactly
The description is built from HTML-comment marker regions. Reproduce the markers verbatim, including the comment syntax. They are how other tools find their section.

<!-- silk-release:start -->
<!-- silk-release:summary:start -->
[your prose summary]
<!-- silk-release:summary:end -->

[a fenced block, opened with three backticks followed by the word proposed-squash-commit]
[the proposed squash commit message]
[closed with three backticks]

<!-- silk-release:references:start -->
[one bare Closes line per issue]
<!-- silk-release:references:end -->
<!-- silk-release:end -->

THE SUMMARY REGION — ordinary markdown, NOT held to the commit rules
Headings, lists, tables and code fences are all allowed and encouraged here. Length is not the constraint; irrelevance is. This is where the detail that does not fit in a commit body belongs, and it is what survives the squash merge.

Structure it as:
- A short summary: what changed and why, in two or three sentences.
- The reasoning a reviewer cannot get from the diff: what you ruled out, what was surprising, what constraint forced the approach.
- Review notes: anything that must be checked by hand, and anything you deliberately did not do that the diff might imply you did.
- Verification: the commands run and their result. Be concrete; "all tests pass" says nothing.

Do not recap the diff file by file. Do not reference internal paths like .claude/plans/ or .claude/design/ — this repository is public.

THE PROPOSED-SQUASH-COMMIT BLOCK
This repository squash-merges, so this block becomes the real commit message. Write it under the full commit contract: type(scope): subject under 100 characters, imperative, lowercase, no trailing period; body of three to five single-line "- " bullets; no markdown headings, no code fences, no numbered lists inside it.
Use the fence language proposed-squash-commit exactly. Do not change it to text or bash — other tools match on that word.

CLOSING REFERENCES — two spellings, and they are not interchangeable
INSIDE the proposed-squash-commit block, all issues go on ONE comma-separated line:
Closes #123, #456
INSIDE the references region, one bare line per issue:
Closes #123
Closes #456
Both are required. The comma form is what the commit linter accepts; the one-per-line form is the only thing GitHub links on. A reference inside a fenced block does not link at all, which is why the references region exists outside it.
If nothing is closed, still emit the references markers with nothing between them.

NEVER write owned="..." on the references marker. That attribute is written only by the release automation to track which references it owns; inventing one makes it delete or resurrect the wrong issue links. Emit the plain marker.
```

### On a release PR

A release PR's description is generated and regenerated by `silk-release-action` on every push. There the rules invert:

- **Write only inside the summary region.** It is the one region carried through regeneration; the action reserves it and never writes into it.
- **Leave the fence and the references region alone.** Both are rebuilt from the action's own linked-issue set on the next push, so edits there are discarded silently.
- **Never touch the markers themselves, or the `owned` attribute.**

The safe habit is to use this field for ordinary feature PRs and to write release-PR summaries by hand into the summary region.

> **Open question — the `pr-body` skill currently says the opposite.** It instructs agents that when markers are absent the PR is not action-managed, and not to synthesize a managed region. This template tells the generator to emit one on every PR. Both positions are defensible: emitting always gives a uniform structure and a proposed squash message on every PR, which a squash-merge flow wants anyway; emitting never keeps the markers meaning "an action manages this". They cannot both be house style. Resolve it before this document is treated as settled, and update whichever side loses. Verified as safe either way: an attribute-less `silk-release:references:start` marker parses correctly, so a hand-authored region does not corrupt the action's bookkeeping if one later reads it.

## 6. Conflict resolution

The one field where being wrong is expensive and silent — a plausible-looking merge that drops a hunk is worse than an unresolved conflict.

```text
Help resolve this merge conflict.

Both sides are intentional work. Your default is to preserve the intent of both, not to pick a winner.

Before proposing a resolution, state in one line what each side was trying to do. If you cannot tell from the surrounding code, say so and stop — do not guess.

Never silently drop a hunk. If the two sides are genuinely incompatible and one must go, say which and why, explicitly.

Watch for conflicts that are textually simple but semantically not: two sides adding to the same list, a rename on one side and an edit on the other, an import that only one side still needs. Resolving those by concatenation compiles and is still wrong.

Flag anything you resolved that a human should verify by running the code.
```

## 7. Commit composer

Splits working changes into multiple commits. The grouping matters more than the wording.

```text
Group these changes into commits, then write a message for each.

GROUPING
One logical change per commit. A reviewer should be able to read a single commit and understand a complete idea.

Group by intent, never by file type or directory. A feature and its tests belong in the same commit; two unrelated fixes in one file belong in two.

Separate mechanical churn (renames, formatting, generated output) from substantive changes, so a reviewer can skip the churn.

Prefer fewer, coherent commits over many tiny ones. If a change cannot stand alone — it breaks the build without another change — it belongs with that change.

MESSAGES
Every message follows the commit contract: type(scope): subject under 100 characters, imperative, lowercase, no trailing period. Body optional; when present, three to five single-line "- " bullets, no markdown headings, no code fences, no numbered lists. Put closing references on one comma-separated line.

If a change genuinely does not fit any group, say so rather than forcing it into an unrelated commit.
```

## Known unknowns

Things these templates assume that have not been verified. Confirm before trusting the output, and record findings in the log.

- **Whether the global field actually reaches every other field.** If a field's output ignores a global rule, paste the relevant global lines directly into that field and note it below.
- **Whether GitKraken appends its own DCO signoff.** Determines whether template 2 should emit the trailer or omit it. Two signoffs is a malformed message.
- **How much prompt text each field accepts before truncating.** Template 2 is long. If output quality drops as the prompt grows, the constraints most worth keeping are the type enum, the 100-character subject cap, and the forbidden-markdown list, in that order.
- **Whether the model sees the full staged diff or a truncated one.** If commit messages describe only part of a large change, this is the likely cause, and the fix is smaller commits rather than a better prompt.
- **Whether any field supports variables or interpolation** (branch name, issue number, ticket from branch). If so, the Closes trailer could be filled from the branch name automatically.

## What "working" looks like

A template is doing its job when the generated message passes `validate-message.sh` unedited. That is the only objective test available, and it is worth running the output through it while tuning:

```bash
bash plugins/silk/skills/commit-create/scripts/validate-message.sh <file>
```

Paste the generated message into a scratch file and run it. A PASS means the template encoded the contract correctly; a specific violation tells you exactly which instruction the model ignored, which is far more actionable than "the output looks wrong".

## Observations log

Newest first. Record the field changed, what was tried, and what actually happened — including failures, which are the more useful entries.

| Date | Field | Change | Result |
| --- | --- | --- | --- |
| 2026-08-04 | all | Initial drafts written from the commit and PR skills | Not yet pasted into GitKraken or tested |
