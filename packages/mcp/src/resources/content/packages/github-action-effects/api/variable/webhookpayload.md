---
id: packages/github-action-effects/api/variable/webhookpayload
title: "WebhookPayload — github-action-effects variable"
summary: "Common GitHub webhook event payload fields."
tier: packages
source: generated
tags: [github-action-effects, api]
priority: 0.3
related: []
---

# WebhookPayload

Common GitHub webhook event payload fields.

```ts
WebhookPayload: Schema.Struct<{
    repository: Schema.optional<Schema.Struct<{
        name: typeof Schema.String;
        full_name: Schema.optional<Schema.NullOr<typeof Schema.String>>;
        owner: Schema.Struct<{
            login: typeof Schema.String;
        }>;
        html_url: Schema.optional<Schema.NullOr<typeof Schema.String>>;
    }>>;
    issue: Schema.optional<Schema.Struct<{
        number: typeof Schema.Number;
        html_url: Schema.optional<Schema.NullOr<typeof Schema.String>>;
        body: Schema.optional<Schema.NullOr<typeof Schema.String>>;
    }>>;
    pull_request: Schema.optional<Schema.Struct<{
        number: typeof Schema.Number;
        html_url: Schema.optional<Schema.NullOr<typeof Schema.String>>;
        body: Schema.optional<Schema.NullOr<typeof Schema.String>>;
    }>>;
    sender: Schema.optional<Schema.Struct<{
        type: typeof Schema.String;
    }>>;
    action: Schema.optional<typeof Schema.String>;
    comment: Schema.optional<Schema.Struct<{
        id: typeof Schema.Number;
    }>>;
    installation: Schema.optional<Schema.Struct<{
        id: typeof Schema.Number;
    }>>;
    number: Schema.optional<typeof Schema.Number>;
    ref: Schema.optional<typeof Schema.String>;
    before: Schema.optional<typeof Schema.String>;
    after: Schema.optional<typeof Schema.String>;
}>
```
