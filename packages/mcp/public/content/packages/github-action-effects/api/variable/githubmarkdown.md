---
id: packages/github-action-effects/api/variable/githubmarkdown
title: "GithubMarkdown — github-action-effects variable"
summary: "Namespace for GitHub-Flavored Markdown builder functions."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# GithubMarkdown

Namespace for GitHub-Flavored Markdown builder functions.

```ts
GithubMarkdown: {
  readonly table: (headers: ReadonlyArray<string>, rows: ReadonlyArray<ReadonlyArray<string>>) => string;
  readonly heading: (text: string, level?: 1 | 2 | 3 | 4 | 5 | 6) => string;
  readonly details: (summary: string, content: string) => string;
  readonly rule: () => string;
  readonly statusIcon: (status: Status) => string;
  readonly link: (text: string, url: string) => string;
  readonly list: (items: ReadonlyArray<string>) => string;
  readonly checklist: (items: ReadonlyArray<ChecklistItem>) => string;
  readonly bold: (text: string) => string;
  readonly code: (text: string) => string;
  readonly codeBlock: (content: string, language?: string) => string;
  readonly image: (src: string, alt: string, options?: {
    readonly width?: string;
    readonly height?: string;
  }) => string;
  readonly quote: (text: string, cite?: string) => string;
}
```

## Examples

```ts
import { GithubMarkdown } from "@savvy-web/github-action-effects"

GithubMarkdown.table(["Name", "Status"], [["build", "pass"]])
GithubMarkdown.bold("hello")

```
