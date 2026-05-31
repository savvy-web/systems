/**
 * Inlined seed content for the resource layer. Hand-authored markdown served
 * by URI. Kept as TS constants for the skeleton (no build-time copy / path
 * resolution); scale to bundled files later behind the same catalog.
 *
 * @packageDocumentation
 */

export const STANDARDS_CHANGESETS_MD = `# Silk standard: changesets

Silk uses section-aware changesets (@savvy-web/changesets). A changeset is a
short markdown file under \`.changeset/\` describing what a consumer upgrading
the package needs to know, grouped under category headings.

- One changeset per package; one dependency changeset per package.
- Validate with \`savvy changeset check .changeset\`.
- The full format spec (frontmatter, the valid section headings, rules
  CSH001-CSH005) lives in the \`/silk:changeset-style\` skill.

Load this when writing or reviewing a changeset, or deciding a version bump.
`;

export const PACKAGES_SILK_EFFECTS_INDEX_MD = `# @savvy-web/silk-effects

Platform-agnostic Effect library of Silk conventions. Single root export — all
services import from \`@savvy-web/silk-effects\`. Consumers provide their own
platform layer (\`NodeContext.layer\`).

Services include: SilkPublishability, TagStrategy, ChangesetConfigReader,
VersioningStrategy, ManagedSection, ConfigDiscovery, BiomeSchemaSync,
ToolDiscovery, and the SilkWorkspaceAnalyzer composite.

Topic pages:
- \`silk://packages/silk-effects/managed-section\` — tool-owned regions in
  user-editable files.

Load the relevant topic before using a service, instead of guessing its API.
`;

export const PACKAGES_SILK_EFFECTS_MANAGED_SECTION_MD = `# silk-effects: ManagedSection

\`ManagedSection\` reads, writes, syncs, and checks tool-owned regions inside
user-editable files (e.g. a husky hook). Requires the \`FileSystem\` layer.

Pattern:

\`\`\`typescript
const def = SectionDefinition.make({ toolName: "MY-TOOL" });
const result = yield* ms.sync(".husky/pre-commit", def.block("\\nnpx lint-staged\\n"));
// SyncResult: Created | Updated | Unchanged
\`\`\`

Load this when adding or editing a tool-managed block in a shared config file.
`;

export const GUIDES_LLM_JSON_SCHEMAS_MD = `# Guide: LLM-friendly JSON Schemas for tool outputs

(Stub — to be expanded.) Principles for designing structured outputs that
coding agents consume well: prefer flat, named fields over deep nesting; avoid
recursive shapes; use enums/literals for closed sets; collapse relations to
identifier arrays; include a short human-readable summary alongside the
structured payload.

Load this when designing a new MCP tool's output schema or a GitHub Action's
outputs.
`;
