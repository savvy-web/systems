---
name: pr-body
description: >
  Use when you are about to open a pull request, edit a pull request
  description, write a PR summary, or update the proposed squash-commit
  message on an existing PR. Defines the silk-release marker contract that
  lets humans, local agents and cloud agents share one PR description without
  overwriting each other: which regions you own, which are regenerated, and
  the two incompatible spellings of a closing reference.
when_to_use: >
  Triggered by: "open a PR", "open a pull request", "create a PR", "gh pr
  create", "gh pr edit", "write the PR description", "write a PR summary",
  "update the PR body", "summarize this PR", "fix the proposed commit
  message", "link the issues on this PR". Also applies whenever you are about
  to write into a release PR's description, even if the user has not said the
  word "pull request". Covers the DESCRIPTION only — the PR title and the
  contents of a proposed-squash-commit fence are conventional-commit subjects
  and belong to the commit-create skill. One gh pr create call routinely needs
  both skills.
user-invocable: false
allowed-tools: Bash(gh pr view *), Bash(gh pr list *), Bash(gh pr diff *), Bash(git log *), Bash(git diff *), Bash(git status *), Bash(${CLAUDE_PLUGIN_ROOT}/skills/commit-create/scripts/validate-message.sh *)
---

# pr-body

A PR description in this ecosystem is a shared document with more than one
writer. `@savvy-web/silk-release-action` regenerates part of it on every push
to the release branch; humans type into it; local and cloud agents write
summaries into it. HTML-comment markers are what keep those writers from
destroying each other's work.

Read this before you write into any PR description. The failure mode is
silent: the wrong region accepts your text, looks correct in the browser, and
is gone after the next push with no error anywhere.

<EXTREMELY_IMPORTANT>
Write ONLY between markers you own. Everything inside
`<!-- silk-release:start -->` … `<!-- silk-release:end -->` that is not inside
a region named below is regenerated wholesale by the release action, and your
edits there are destroyed without warning or signal.

Never hand-edit the `owned="…"` attribute on the references marker. It is how
the action tells its own references from yours; a wrong value makes it delete
a real reference or resurrect a dropped one.
</EXTREMELY_IMPORTANT>

---

## The document

````markdown
<!-- silk-release:start -->
<!-- silk-release:summary:start -->
<!-- silk-release:summary:end -->

```proposed-squash-commit
feat: add the thing

- item
- item

Closes #123, #456

Signed-off-by: Name <email>
```

<!-- silk-release:references:start owned="123,456" -->
Closes #123
Closes #456
<!-- silk-release:references:end -->
<!-- silk-release:end -->
````

Anything OUTSIDE `silk-release:start`/`end` is human territory and survives
every regeneration. A human's note above the managed region is never yours to
edit.

---

## Who owns what

| Region | Owner | Survives regeneration |
| --- | --- | --- |
| Above/below the managed region | Humans | Yes — never regenerated |
| `silk-release:summary` | **You** | Yes — carried through explicitly |
| `proposed-squash-commit` fence | **You**, on a non-release PR | **No** on a release PR — see below |
| `silk-release:references` | Shared — you may ADD | Your additions yes, via `owned` |
| Everything else inside the managed region | The action | Rebuilt every push |

### The summary region

Yours. Write real markdown here — headings, lists, tables, links, code fences.
This is the one place in the document where prose is unconstrained, and it is
the right home for everything the commit message is not allowed to carry:
reasoning, investigation notes, evidence, benchmarks, screenshots, migration
guidance, review instructions.

The action carries this region through on every regeneration, so your work
survives. It writes nothing into it — it only reserves it.

### The proposed-squash-commit fence

This block becomes the eventual squash-commit message. `proposed-squash-commit`
is not a GFM language and appears to be undocumented, but GitHub renders it.
**Do not "correct" it to `text`** — it is the agreed target that integrations
read.

Its contents must satisfy the repo's commitlint preset, because it is a commit
message. **Invoke the `commit-create` skill and follow it** — the brevity
doctrine, the type enum, the subject rules and the trailer rules all apply
unchanged. A few bullets or one to two short paragraphs; the depth goes in the
summary region above, which is exactly what that region is for.

