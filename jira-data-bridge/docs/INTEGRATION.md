# Jira Data Bridge — Integration Contract

The canonical contract for **other projects, tools, and agents** that want to pull Atlassian
data *through* this bridge instead of reimplementing Jira auth. If you already stand up the
bridge for a human, you can point any local process at the same relay.

For what the app itself does see [FUNCTIONALITY.md](./FUNCTIONALITY.md); for how it's wired
see [ARCHITECTURE.md](./ARCHITECTURE.md).

## The premise

The bridge's `/jira-proxy` is a **localhost-only, read-only (GET/HEAD)** relay to *any*
Atlassian base URL. It handles auth for you: you never wire up OAuth or juggle the
Cloud-vs-Server auth schemes — you send the **same three headers the browser client sends**
(`jiraClient.ts` → `headers()`), and the Vite middleware (`vite.config.ts` →
`jiraProxyHandler`) forwards the request to the site named in `x-jira-base-url` and relays
the response back.

Because the relay lives inside the Vite dev/preview server, a consumer must run **on the
same machine** and the bridge must be **running** (see [Prerequisite](#prerequisite)).

## The `/jira-proxy` HTTP contract

**URL shape**

```
http://localhost:<port>/jira-proxy<site-relative-path>[?query]
```

- `<port>` — the Vite server port. `npm run dev` defaults to **5173**; `npm run preview`
  defaults to **4173**. All examples below use 5173.
- `<site-relative-path>` — the path exactly as Jira/Confluence expects it, starting with `/`
  (e.g. `/rest/api/3/myself`). The proxy strips the `/jira-proxy` mount prefix and forwards
  the rest verbatim, appending it to the base URL's origin (and any context path on the base
  URL, e.g. `https://host/jira`).

**Required headers**

| Header | Value |
| --- | --- |
| `x-jira-base-url` | The Atlassian site origin, e.g. `https://your-site.atlassian.net` (must parse as `http`/`https`) |
| `authorization` | Cloud: `Basic base64(email:token)`; Server/DC: `Bearer <token>` |
| `accept` | `application/json` |

**Methods:** `GET` and `HEAD` only.

**Host:** must be `localhost` / `127.0.0.1` / `::1` — call it from the same machine. The
proxy forwards only `accept`, `authorization`, and `content-type` upstream, uses
`redirect: 'manual'`, and relays the upstream **status, content-type, and body** unchanged.

**Response / error codes**

| Code | Meaning |
| --- | --- |
| *(upstream status)* | Relayed verbatim from Jira/Confluence, with its content-type and body |
| `400` | Missing or invalid `x-jira-base-url` (not a valid http/https URL) |
| `403` | Request `Host` is not loopback |
| `405` | Method is not GET/HEAD |
| `502` | Upstream site unreachable (DNS/connection failure) |
| `500` | Unexpected proxy error after the response started |

## Building the `authorization` header

- **Cloud:** base64 of `email:apiToken`. Build it from **UTF-8 bytes** (a unicode email or
  token breaks a naive Latin-1 `btoa`).
- **Server / Data Center:** just `Bearer <personalAccessToken>` — no email.

```bash
# Cloud
EMAIL="you@example.com"
TOKEN="your-api-token"
AUTH="Basic $(printf '%s:%s' "$EMAIL" "$TOKEN" | base64 | tr -d '\n')"

# Server / Data Center
AUTH="Bearer your-personal-access-token"
```

## Jira paths

Core Jira REST: `/rest/api/3/...` on **Cloud**, `/rest/api/2/...` on **Server/DC**. Jira
Software (Agile) is `/rest/agile/1.0/...` on both.

```bash
BASE="https://your-site.atlassian.net"

# 1) Who am I (verifies the connection)
curl -s "http://localhost:5173/jira-proxy/rest/api/3/myself" \
  -H "x-jira-base-url: $BASE" \
  -H "authorization: $AUTH" \
  -H "accept: application/json"

# 2) JQL search (Cloud — token-paginated /search/jql, no total)
curl -s "http://localhost:5173/jira-proxy/rest/api/3/search/jql?jql=$(printf '%s' 'project = PROJ ORDER BY updated DESC' | jq -sRr @uri)&maxResults=50&fields=summary,status,assignee" \
  -H "x-jira-base-url: $BASE" \
  -H "authorization: $AUTH" \
  -H "accept: application/json"

# 3) Get a single issue
curl -s "http://localhost:5173/jira-proxy/rest/api/3/issue/PROJ-123?fields=summary,status,description" \
  -H "x-jira-base-url: $BASE" \
  -H "authorization: $AUTH" \
  -H "accept: application/json"
```

For **Server/DC**, swap `/rest/api/3/` for `/rest/api/2/` and use the classic offset-paginated
`/rest/api/2/search?jql=...&startAt=0&total` (Cloud removed the classic `/search` in 2025).

## Confluence paths (the stub)

Confluence **Cloud** REST lives at **`/wiki/rest/api/...`** on the **same site** with the
**same Cloud token** — so it goes through the same proxy **unchanged**. The bridge's
`rawGet` accepts any site-relative path, not just `/rest/api`, which is why this works with
no code change; there is simply no Confluence UI in the app.

```bash
BASE="https://your-site.atlassian.net"   # same Cloud site + same $AUTH as Jira

# List spaces
curl -s "http://localhost:5173/jira-proxy/wiki/rest/api/space" \
  -H "x-jira-base-url: $BASE" \
  -H "authorization: $AUTH" \
  -H "accept: application/json"

# Get a page with its storage-format body
curl -s "http://localhost:5173/jira-proxy/wiki/rest/api/content/123456?expand=body.storage" \
  -H "x-jira-base-url: $BASE" \
  -H "authorization: $AUTH" \
  -H "accept: application/json"
```

This is a **documented, working relay path**, but note:

- The bridge ships **no Confluence UI** — this is an integration path for consumers, not a
  feature of the app.
- **Server/DC Confluence** uses a *different* base (Data Center Confluence REST, typically
  `/rest/api/...` on a separate Confluence host, not `/wiki/...`). Confirm your instance's
  path and set `x-jira-base-url` to the Confluence host accordingly.

## Prerequisite

The relay only exists while the bridge's dev or preview server is running:

```bash
cd ../jira-data-bridge
npm install     # first time only
npm run dev     # serves the app + the /jira-proxy relay on http://localhost:5173
```

If the bridge is **down**, the proxy URL isn't served and the consumer can't reach
Atlassian — every call fails at the connection. Start the bridge first.

## Ready-made consumer

A sibling companion project at **`../bridge-consumer`** (a sibling of the `jira-data-bridge`
directory) provides a small TypeScript helper so you don't hand-assemble headers:

- `loadBridgeConfig()` reads `BRIDGE_URL`, `ATLASSIAN_SITE`, `ATLASSIAN_DEPLOYMENT`,
  `ATLASSIAN_EMAIL`, and `ATLASSIAN_TOKEN` from the environment / `.env`.
- `createBridgeClient(config)` returns `get()`, **`jira(path, query?)`**,
  **`confluence(path, query?)`**, `myself()`, and `searchIssues(jql, opts?)` — each prepends
  the right path prefix, attaches the three required headers, and resolves to
  `{ status, ok, data, text }` (never throwing on a non-2xx; only `BridgeUnreachableError`
  when the bridge is down).
- A **`CLAUDE.md`** runbook so an agent working in that project routes Jira/Confluence data
  needs through the bridge automatically.

```ts
import { createBridgeClient, loadBridgeConfig } from './bridge'
const bridge = createBridgeClient(loadBridgeConfig())
const issues = await bridge.searchIssues('project = PROJ ORDER BY updated DESC', { maxResults: 20 })
const page   = await bridge.confluence('/content/123456', { expand: 'body.storage' })
```

Prefer the helper over raw `curl`/`fetch` in application code — it centralizes the header
contract and the localhost/port assumptions described above.

## Security note

- **Localhost-only by design.** Non-loopback `Host` → 403, so the relay is not reachable
  from the LAN or the internet; keep the dev server on localhost.
- **GET/HEAD-only by design.** Non-read methods → 405. The relay cannot mutate Atlassian
  data, so a consumer can't either.
- **Credentials are supplied by the caller and never stored by the proxy.** The middleware
  reads `authorization` off each request and forwards it upstream; it keeps nothing. (The
  *app* optionally persists a connection to `localStorage` when a human ticks "Remember on
  this device" — that's the browser client, not the proxy, and it doesn't apply to
  headless consumers.)
