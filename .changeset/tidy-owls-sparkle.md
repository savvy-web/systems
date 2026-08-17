---
"@savvy-web/silk-effects": major
---

## Breaking Changes

### `ClosingReferences.BARE_LINE_PATTERN` removed

The regex static that matched a bare `Closes #123`-style line is no longer part of the public API. `ClosingReferences.parseBare(region)` remains — same signature, same return shape — and is now backed by `@effected/github-references`.

If you were matching against `ClosingReferences.BARE_LINE_PATTERN` directly, call `parseBare` instead:

```typescript
// before
const ids = region
	.split("\n")
	.map((line) => ClosingReferences.BARE_LINE_PATTERN.exec(line.trim())?.[1])
	.filter((id): id is string => id !== undefined)
	.map(Number);

// after
const ids = ClosingReferences.parseBare(region);
```

## Features

### Closing-keyword grammar now covers all nine GitHub tenses everywhere it's checked

The commitlint `closes-trailer` rule and the changelog's commit-message issue harvesting both now recognize every closing keyword GitHub itself links on — `close`/`closes`/`closed`, `fix`/`fixes`/`fixed`, `resolve`/`resolves`/`resolved` — not just the present-tense plural (`closes`/`fixes`/`resolves`) they previously required. `Fixed #3` now satisfies the commitlint rule and is harvested into the changelog the same as `Fixes #3`.

## Bug Fixes

* `closes-trailer` now matches strictly whole-line trailers — a closing keyword appearing mid-prose no longer satisfies the rule (previously a sentence containing "closes #3" anywhere could pass)
* Changelog issue harvesting requires a `#` before the issue number — a bare `closes: 123` is no longer picked up (this was accidental drift, not an intended format)
* Changelog issue harvesting now accumulates references across every matching line instead of only the first — a commit body with two separate `Closes #...` lines previously lost the second
* Changelog issue harvesting now fully parses one-line, multi-keyword lists like `Closes #123, Fixes #456`
* Changelog issue harvesting accepts `and`/Oxford-comma separators (`Closes #1, #2 and #3`)
