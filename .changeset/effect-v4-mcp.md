---
"@savvy-web/mcp": major
---

## Breaking Changes

- The server targets `effect@4`; the runtime layer stack and the `Schema`-to-JSON-Schema-to-zod bridge are rebuilt on `Schema.toJsonSchemaDocument`.

## Other

- Tool result contracts track the v4 `Schema` shapes; the ten-tool surface and the `@modelcontextprotocol/sdk` transport are unchanged.
