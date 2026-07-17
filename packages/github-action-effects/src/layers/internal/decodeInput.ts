import { Effect, Schema } from "effect";
import { ActionInputError } from "../../errors/ActionInputError.js";

/**
 * Decode a raw input string against a schema, mapping failures to ActionInputError.
 *
 * @internal
 */
export const decodeInput = <A, I>(
	name: string,
	raw: string,
	schema: Schema.Codec<A, I>,
): Effect.Effect<A, ActionInputError> =>
	Schema.decodeUnknownEffect(schema)(raw).pipe(
		Effect.mapError(
			(parseError) =>
				new ActionInputError({
					inputName: name,
					reason: `Input "${name}" validation failed: ${parseError.message}`,
					rawValue: raw,
				}),
		),
	);

/**
 * Parse a raw JSON string and validate against a schema.
 *
 * @internal
 */
export const decodeJsonInput = <A, I>(
	name: string,
	raw: string,
	schema: Schema.Codec<A, I>,
): Effect.Effect<A, ActionInputError> =>
	Effect.try({
		try: () => JSON.parse(raw) as unknown,
		catch: (error) =>
			new ActionInputError({
				inputName: name,
				reason: `Input "${name}" is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
				rawValue: raw,
			}),
	}).pipe(
		Effect.flatMap((parsed) =>
			Schema.decodeUnknownEffect(schema)(parsed).pipe(
				Effect.mapError(
					(parseError) =>
						new ActionInputError({
							inputName: name,
							reason: `Input "${name}" JSON validation failed: ${parseError.message}`,
							rawValue: raw,
						}),
				),
			),
		),
	);
