---
name: checks-and-reports
description: >
  The reporting surface of a GitHub Action built on
  @savvy-web/github-action-effects — check runs, job summaries, and sticky PR
  comments, plus the GithubMarkdown and ReportBuilder builders that feed all
  three. Owns the withCheckRun-vs-explicit decision, the 65535-byte check cap,
  findings→conclusion derivation, marker-keyed comment upsert, and the
  pure-builder discipline. Verified against
  @savvy-web/github-action-effects@3.0.4. User-invokable as
  /github-actions:checks-and-reports.
when_to_use: >
  "create a check run", "check summary", "check conclusion", "annotations on a
  PR", "job summary", "GITHUB_STEP_SUMMARY", "comment on the PR from the
  action", "sticky comment", "update the same comment", "PR comment marker",
  "ReportBuilder", "GithubMarkdown", "markdown table in a summary", "report the
  results of an action", "neutral check", "strict-warnings"
---

# Checks, summaries, and PR comments

An action reports through three sinks: a **check run** (per-commit, gates
branch protection), the **job summary** (per-workflow-run page), and a
**sticky PR comment** (the conversational surface). All three consume the same
pure markdown builders. The rule that organizes everything here: **render from
data with pure functions, then ship the string to a sink through a service** —
never interleave I/O with composition.

Library paths cited below (e.g. `src/services/CheckRun.ts`) are inside the
installed `@savvy-web/github-action-effects` package — read them there when
in doubt.

## Which sink, when

| Destination | Service | Use for |
| --- | --- | --- |
| Check run | `CheckRun` | Pass/fail visible on the PR checks tab; anything branch protection should gate on; per-file annotations |
| Job summary | `ActionOutputs.summary` | The run's own results page; terse panel of what happened |
| Sticky PR comment | `PullRequestComment.upsert` | A report that must update in place across pushes; human conversation surface |
| ≥2 of the above | `ReportBuilder` | One report rendered to every sink it fits |

## Check runs

### Bracket form: `withCheckRun`

```ts
const checks = yield* CheckRun;
yield* checks.withCheckRun(checkName, headSha, (checkRunId) =>
  Effect.provide(body(checkRunId), appLayer),
);
```

Semantics (`src/services/CheckRun.ts`): create → run → auto-complete with
`"success"` on success, `"failure"` on failure. Two hard rules:

1. **Put user-visible failure work INSIDE the bracket.** Anything that can
   legitimately fail the run should fail *with a red check in the GitHub UI*,
   not as an invisible early exit before the check exists. Preflight
   validation — workspace detection, input cross-checks — belongs inside the
   bracket for exactly this reason.
2. **The callback requires `R = never`.** `withCheckRun`'s effect parameter is
   `Effect<A, E>` — no environment. You must `Effect.provide` your app layer
   *inside* the callback even though the surrounding program already provided
   it. Because layers are memoized by reference, providing the same layer
   const twice does not rebuild services.

### Explicit form: create → complete

For aggregating N sub-results into one check (or when the conclusion is not
plain success/failure), create and complete explicitly:

```ts
const { id: checkId, htmlUrl } = yield* checks.create(checkTitle, sha);
yield* checks.complete(checkId, success ? "success" : "failure", {
  title: checkSummary,               // short line under the check name
  summary: capCheckSummary(details), // markdown body — CAP IT (below)
});
```

Keep `htmlUrl` — reports link back to the check page with it.

### The 65535-BYTE cap

GitHub rejects `output.summary` / `output.text` over 65535 **UTF-8 bytes** —
bytes, not characters. A summary full of ✅/❌/│ glyphs can be well under the
char count and still 422 the whole phase. Always cap through a helper like
this:

```ts
export const GITHUB_CHECK_SUMMARY_LIMIT = 65535;

export const capCheckSummary = (summary: string): string => {
  if (Buffer.byteLength(summary, "utf8") <= GITHUB_CHECK_SUMMARY_LIMIT) return summary;
  const notice = "\n\n_…summary truncated (exceeded GitHub's 65535-byte check limit)._";
  const budget = GITHUB_CHECK_SUMMARY_LIMIT - Buffer.byteLength(notice, "utf8");
  let truncated = Buffer.from(summary, "utf8").subarray(0, budget).toString("utf8");
  if (truncated.endsWith("�")) truncated = truncated.slice(0, -1);
  return `${truncated}${notice}`;
};
```

(The `�` strip drops a partial multi-byte sequence at the cut so the output
stays valid UTF-8 within budget.)

### Annotations

