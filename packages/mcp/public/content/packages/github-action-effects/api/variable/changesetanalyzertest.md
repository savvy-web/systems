---
id: packages/github-action-effects/api/variable/changesetanalyzertest
title: "ChangesetAnalyzerTest — github-action-effects variable"
summary: "Test implementation for ChangesetAnalyzer."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# ChangesetAnalyzerTest

Test implementation for [ChangesetAnalyzer](silk://packages/github-action-effects/api/class/changesetanalyzer).

```ts
ChangesetAnalyzerTest: {
  readonly layer: (state: ChangesetAnalyzerTestState) => Layer.Layer<ChangesetAnalyzer>; /** Create a fresh empty test state. */
  readonly empty: () => ChangesetAnalyzerTestState;
}
```
