# bridge-consumer

A starter project that gets its Jira and Confluence data through the
**[Jira Data Bridge](../jira-data-bridge/README.md)** instead of talking to Atlassian
directly. One place holds the credentials and the read-only guardrails; everything else
just asks the bridge.

## Why route through the bridge?

- **One credential surface.** Auth (Cloud Basic / Server-DC Bearer) is configured once; this
  project only names the site and token in its `.env`.
- **Read-only by construction.** The bridge relays `GET`/`HEAD` only, so a consumer can't
  accidentally mutate Jira.
- **Same tool humans use.** The [bridge UI](../jira-data-bridge/) and this code hit the exact
  same relay, so what you see in the browser is what you get in code.

## Quick start

```bash
# 1. Start the bridge (in another terminal)
cd ../jira-data-bridge && npm install && npm run dev   # proxy at http://localhost:5173/jira-proxy

# 2. Configure this project
cd ../bridge-consumer
cp .env.example .env      # then fill in ATLASSIAN_SITE, ATLASSIAN_EMAIL, ATLASSIAN_TOKEN
npm install

# 3. Verify the wiring, then run the demo
npm start                 # prints who you are, through the bridge
npm run example           # pulls Jira issues + Confluence spaces
```

| Command | What it does |
| --- | --- |
| `npm start` | Readiness check — connects via the bridge and prints the current user |
| `npm run example` | Demo — Jira `myself` + JQL search + Confluence spaces |
| `npm run typecheck` | `tsc --noEmit` |

## Using the helper in your own code

```ts
import { createBridgeClient, loadBridgeConfig } from './bridge'

const bridge = createBridgeClient(loadBridgeConfig())

// Jira
const me     = await bridge.myself()
const issues = await bridge.searchIssues('project = PROJ ORDER BY updated DESC', { maxResults: 20 })
const issue  = await bridge.jira('/issue/PROJ-123')          // any Jira REST GET path

// Confluence (same client, same token)
const spaces = await bridge.confluence('/space', { limit: 25 })
const page   = await bridge.confluence('/content/12345', { expand: 'body.storage' })
```

Every call returns `{ status, ok, data, text }` and only throws (`BridgeUnreachableError`)
when the bridge isn't running — so start it first.

## Configuration

Copy `.env.example` to `.env` (git-ignored):

| Variable | Meaning |
| --- | --- |
| `BRIDGE_URL` | The running bridge proxy (default `http://localhost:5173/jira-proxy`) |
| `ATLASSIAN_SITE` | Your site origin, e.g. `https://your-site.atlassian.net` |
| `ATLASSIAN_DEPLOYMENT` | `cloud` (email + API token) or `server` (personal access token) |
| `ATLASSIAN_EMAIL` | Account email — Cloud only |
| `ATLASSIAN_TOKEN` | Cloud API token or Server/DC PAT |

## How it fits together

```
bridge-consumer  ──HTTP(localhost)──►  jira-data-bridge /jira-proxy  ──►  Atlassian (Jira / Confluence)
   src/bridge/*                          (auth + read-only + CORS)          your site
```

`src/bridge/` speaks the bridge's HTTP contract directly (the three headers `accept`,
`authorization`, `x-jira-base-url`); it does not import from the bridge, so the two projects
stay decoupled. The full contract is documented in
[`../jira-data-bridge/docs/INTEGRATION.md`](../jira-data-bridge/docs/INTEGRATION.md).

## Notes

- **Confluence** goes through the same relay (`/wiki/rest/api/...`, same Cloud token); the
  bridge just has no Confluence UI yet. Server/DC Confluence uses a different base — confirm
  your instance.
- The bridge must be **running** for any call to work; it's a localhost dev/preview relay,
  not a hosted service.
- See [`CLAUDE.md`](./CLAUDE.md) for the agent-facing rule and runbook.
