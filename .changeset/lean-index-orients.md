---
"@savvy-web/silk": patch
---

## Refactoring

Compacts the always-on `silk_capabilities` SessionStart orientation payload (emitted by `plugins/silk/hooks/session-start/orientation.sh`) from a detailed instruction dump into a compact index, cutting the emitted payload from 7,585 to roughly 3,008 characters. The payload re-fires on every session start, resume, and compact, so the reduction lowers the plugin's fixed context footprint per Anthropic's context-engineering guidance for Claude 5.

* One line per MCP tool, with parameter and mode detail left to the tool's own schema instead of being spelled out in the payload
* A one-sentence-per-agent index that keeps the proactive-dispatch nudges
* A compact skill name list that defers to each skill's frontmatter description
* A three-line Biome note and a prose active-hooks note in place of the longer prior explanations

## CI

* `hook-tests.yml` no longer runs the removed `plugins/github-actions` hook suite or watches its paths for changes
