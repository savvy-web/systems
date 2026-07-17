import type { Effect, Option, Schema } from "effect";
import { Context } from "effect";
import type { ActionStateError } from "../errors/ActionStateError.js";

/**
 * Service shape for {@link ActionState}.
 *
 * @public
 */
export interface ActionStateShape {
	/**
	 * Save a value to action state. Uses Schema.encode to serialize
	 * complex objects to JSON strings for storage.
	 */
	readonly save: <A, I>(key: string, value: A, schema: Schema.Codec<A, I>) => Effect.Effect<void, ActionStateError>;

	/**
	 * Read a required state value. Uses Schema.decode to deserialize
	 * and validate the stored JSON string.
	 */
	readonly get: <A, I>(key: string, schema: Schema.Codec<A, I>) => Effect.Effect<A, ActionStateError>;

	/**
	 * Read an optional state value. Returns Option.none() if the key
	 * has no stored value.
	 */
	readonly getOptional: <A, I>(
		key: string,
		schema: Schema.Codec<A, I>,
	) => Effect.Effect<Option.Option<A>, ActionStateError>;
}

/**
 * Service for reading and writing GitHub Action state
 * with schema-based serialization across action phases (pre/main/post).
 *
 * @public
 */
export class ActionState extends Context.Service<ActionState, ActionStateShape>()(
	"github-action-effects/ActionState",
) {}
