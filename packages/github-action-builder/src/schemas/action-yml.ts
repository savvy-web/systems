/**
 * GitHub Action action.yml schema validation using Effect Schema.
 *
 * @remarks
 * Validates structure according to GitHub's action.yml specification.
 * Based on the official JSON Schema from SchemaStore.
 *
 * @see {@link https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions | GitHub Actions metadata syntax}
 * @see {@link https://github.com/SchemaStore/schemastore/blob/master/src/schemas/json/github-action.json | Official JSON Schema}
 *
 * @internal
 */
import { Schema } from "effect";

// =============================================================================
// Branding Icons (Feather Icons)
// =============================================================================

/**
 * Valid Feather icons for GitHub Action branding.
 *
 * @remarks
 * Complete list from the official GitHub Actions schema.
 *
 * @internal
 */
export const BrandingIcon = Schema.Literal(
	"activity",
	"airplay",
	"alert-circle",
	"alert-octagon",
	"alert-triangle",
	"align-center",
	"align-justify",
	"align-left",
	"align-right",
	"anchor",
	"aperture",
	"archive",
	"arrow-down-circle",
	"arrow-down-left",
	"arrow-down-right",
	"arrow-down",
	"arrow-left-circle",
	"arrow-left",
	"arrow-right-circle",
	"arrow-right",
	"arrow-up-circle",
	"arrow-up-left",
	"arrow-up-right",
	"arrow-up",
	"at-sign",
	"award",
	"bar-chart-2",
	"bar-chart",
	"battery-charging",
	"battery",
	"bell-off",
	"bell",
	"bluetooth",
	"bold",
	"book-open",
	"book",
	"bookmark",
	"box",
	"briefcase",
	"calendar",
	"camera-off",
	"camera",
	"cast",
	"check-circle",
	"check-square",
	"check",
	"chevron-down",
	"chevron-left",
	"chevron-right",
	"chevron-up",
	"chevrons-down",
	"chevrons-left",
	"chevrons-right",
	"chevrons-up",
	"circle",
	"clipboard",
	"clock",
	"cloud-drizzle",
	"cloud-lightning",
	"cloud-off",
	"cloud-rain",
	"cloud-snow",
	"cloud",
	"code",
	"command",
	"compass",
	"copy",
	"corner-down-left",
	"corner-down-right",
	"corner-left-down",
	"corner-left-up",
	"corner-right-down",
	"corner-right-up",
	"corner-up-left",
	"corner-up-right",
	"cpu",
	"credit-card",
	"crop",
	"crosshair",
	"database",
	"delete",
	"disc",
	"dollar-sign",
	"download-cloud",
	"download",
	"droplet",
	"edit-2",
	"edit-3",
	"edit",
	"external-link",
	"eye-off",
	"eye",
	"fast-forward",
	"feather",
	"file-minus",
	"file-plus",
	"file-text",
	"file",
	"film",
	"filter",
	"flag",
	"folder-minus",
	"folder-plus",
	"folder",
	"gift",
	"git-branch",
	"git-commit",
	"git-merge",
	"git-pull-request",
	"globe",
	"grid",
	"hard-drive",
	"hash",
	"headphones",
	"heart",
	"help-circle",
	"home",
	"image",
	"inbox",
	"info",
	"italic",
	"layers",
	"layout",
	"life-buoy",
	"link-2",
	"link",
	"list",
	"loader",
	"lock",
	"log-in",
	"log-out",
	"mail",
	"map-pin",
	"map",
	"maximize-2",
	"maximize",
	"menu",
	"message-circle",
	"message-square",
	"mic-off",
	"mic",
	"minimize-2",
	"minimize",
	"minus-circle",
	"minus-square",
	"minus",
	"monitor",
	"moon",
	"more-horizontal",
	"more-vertical",
	"move",
	"music",
	"navigation-2",
	"navigation",
	"octagon",
	"package",
	"paperclip",
	"pause-circle",
	"pause",
	"percent",
	"phone-call",
	"phone-forwarded",
	"phone-incoming",
	"phone-missed",
	"phone-off",
	"phone-outgoing",
	"phone",
	"pie-chart",
	"play-circle",
	"play",
	"plus-circle",
	"plus-square",
	"plus",
	"pocket",
	"power",
	"printer",
	"radio",
	"refresh-ccw",
	"refresh-cw",
	"repeat",
	"rewind",
	"rotate-ccw",
	"rotate-cw",
	"rss",
	"save",
	"scissors",
	"search",
	"send",
	"server",
	"settings",
	"share-2",
	"share",
	"shield-off",
	"shield",
	"shopping-bag",
	"shopping-cart",
	"shuffle",
	"sidebar",
	"skip-back",
	"skip-forward",
	"slash",
	"sliders",
	"smartphone",
	"speaker",
	"square",
	"star",
	"stop-circle",
	"sun",
	"sunrise",
	"sunset",
	"table",
	"tablet",
	"tag",
	"target",
	"terminal",
	"thermometer",
	"thumbs-down",
	"thumbs-up",
	"toggle-left",
	"toggle-right",
	"trash-2",
	"trash",
	"trending-down",
	"trending-up",
	"triangle",
	"truck",
	"tv",
	"type",
	"umbrella",
	"underline",
	"unlock",
	"upload-cloud",
	"upload",
	"user-check",
	"user-minus",
	"user-plus",
	"user-x",
	"user",
	"users",
	"video-off",
	"video",
	"voicemail",
	"volume-1",
	"volume-2",
	"volume-x",
	"volume",
	"watch",
	"wifi-off",
	"wifi",
	"wind",
	"x-circle",
	"x-square",
	"x",
	"zap-off",
	"zap",
	"zoom-in",
	"zoom-out",
);

