# Composing report bodies — the house rules

> Distilled from `@savvy-web/github-action-effects@3.0.4` source and production
> actions built on this stack, 2026-07-23. On version skew the installed source
> wins — re-verify before relying on this.

The rules for composing rich sticky-comment and check-summary bodies, in the
order a body is assembled. The worked example is a validation report for a
publish-style action; adapt names to your action.

## The one payload rule

Every surface — check conclusion, checks table, findings table, comment header
icon, forecast — renders from the **one canonical validation payload** that is
also emitted as the structured `result` output. No parallel comment input, no
second source of truth. Document the builder accordingly: "Pure function — no
I/O. The comment is provably a projection of the exact emitted JSON."

## Sticky-comment assembly

```ts
export function buildValidationComment(validation: ValidationPayload, options?: ValidationCommentOptions): string {
  const dryRun = options?.dryRun ?? false;
  const hasError = validation.findings.some((f) => f.severity === "error");
  const hasWarning = validation.findings.some((f) => f.severity === "warning");
  const headerIcon = hasError ? "❌" : hasWarning ? "⚠️" : "✅";

  const parts: string[] = [];
  parts.push(`## 📦 Release Validation ${headerIcon}`);

  if (dryRun) {
    parts.push("> 🧪 **DRY RUN MODE** - No actual publishing will occur");
  }

  parts.push(buildChecksTable(validation.checks));

  const findingsTable = buildFindingsTable(validation.findings);
  if (findingsTable !== "") {
    parts.push(findingsTable);
  }
  // … forecast section with degraded states (below) …
  const now = options?.now ?? new Date();
  parts.push(`---\n\n<sub>Updated at ${now.toISOString()}</sub>`);
  return parts.join("\n\n");
}
```

Ordered rules:

1. **Worst-state header icon** — computed over ALL findings, error beats
   warning beats clean. The same findings drive the check-run conclusion, so
   the comment can never disagree with the checks tab.
2. **Dry-run callout** — a blockquote directly under the H2, before any data.
3. **Conditional sections** — the findings table renders only when non-empty
   (an empty findings table would imply "we checked and found nothing" with a
   heading but no rows).
4. **Degraded empty states** — a forecast-style section ("what will happen on
   merge") has three arms:
   - upstream build failed → `⚠️ **Build validation failed** — no release
     preview is available. Fix the build errors flagged above; the preview
     regenerates once the build passes.`
   - nothing to do → `_No packages have version differences against the
     target branch — nothing will be published or released on merge._`
   - otherwise → the real summary + link.
   The comment explains *why* a section is empty instead of showing an empty
   table with 0-byte totals that reads like a successful empty result.
5. **Deterministic footer** — `<sub>Updated at ${now.toISOString()}</sub>`
   with `now` injected via options; tests pass a fixed date.
6. **No marker** — the hidden `<!-- savvy-web:<key> -->` marker is added by
   the library's upsert (the `savvy-web:` prefix is hardcoded in
   `src/layers/PullRequestCommentLive.ts`), never by the builder.

## Findings table shape

Errors first, then warnings; heading counts both:
`### ❌ 2 errors · ⚠️ 1 warning`. Columns `| | Check | Package | Detail |` with
a per-row severity icon and a `—` scope cell when unscoped.

## Findings model

```ts
interface ValidationFinding {
  severity: "error" | "warning";
  check: string;              // which checks-table row owns it
  scope: { package: string | null; directory: string | null } | null;
  message: string;
}
```

`deriveCheckConclusion(checkName, findings, buildSucceeded, strictWarnings)`
maps these onto `"success" | "failure" | "neutral"` — the full derivation is
in the SKILL body. A `BUILD_INDEPENDENT_CHECKS` const names the checks that do
NOT fail when the build fails; everything else cascades to `"failure"` even
with zero findings (no downstream step ran).

## Check body vs job summary

The unified check and the job summary render the same results table, but the
check body may append an extra block — e.g. the full structured `result` JSON
in a fenced code block — that the job summary deliberately omits, keeping the
terse job summary focused on the per-step results table. Cap the check body
with `capCheckSummary`; the job summary has no such API limit.

## Call-site discipline

- Find the PR first; **no PR is a logged skip, not an error**.
- Wrap the upsert in `logger.group("Update PR comment", …)`.
- Demote comment failure: `Effect.catch` → `logWarning` → return a stub
  result. The action's work must not fail because a comment could not post.