`CheckRunOutput.annotations` takes `{path, start_line, end_line,
annotation_level: "notice"|"warning"|"failure", message, title?}`.
**`CheckRunLive` silently slices to the first 50 per request**
(`src/layers/CheckRunLive.ts`) — GitHub's per-request limit. If you have more
than 50, order them most-important-first before calling `update`; the tail is
dropped, not batched.

### Findings → conclusion

When an action reports multiple sub-results, model them as findings —
`{severity: "error" | "warning", check, scope, message}` — and *derive* the
check conclusion; never hand-assign it per code path:

```ts
// Checks with their own success criteria, unaffected by a failed build.
const BUILD_INDEPENDENT_CHECKS = new Set(["lint", "changeset-format"]);

export const deriveCheckConclusion = (
  check: string,
  findings: ReadonlyArray<Finding>,
  buildSucceeded: boolean,
  strictWarnings: boolean,
): "success" | "failure" | "neutral" => {
  const scoped = findings.filter((f) => f.check === check);
  if (scoped.some((f) => f.severity === "error")) return "failure";
  if (!buildSucceeded && !BUILD_INDEPENDENT_CHECKS.has(check)) return "failure";
  if (scoped.some((f) => f.severity === "warning")) {
    return strictWarnings ? "failure" : "neutral";
  }
  return "success";
};
```

- `"neutral"` means "ran, advisory output, does not block branch protection".
- The `strict-warnings` input escalates `"neutral"` to `"failure"` so
  branch-protection/auto-merge gates can act on warnings without changing the
  JSON contract.
- When the build fails, everything except the explicitly build-independent
  checks cascades to `"failure"` even with zero findings — no downstream step
  ran, so a green check would lie.

Keep the findings array in the structured output too — the same data drives
the comment's header icon and the findings table (see `outputs-and-schemas`).

### Cleanup on interruption

If a phase creates several checks and dies partway, mark the incomplete ones
`"cancelled"` with a reason: iterate the check ids you created, wrap **each**
`get`/`complete` in `Effect.result`, skip already-completed checks, and
accumulate errors into the result — cleanup itself must never fail the phase.

## Job summaries

`ActionOutputs.summary(markdown)`:

- **Appends** to `GITHUB_STEP_SUMMARY` (`flag: "a"`,
  `src/layers/ActionOutputsLive.ts`) — it never replaces. Compose the full
  panel first, write once.
- Fails with `ActionOutputError` when `GITHUB_STEP_SUMMARY` is unset — which is
  why every call site demotes it:

```ts
yield* outputs.summary(buildSummary(facts)).pipe(
  Effect.catch((e) => Effect.logWarning(`Failed to write job summary: ${e.reason}`)),
);
```

A failed summary write must never fail a run that otherwise succeeded.

- The job summary and the check body **may deliberately diverge**: the check
  page can carry more (e.g. the full structured-JSON `result` block in a
  fenced code block) while the job summary stays terse.
- Never `appendFileSync` to `GITHUB_STEP_SUMMARY` yourself — the service owns
  the file so tests can capture it.

### The panel style

Emoji-prefixed H2 → `Property | Value` tables → `details()` for noise:

```ts
return [
  GithubMarkdown.heading("🚀 Runtime Setup", 2),
  GithubMarkdown.table(["Component", "Detail"], rows),
  GithubMarkdown.details("Cache details", GithubMarkdown.list(detailItems)),
].join("\n\n");
```

Join top-level blocks with `"\n\n"`, always.

## Sticky PR comments

`PullRequestComment.upsert(prNumber, markerKey, body)` finds-or-creates a
comment carrying a hidden `<!-- savvy-web:<key> -->` marker. The `savvy-web:`
prefix is **hardcoded by the library** (`src/layers/PullRequestCommentLive.ts`;
match is by substring over the first 100 comments). Rules:

- **The service owns the marker.** Body builders never emit it.
- Pick a stable, action-scoped `markerKey` (e.g. `"build-report"`,
  `"validation"`) — changing it orphans the old comment.
- **Non-fatal, and skip gracefully when there is no PR**:

```ts
if (openPr !== undefined) {
  yield* updateStickyComment(openPr.number, body, "build-report").pipe(
    Effect.catch((e) => Effect.logWarning(`Failed to update sticky comment: ${String(e)}`)),
  );
} else {
  yield* Effect.logInfo("Sticky comment update skipped — no open PR found for this branch");
}
```

- For creating/updating the PR itself (not a comment), use
  `PullRequest.getOrCreate({head, base, title, body, autoMerge})` — it returns
  `{number, url, created, nodeId}`; log Created vs Updated.

