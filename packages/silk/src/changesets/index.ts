/**
 * Changesets class API shim for \@savvy-web/silk.
 *
 * Drop-in replacement for the root \@savvy-web/changesets export.
 * Re-exports the class-based API surface consumed by higher-level tools
 * and scripts that reference \@savvy-web/silk/changesets.
 *
 * @packageDocumentation
 */

import { Changesets } from "@savvy-web/silk-effects";

export type LintMessage = Changesets.LintMessage;

export const Categories = Changesets.Categories;
export const Changelog = Changesets.Changelog;
export const DependencyTable = Changesets.DependencyTable;
export const ChangesetLinter = Changesets.ChangesetLinter;
export const ChangelogTransformer = Changesets.ChangelogTransformer;
