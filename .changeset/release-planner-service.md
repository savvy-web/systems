---
"@savvy-web/silk-effects": minor
---

## Features

Adds a Changesets.ReleasePlanner service that drives the genuine changesets
engine to compute a release plan, render a non-destructive preview of the next
release, or natively apply a release. Preview runs the real formatter in a
throwaway directory and reads the result back, so its output matches what ships.
