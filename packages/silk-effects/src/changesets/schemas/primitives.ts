/**
 * Primitive reusable schemas for common constrained types.
 *
 * @remarks
 * These schemas serve as building blocks for more complex schemas throughout
 * the \@savvy-web/changesets package. They encode common constraints
 * (non-empty strings, positive integers) as Effect Schemas so that validation
 * is enforced at system boundaries.
 *
 * @see {@link https://effect.website/docs/schema/introduction | Effect Schema documentation}
 *
 * @packageDocumentation
 */

import { Schema } from "effect";

/**
 * A non-empty string schema.
 *
 * @remarks
 * Validates that a string has at least one character. Used as the base
 * constraint for package names, dependency identifiers, and other fields
 * that must not be blank.
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { NonEmptyString } from "@savvy-web/changesets";
 *
 * // Succeeds — non-empty string
 * const name = Schema.decodeUnknownSync(NonEmptyString)("react");
 *
 * // Throws ParseError — empty string
 * Schema.decodeUnknownSync(NonEmptyString)("");
 * ```
 *
 * @see {@link ChangesetSummarySchema} for a length-bounded variant used for changeset summaries
 *
 * @public
 */
export const NonEmptyString = Schema.String.pipe(Schema.minLength(1));

/**
 * A positive integer schema.
 *
 * @remarks
 * Validates that a number is both an integer and strictly greater than zero.
 * Used as the base constraint for GitHub issue numbers and similar
 * identifiers that must be positive whole numbers.
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { PositiveInteger } from "@savvy-web/changesets";
 *
 * // Succeeds — positive integer
 * const issueNum = Schema.decodeUnknownSync(PositiveInteger)(42);
 *
 * // Throws ParseError — zero is not positive
 * Schema.decodeUnknownSync(PositiveInteger)(0);
 *
 * // Throws ParseError — floats are not integers
 * Schema.decodeUnknownSync(PositiveInteger)(3.14);
 * ```
 *
 * @see {@link IssueNumberSchema} which builds on this for GitHub issue/PR numbers
 *
 * @public
 */
export const PositiveInteger = Schema.Number.pipe(Schema.int(), Schema.positive());