/**
 * Type for branding icon.
 * @internal
 */
export type BrandingIcon = typeof BrandingIcon.Type;

// =============================================================================
// Input/Output Schemas
// =============================================================================

/**
 * Schema for action input definition.
 *
 * @remarks
 * According to the official schema, `description` is required.
 *
 * @internal
 */
export const ActionInput = Schema.Struct({
	description: Schema.String,
	required: Schema.optional(Schema.Boolean),
	default: Schema.optional(Schema.String),
	deprecationMessage: Schema.optional(Schema.String),
});

/**
 * Type for action input.
 * @internal
 */
export type ActionInput = typeof ActionInput.Type;

/**
 * Schema for action output definition (Docker/JavaScript actions).
 *
 * @remarks
 * According to the official schema, `description` is required.
 *
 * @internal
 */
export const ActionOutput = Schema.Struct({
	description: Schema.String,
});

/**
 * Type for action output.
 * @internal
 */
export type ActionOutput = typeof ActionOutput.Type;

// =============================================================================
// Runs Configuration Schema
// =============================================================================

/**
 * Schema for Node.js action runs configuration.
 *
 * @remarks
 * This tool builds Node.js 24 actions exclusively. The `using` field
 * is fixed to `node24`.
 *
 * @internal
 */
export const Runs = Schema.Struct({
	using: Schema.Literal("node24"),
	main: Schema.String,
	pre: Schema.optional(Schema.String),
	"pre-if": Schema.optional(Schema.String),
	post: Schema.optional(Schema.String),
	"post-if": Schema.optional(Schema.String),
});

/**
 * Type for runs configuration.
 * @internal
 */
export type Runs = typeof Runs.Type;

// =============================================================================
// Branding Schema
// =============================================================================

/**
 * Valid branding colors for GitHub Marketplace.
 *
 * @remarks
 * Complete list from the official schema.
 *
 * @internal
 */
export const BrandingColor = Schema.Literal(
	"white",
	"black",
	"yellow",
	"blue",
	"green",
	"orange",
	"red",
	"purple",
	"gray-dark",
);

/**
 * Type for branding color.
 * @internal
 */
export type BrandingColor = typeof BrandingColor.Type;

/**
 * Schema for branding configuration.
 * @internal
 */
export const Branding = Schema.Struct({
	icon: Schema.optional(BrandingIcon),
	color: Schema.optional(BrandingColor),
});

/**
 * Type for branding configuration.
 * @internal
 */
export type Branding = typeof Branding.Type;

// =============================================================================
// Complete Action.yml Schema
// =============================================================================

/**
 * Complete action.yml schema.
 *
 * @remarks
 * This schema validates the structure of action.yml files according to
 * GitHub's metadata syntax specification. Note that the official schema
 * uses `patternProperties` for inputs/outputs key validation which cannot
 * be directly represented in Effect Schema.
 *
 * @internal
 */
export const ActionYml = Schema.Struct({
	name: Schema.String,
	description: Schema.String,
	author: Schema.optional(Schema.String),
	inputs: Schema.optional(Schema.Record({ key: Schema.String, value: ActionInput })),
	outputs: Schema.optional(Schema.Record({ key: Schema.String, value: ActionOutput })),
	runs: Runs,
	branding: Schema.optional(Branding),
});

/**
 * Type for action.yml content.
 * @internal
 */
export type ActionYml = typeof ActionYml.Type;
