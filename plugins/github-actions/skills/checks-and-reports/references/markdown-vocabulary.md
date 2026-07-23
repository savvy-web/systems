# GithubMarkdown and ReportBuilder — API reference

> Distilled from `@savvy-web/github-action-effects@3.0.4` source
> (`src/utils/GithubMarkdown.ts`, `src/utils/ReportBuilder.ts`) and production
> actions built on this stack, 2026-07-23. On version skew the installed
> source wins — re-verify before relying on this.

Both are pure string builders / composers — no I/O anywhere. The Effect-typed
methods on `Report` are thin `Effect.flatMap`s over the sink services.

## GithubMarkdown

A frozen namespace object (`as const`) of GFM builders.

| Member | Signature | Renders |
| --- | --- | --- |
| `table` | `(headers: ReadonlyArray<string>, rows: ReadonlyArray<ReadonlyArray<string>>) => string` | `\| h1 \| h2 \|` header + `---` separator + one row per entry. No escaping of `\|` in cells — keep cell text pipe-free |
| `heading` | `(text: string, level: 1\|2\|3\|4\|5\|6 = 2) => string` | `## text` (default level **2**) |
| `details` | `(summary: string, content: string) => string` | `<details><summary>…</summary>\n\n…\n\n</details>` collapsible |
| `rule` | `() => string` | `---` |
| `statusIcon` | `(status: "pass"\|"fail"\|"skip"\|"warn") => string` | `✅` / `❌` / `🗃️` / `⚠️` |
| `link` | `(text: string, url: string) => string` | `[text](url)` |
| `list` | `(items: ReadonlyArray<string>) => string` | `- item` lines |
| `checklist` | `(items: ReadonlyArray<{checked: boolean; label: string}>) => string` | `- [x] label` / `- [ ] label` |
| `bold` | `(text: string) => string` | `**text**` |
| `code` | `(text: string) => string` | `` `text` `` |
| `codeBlock` | `(content: string, language = "") => string` | fenced block |
| `image` | `(src, alt, options?: {width?, height?}) => string` | `<img …>` — attributes interpolated **raw, not HTML-escaped** (matches `@actions/core`; GitHub sanitizes summaries server-side, escape yourself elsewhere) |
| `quote` | `(text: string, cite?: string) => string` | `<blockquote …>` — same no-escaping caveat |

`Status` and `ChecklistItem` come from `schemas/GithubMarkdown.ts` and are
exported from the package root.

Composition convention: build an array of top-level blocks, `join("\n\n")`.

## ReportBuilder

`ReportBuilder.create(title: string): Report` — the only entry point.

`Report` is **immutable**; every builder method returns a new `Report`:

| Member | Signature | Notes |
| --- | --- | --- |
| `stat` | `(label: string, value: string \| number) => Report` | Accumulates rows of the `Stat \| Value` table (rendered only if ≥1 stat) |
| `section` | `(title: string, content: string) => Report` | H3 heading + markdown content, in insertion order |
| `details` | `(summary: string, content: string) => Report` | Collapsible block, interleaved with sections in insertion order |
| `toMarkdown` | `() => string` | H2 title → stats table → entries, joined `"\n\n"` |
| `toSummary` | `() => Effect<void, ActionOutputError, ActionOutputs>` | `outputs.summary(markdown)` — **appends** to the job summary |
| `toComment` | `(prNumber: number, markerKey: string) => Effect<void, PullRequestCommentError, PullRequestComment>` | `upsert` — marker-keyed sticky comment |
| `toCheckRun` | `(checkRunId: number) => Effect<void, CheckRunError, CheckRun>` | Calls `update(checkRunId, {title, summary: title, text: markdown})` |

### toCheckRun caveats

- It is an **update**, not a completion — bracket with `withCheckRun` or call
  `complete` yourself afterward.
- The report `title` doubles as `output.summary`; the full markdown lands in
  `output.text`. If your body risks the 65535-byte limit, pre-cap the strings
  you feed into sections (the builder does not cap).

### When NOT to use it

A report whose shape doesn't fit "stats table + titled sections" (e.g. a
validation comment with a worst-state header icon, degraded empty states, and
a timestamp footer) is composed by a dedicated pure function instead — see
[comment-composition.md](./comment-composition.md). ReportBuilder is the
default for the common shape, not a straitjacket.
