---
"@savvy-web/silk": minor
---

## Features

The github-actions plugin now ships an `action-engineer` agent and a
twelve-skill suite for building Node.js 24 GitHub Actions with
`@savvy-web/github-action-effects` and `@savvy-web/github-action-builder`.
The `action-engineering` routing skill maps every job to the owning service
and skill (and lists the capabilities that deliberately do not exist), and
the topic skills carry the house patterns distilled from the production
actions built on this stack: scaffolding from the template repo, `action.config.ts` builds and
the bundler dependency decision guide, entry-point and layer wiring,
input reading and validation, machine-readable output contracts with
generated and drift-tested JSON Schemas, GitHub App authentication across
pre/main/post, the GitHub API client surface, check runs, job summaries and
sticky PR comments, step-buffered run logging, tagged-error and cross-phase
state discipline, and testing with the library's test layers. Deep-dive
material is vendored into per-skill `references/` files with provenance
banners, verified against the installed package source. Skill content is
written for a standalone action repo cloned from `github-action-template`:
rules are stated directly with self-contained generic examples instead of
citing sibling-repo precedent, library citations resolve under
`node_modules/@savvy-web/…`, and example org/repo names are placeholders.

The SessionStart orientation hook now advertises the agent, the full skill
index, and the shared savvy-mcp server (and fails open when `jq` is
missing), and closes with a dogfood-feedback block: it asks the session to
keep a running log of rough edges in the plugin's own guidance and, only
with the user's explicit agreement, open an issue against this repo. The
plugin also gained a BATS + shellcheck suite wired into `pnpm test:hooks`
and the Hook Tests workflow, covering the orientation payload's skill
roster and the agent's skill-registration frontmatter.