To check it before you write it, extract the block to a file and run:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/commit-create/scripts/validate-message.sh" <message-file>
```

<IMPORTANT_RELEASE_PR>
On a **release PR**, the release action rebuilds this fence from the PR title,
its own linked-issue set and the configured signoff on every push. It is NOT
carried through the way the summary is. A rewrite you make here is lost the
moment another commit lands on the release branch.

So: on a release PR, treat the fence as read-only unless the PR is about to
merge with no further pushes expected. Put anything that must survive in the
summary region. On an ordinary feature PR — where no action manages the body —
the fence is yours to write and maintain.
</IMPORTANT_RELEASE_PR>

### The references region

This is what actually links issues to the PR, and the rules are empirical, not
inferred from GitHub's documentation:

- **Only a bare `Closes #N` line, outside every fence, links an issue.** Each
  on its own line, nothing before or after it on that line.
- **A reference inside a fenced block is inert.** GitHub does not see it.

That is why the same issues appear twice in the document, spelled differently:

| Location | Spelling | Read by |
| --- | --- | --- |
| Inside the `proposed-squash-commit` fence | `Closes #123, #456` — one comma-separated line | commitlint |
| Inside the references region | `Closes #123` — one bare line each | GitHub's linker |

**Neither consumer accepts the other's spelling.** The duplication is
load-bearing. Do not "simplify" it, do not make the two forms match, and do
not move the bare lines inside the fence to tidy the body.

To link an issue the action does not know about, add a bare `Closes #N` line
inside the references region. It carries through: the action subtracts the ids
in `owned="…"` from what it finds, and preserves the rest as yours.

You cannot force-link an issue the action has deliberately dropped. If an
issue is in the action's set and closed, it stays out no matter what you add —
that is the action's call, not yours.

---

## Writing the summary

The audience is a reviewer deciding whether to approve, and a maintainer six
months later asking why this shipped. Lead with what changed and why it is
safe.

- Open with the outcome in two or three sentences. What behavior is different
  now? A reviewer should be able to stop after this paragraph and know whether
  they care.
- Then the reasoning the commit message cannot carry: what you ruled out,
  what surprised you, what you verified and how.
- Call out anything a reviewer must check by hand — a migration, a
  behavior change a consumer could trip over, a deliberate scope exclusion.
- State what you did NOT do, if the diff would otherwise imply you did.
- Verification belongs here, concretely: the command you ran and its result,
  not "all tests pass".

Do not recap the diff file by file. GitHub already renders it, and a listing
crowds out the reasoning that only you have.

Unlike the commit body, length here is not the enemy — irrelevance is. A long
summary that a reviewer reads once and acts on beats a short one that sends
them into the diff to reconstruct your intent.

---

## Editing an existing description

Always read before you write. The body is a shared document and you are not
its only author.

```bash
gh pr view <number> --json body --jq .body
```

Then:

1. Locate your region's markers in what came back.
2. Replace only the text BETWEEN them.
3. Write the whole body back, with every other byte unchanged — including the
   human prose outside the managed region and the `owned` attribute.

If the markers are absent, the PR is not managed by the release action. Write
an ordinary description; do not synthesize a managed region to make it look
like one.

If the body has markers but your region is missing its pair, stop and report
it rather than guessing where the region should go. A misplaced marker pair is
worse than none — it makes the action regenerate over content it does not own.

---

## Before you post

1. Are you writing only inside a region you own?
2. Is the `proposed-squash-commit` block valid against `commit-create` — type,
   subject, brevity, trailers, signoff?
3. Does the fence use the comma-separated `Closes #a, #b` form, and the
   references region the one-per-line bare form?
4. Are the bare `Closes` lines outside every fence?
5. Is the `owned` attribute exactly as you found it?
6. Does every byte outside your region match what `gh pr view` returned?
7. On a release PR: is anything that must survive the next push in the
   summary region rather than the fence?

## What the pre-tool-use hook checks on a PR body

A `gh pr create`/`gh pr edit` body passes through the silk pre-tool-use hook,
but it is NOT held to the commit-message rules. Markdown headers, code fences
and long summaries are all fine here — the rules that forbid them describe a
commit body, and a PR description is a different document.

Two checks do still apply, and both are advisory:

- **plan-leakage** — do not cite `.claude/plans/`, `.claude/design/`, or write
  "as decided in the plan". This repo is public; internal design docs are not.
  Restate the reasoning in the summary instead of pointing at a path a reader
  cannot open.
- **closes-trailer** — if the branch name encodes a ticket, the body should
  close it. Add the bare `Closes #N` line to the references region.

The `proposed-squash-commit` block is exempt from the commit rules *as part of
the PR body*, but its contents still have to pass commitlint when the squash
actually happens. Validate it with `commit-create`'s script before you rely on
it.

When a check flags something, fix the body — do not reach for `--no-verify` or
an equivalent bypass.
