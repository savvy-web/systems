/**
 * Real production `## Dependencies` section shapes, verbatim from shipped
 * changesets in `savvy-web/silk-update-action` (relayed by that repo's session
 * during the 2026-08-23 CSH005 unification round, systems#456/#457). Both rule
 * engines must accept all three — these shapes exist in shipped history.
 *
 * The details each one pins:
 * - `TABLE_THEN_PROSE_THEN_HEADING`: prose AFTER the table, and the section is
 *   terminated by a following `## Maintenance` heading the scanner must not
 *   swallow.
 * - `PADDED_TABLE_THEN_WRAPPED_PARAGRAPHS`: padded/aligned `| :--- |`
 *   delimiters and two hard-wrapped (~80 col) paragraphs after the table — a
 *   scanner treating a bare line after a table row as a table continuation
 *   misreads these.
 * - `TABLE_ONLY_SENTINELS`: table-only section with a `—` em-dash `To`
 *   cell on a removed row and a `catalog:effect` specifier where a version is
 *   expected (a colon inside a cell).
 */

/** silk-update-action `f55fab6:.changeset/adopt-kit-wave.md` (abridged rows). */
export const TABLE_THEN_PROSE_THEN_HEADING = `## Dependencies

| Dependency | Type | Action | From | To |
| :--------- | :--- | :----- | :--- | :-- |
| @effected/workspaces | dependency | updated | 0.12.0 | 0.13.0 |
| @effected/git | dependency | updated | 0.7.0 | 0.8.0 |
| @effected/github | dependency | updated | 0.4.1 | 0.4.2 |
| @savvy-web/silk-effects | dependency | updated | 5.7.1 | 5.8.1 |
| @savvy-web/silk | devDependency | updated | 3.7.1 | 3.7.4 |

These move together deliberately. Each is a 0.x package whose caret range pins
the minor, so bumping one alone leaves @savvy-web/silk-effects on the previous
minor and resolves two copies into the bundle.

## Maintenance

- Routine upkeep.
`;

/** silk-update-action `21113e4:.changeset/adopt-npm-pin-vocabulary.md` (abridged). */
export const PADDED_TABLE_THEN_WRAPPED_PARAGRAPHS = `## Dependencies

| Dependency               | Type          | Action  | From    | To      |
| :----------------------- | :------------ | :------ | :------ | :------ |
| @effected/npm            | dependency    | updated | ^0.10.0 | ^0.11.0 |
| @effected/github         | dependency    | updated | ^0.6.0  | ^0.7.0  |
| @savvy-web/silk-effects  | dependency    | updated | ^5.9.2  | ^6.0.0  |

\`@effected/github\` had to move because \`@effected/github-actions@0.9.1\` depends
on it and the lockfile still held \`0.6.0\`, whose \`GitHubClient\` embeds
\`@octokit/types@16\`.

\`@savvy-web/silk-effects@6.0.0\` brings \`@effected/github-references\` in
transitively, which now backs its closing-reference parsing; this action has no
direct call site for that grammar.
`;

/** silk-update-action `4443711:.changeset/effect-beta-107-wave.md` (abridged rows). */
export const TABLE_ONLY_SENTINELS = `## Dependencies

| Dependency | Type | Action | From | To |
| :--- | :--- | :--- | :--- | :--- |
| effect | dependency | updated | catalog:effect | catalog:effect |
| @effect/platform | dependency | updated | 0.90.0 | 0.91.0 |
| @effected/legacy-shim | dependency | removed | 0.3.0 | — |
`;

export const REAL_WORLD_DEPENDENCY_SECTIONS = [
	["table then prose then next heading (adopt-kit-wave)", TABLE_THEN_PROSE_THEN_HEADING],
	["padded delimiters + hard-wrapped paragraphs (adopt-npm-pin-vocabulary)", PADDED_TABLE_THEN_WRAPPED_PARAGRAPHS],
	["table-only with em-dash and catalog specifier (effect-beta-107-wave)", TABLE_ONLY_SENTINELS],
] as const;
