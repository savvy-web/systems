---
"@savvy-web/silk": patch
---

## Bug Fixes

Hardens the `tsdoctor` agent so a multi-step run (build → read `issues.json` → edit → rebuild) reliably finishes in a single dispatch and catches two header-comment mistakes the diagnostic-driven loop was missing.

* Turn-discipline contract: the agent no longer ends a turn on a statement of intent — it must run the final verifying build, confirm the filtered `ae-*`/`tsdoc-*` arrays are empty, and deliver the report as its last message.
* Proactive `@packageDocumentation` sweep: greps the package `src` and confirms every occurrence sits in an `exports`-entry file, since a stray tag on a non-entry file raises no diagnostic.
* Comment-style rule: module-header narration on non-entry files (especially `internal/*`) must use `//` line comments, not `/** */` doc blocks, which API Extractor parses and can misattribute.
