---
"@savvy-web/mcp": patch
---

## Maintenance

Adapted the server wiring to Effect 4.1: the stdio server is now built with `McpStdio.layer` registrations and a `McpServer` middleware that supplies each tool's runtime dependencies per request. The tool surface is unchanged.
