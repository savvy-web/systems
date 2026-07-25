---
"@savvy-web/github-action-effects": minor
---

## Features

`GitHubOctokit` — the concrete Octokit instance type passed to `GitHubClient`'s `rest` / `paginate` / `paginateStream` callbacks. Annotate the callback parameter with it for full type safety instead of a hand-rolled cast interface:

```ts
client.rest("repos.get", (octokit: GitHubOctokit) => octokit.rest.repos.get({ owner, repo }));
```

## Bug Fixes

* `GitBranchError` gained optional `status` and `alreadyExists` fields. `GitBranchLive` now derives `alreadyExists: true` when a branch-create race resolves to a 422/409 "Reference already exists" response, so callers can match on the discriminant directly instead of re-querying branch state to infer intent.