### Comment body composition

The canonical composition — a **pure function** over the same payload that is
emitted as the structured `result` output, so the comment is provably a
projection of the exact emitted JSON:

1. Worst-state header icon derived from findings: `❌` if any error, `⚠️` if
   any warning, else `✅` — the same findings that drove the check conclusion.
2. Dry-run callout as a blockquote right under the header:
   `> 🧪 **DRY RUN MODE** - No actual publishing will occur`.
3. The checks table; the findings table **only when non-empty**.
4. **Degrade empty sections to prose, never render an empty table** — a
   0-row "What will be released" table reads as a successful-but-empty
   result; substitute an explanatory sentence per degraded state instead.
5. Footer: `---\n\n<sub>Updated at ${now.toISOString()}</sub>` with `now`
   **injectable** via options so tests stay deterministic.

Full composition rules with a worked example:
[comment-composition.md](./references/comment-composition.md).

## ReportBuilder — the default for multi-sink reports

`ReportBuilder` (`src/utils/ReportBuilder.ts`) is the house fluent builder:
immutable, every method returns a new `Report`. **Reach for it whenever the
same report goes to two or more sinks** — it exists so ad-hoc string arrays
stop being copy-pasted per destination:

```ts
const report = ReportBuilder.create("Build Report")
  .stat("Duration", "1.5s")
  .stat("Packages", 12)
  .section("Failures", GithubMarkdown.list(failures))
  .details("Full log", GithubMarkdown.codeBlock(log, "text"));

yield* report.toSummary();                       // needs ActionOutputs
yield* report.toComment(prNumber, "build-report"); // needs PullRequestComment
yield* report.toCheckRun(checkRunId);            // needs CheckRun (update, not complete)
```

Renders as: H2 title → `Stat | Value` table → H3 sections / details blocks.
Two sink caveats (verified against source): `toCheckRun` calls `update` with
the markdown in `output.text` and the title doubling as `output.summary` — you
still `complete` the check yourself; and `toComment` upserts, so pick the
marker key with the same care as above. Full API: [markdown-vocabulary.md](./references/markdown-vocabulary.md).

## Pure builders, separately tested

Every rendering function takes data in and returns a string — no services, no
I/O, no clock reads (inject `now`). This is what makes the report layer
testable without any GitHub stub and provably consistent with the emitted
JSON. Put builders in their own module (e.g. `services/summary.ts`,
`services/report.ts`) with co-located tests asserting on the markdown.

## Do this, not this

| Do | Not | Why |
| --- | --- | --- |
| `capCheckSummary(details)` before `complete` | Post the summary raw | 65535-byte 422 kills the whole phase; bytes ≠ chars |
| Fail work inside `withCheckRun` | Validate before creating the check | Failure must be a red check, not an invisible exit |
| `Effect.provide(body, appLayer)` inside the bracket callback | Assume the outer provide reaches it | Callback signature is `R = never`; memoization makes the double-provide free |
| Derive conclusion from findings | Hand-assign per code path | Keeps check, comment icon, and JSON output provably consistent |
| `summary(...)` once, demoted with `Effect.catch` → `logWarning` | Let a summary failure fail the run | Reporting is best-effort; the work already succeeded |
| `GithubMarkdown` / `ReportBuilder` via `ActionOutputs.summary` | Hand-`appendFileSync` or a hand-rolled markdown helper | Bypassing the service is untestable; the library builders are the single vocabulary all sinks share |
| `upsert` with a stable marker key | `create` a new comment each run | Comment spam; the marker is what makes it sticky |
| Degrade an empty section to a sentence | Render a 0-row table | An empty table misreads as a successful empty result |
| Order annotations most-important-first | Send >50 and assume batching | `CheckRunLive` silently slices to 50 (`src/layers/CheckRunLive.ts`) |

## Reference map

| Reference | Load when |
| --- | --- |
| [markdown-vocabulary.md](./references/markdown-vocabulary.md) | You need the exact `GithubMarkdown` / `ReportBuilder` API surface or rendered shapes |
| [comment-composition.md](./references/comment-composition.md) | Composing a sticky-comment or check-summary body and you want the full composition rules with a worked example |

## Related skills

`logging` owns the run log itself (Step, groups, buffers) — this skill owns
what lands on GitHub surfaces. `outputs-and-schemas` owns the structured
`result` output the findings/projections feed. `github-api` owns the
`GitHubClient` under `CheckRun`/`PullRequestComment`. `errors-and-state` owns
the demote-vs-fail decision each call site makes. Route from
`action-engineering`.
