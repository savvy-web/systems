/**
 * The tool annotation that carries each tool's markdown transcript renderer
 * to the server's registration step.
 *
 * @remarks
 * rc.115's `McpServer.registerToolkit` renders every success as
 * `content: [{ type: "text", text: JSON.stringify(encodedResult) }]` plus
 * `structuredContent` and offers no hook over the text
 * (`unstable/ai/McpServer.ts:1577-1585`). `server.ts` therefore registers the
 * toolkit itself through the public `McpServer.addTool` and reads this
 * annotation to put the tool's markdown projection in `content[0].text`
 * while `structuredContent` stays the typed object — the dual channel every
 * tool description promises. A tool without the annotation falls back to the
 * framework's JSON text.
 *
 * @packageDocumentation
 */

import { Context } from "effect";

/**
 * Renders a tool's decoded success value as the markdown transcript an agent
 * reads. Typed over `unknown` because the annotation is read generically at
 * registration; each tool supplies `Schema.decodeUnknownSync(<X>AsMarkdown)`,
 * whose own decoder is the type guard.
 *
 * @public
 */
export class SilkMarkdown extends Context.Service<SilkMarkdown, (data: unknown) => string>()(
	"@savvy-web/mcp/SilkMarkdown",
) {}
