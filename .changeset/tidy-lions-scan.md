---
"@savvy-web/silk-effects": minor
---

## Features

### Commit bodies target a scannable summary, not a design document

`verbosityRule` now advises past 12 body lines or 150 words, down from 25 and 400. The house format is three to five bullets, or one to two short paragraphs, plus the two trailer lines the rule counts — so the old thresholds admitted bodies several times longer than anything intended to survive a squash merge. The advisory text now says why brevity is correct here and points depth at the PR description.

`VERBOSITY_LINE_THRESHOLD` and `VERBOSITY_WORD_THRESHOLD` are exported, so a consumer asserting on the numbers can bind to the constants.

## Bug Fixes

### `hasClosingTrailer` reads every id in a comma-separated trailer

The house format puts every issue on one trailer, as `Closes #247, #248, #251`. The previous pattern anchored on `keyword` followed by a single reference, so it matched only the first id and the `closes-trailer` rule reported a missing trailer that was plainly present. It now captures the whole reference list and scans it, and additionally accepts the `and` and `Closes:` spellings.
