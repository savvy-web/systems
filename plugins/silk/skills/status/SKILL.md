---
name: status
user-invocable: false
description: >
  Provides awareness of existing changeset files when working in .changeset/.
  Loads context about pending changesets to prevent duplicates and inform
  decisions about new changesets. Activates when reading or listing files
  in the .changeset/ directory, reviewing pending changes, or discussing
  release readiness.
paths:
  - ".changeset/*.md"
  - "**/.changeset/*.md"
---

# Changeset Status Awareness

When working with changesets, be aware of what already exists to avoid duplicates and conflicts.

## Check Before Creating

Before creating a new changeset file, always check for existing ones:

- List all `.md` files in `.changeset/` (excluding `README.md`)
- Read each existing changeset to understand which packages and bump types are already covered
- Compare the intended new changeset content against existing ones before proceeding

## Avoid Duplicate Entries

If an existing changeset already covers the same package and change type as the one you intend to create:

- Do not create a new changeset file for that package/bump-type combination
- Instead, suggest updating the existing changeset using `/silk:update`
- Only create a new changeset when the package or bump type is not yet represented, or when the changes are clearly distinct enough to warrant separate entries

## Summarize When Listing or Reviewing

When listing or reviewing the current set of changesets, always include:

- The total number of pending changesets
- Any packages that appear in more than one changeset, noting which bump types are involved

This helps identify consolidation opportunities and ensures nothing is accidentally duplicated before a release.

## Available Management Skills

Use these skills to manage pending changesets:

- `/silk:changeset --list` — overview of pending changesets with packages, bump types, and content previews
- `/silk:update` — modify an existing changeset's content or bump type
- `/silk:merge` — combine changesets that share the same bump type into a single file
- `/silk:delete` — remove a changeset that is no longer needed
- `/silk:changeset --preview` — preview the combined CHANGELOG output that the current set of changesets would produce
