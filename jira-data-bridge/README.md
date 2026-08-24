# Jira Data Bridge

A single-page tool for pulling data **out** of Jira: paste your site URL and a token,
browse projects, run JQL, export CSV/JSON, and poke any of 80+ read-only REST endpoints —
all from the browser, nothing stored server-side.

Built with React 19 + TypeScript + Vite 6. Lives in this repo but is fully self-contained;
the comic reader at the repo root stays dependency-free.

## What it does

- **Issues** — a JQL search box (defaults to `ORDER BY updated DESC`) with a paginated
  results table: Key, Summary, Type, Status, Priority, Assignee, Updated. **Load more**
  fetches the next page; **Load all** keeps going up to a 500-issue cap. Click a row for a
  detail modal (Atlassian Document Format descriptions rendered as plain text, with a link
  out to the issue in Jira). Export everything loaded as **CSV** or **JSON**.
- **Projects** — a searchable card grid of every project you can see. **View issues** jumps
  to the Issues tab with `project = KEY` prefilled and runs it.
- **API Explorer** — a grouped dropdown cataloging 80+ Jira REST **GET** endpoints
  (core API v3/v2 plus Agile 1.0: myself, serverInfo, projects, issues, comments, worklogs,
  transitions, search, users, groups, fields, statuses, priorities, filters, dashboards,
  permissions, boards, sprints, epics, backlog, …). Pick one, fill the auto-generated
  path/query parameter inputs, send, and get the pretty-printed JSON response with copy and
  download buttons. The catalog contains no mutating endpoints — read-only by design.

## Quick start

```bash
cd jira-data-bridge
npm install
npm run dev        # Vite dev server + the /jira-proxy CORS relay
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with the Jira proxy |
| `npm run build` | Strict typecheck (both tsconfigs) + `vite build` → `dist/` |
| `npm run preview` | Serves `dist/` — **with** the proxy, so it actually works |
| `npm run typecheck` | Typecheck only, no build |

### First connect

1. Pick your deployment in the connect form:
   - **Jira Cloud** — enter your site URL (`https://yoursite.atlassian.net`), your account
     email, and an API token. Create the token at
     [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens) →
     Security → **API tokens**.
   - **Jira Server / Data Center** — enter your base URL and a **personal access token**,
     created in Jira under your profile → Personal Access Tokens.
2. Optionally check **Remember on this device** to keep the connection across reloads
   (see [Security notes](#security-notes) first).
3. Connect. The app verifies credentials with a `myself` call, then the tabs light up.

## How it works

### Auth

Two modes, switched by the deployment toggle:

| Deployment | Scheme | Sent as |
| --- | --- | --- |
| Cloud | email + API token | `Authorization: Basic base64(email:token)` |
| Server / Data Center | personal access token | `Authorization: Bearer <token>` |

Credentials live in memory. Only if you check **Remember on this device** are they
persisted — unencrypted — to `localStorage` under `jira-data-bridge:connection`. Nothing is
ever stored server-side; there is no backend beyond the relay below.

### The CORS proxy

Browsers can't call Jira's REST API cross-origin, so `vite.config.ts` registers a tiny
middleware at `/jira-proxy` on both the dev and preview servers. The client sends every
request there with an `x-jira-base-url` header naming the Jira site; the middleware relays
the request to that URL, forwarding only the `Authorization` and `Content-Type` headers,
and returns the response. To keep the relay from becoming an SSRF vector, it answers **only
requests whose `Host` is `localhost`** and forwards **GET/HEAD only** — so a rebound
attacker origin, a LAN caller under `--host`, or any write attempt is refused.

**Consequence:** the built `dist/` is not standalone. Hosting it as static files requires
putting an equivalent `/jira-proxy` relay in front (any small reverse-proxy will do), or
deploying same-origin next to Jira so no relay is needed. `npm run preview` exists
precisely so the production bundle can be exercised with the relay in place.

### Cloud vs. Server API differences

| | Cloud | Server / DC |
| --- | --- | --- |
| API base | `/rest/api/3` | `/rest/api/2` |
| Issue search | `/search/jql` | `/search` |
| Pagination | token-based (`nextPageToken`), **no total count** | classic `startAt` / `total` |

Cloud removed the old `/search` endpoint in 2025; `/search/jql` replaces it with
token-based pagination and no result total — which is why the Issues tab shows "more
available" rather than "n of N" on Cloud. Agile endpoints (`/rest/agile/1.0`) are the same
on both.

## Security notes

- With **Remember on this device** checked, your token sits **unencrypted in
  `localStorage`**, readable by any JavaScript running on the origin. Use a scoped API
  token you can revoke, and don't check the box on shared machines.
- The dev proxy relays to **any URL the browser supplies** via `x-jira-base-url`, so it
  only serves callers whose `Host` is `localhost` (defeating DNS-rebinding and `--host`
  LAN access). Keep the dev server on localhost regardless; don't expose it to your network
  or the internet.
- Everything is read-only: the API Explorer catalog contains only GET endpoints, **and the
  proxy itself refuses anything but GET/HEAD** — the guarantee holds at the relay, not just
  in the client.

## Project structure

```
vite.config.ts            React plugin + the /jira-proxy middleware (dev & preview)
src/
  lib/jiraClient.ts       auth headers, proxy routing, pagination (both API flavors)
  lib/endpoints.ts        the API Explorer catalog: 80+ GET endpoints with param specs
  lib/{storage,export,adf,format}.ts  persistence, CSV/JSON export, ADF→text, dates
  components/             ConnectionForm, IssuesPanel, ProjectsPanel, ApiExplorer,
                          IssueDetail, StatusChip
docs/                     developer documentation (see below)
```

## Documentation

Developer docs live in [`docs/`](./docs/):

| Doc | What's in it |
| --- | --- |
| [FUNCTIONALITY.md](./docs/FUNCTIONALITY.md) | Every feature, control, and behavior — the complete reference, incl. the `JiraClient` API surface and the 86-endpoint catalog |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | How it's wired: module map, request lifecycle, the proxy design, state model, and how to extend it |
| [INTEGRATION.md](./docs/INTEGRATION.md) | The `/jira-proxy` HTTP contract for other tools/agents that pull Atlassian data **through** the bridge (incl. the Confluence relay path) |

**Consuming the bridge from another project:** a sibling companion project,
[`../bridge-consumer`](../bridge-consumer/), is wired to fetch all its Jira/Confluence data
through this bridge — a small TypeScript helper plus a `CLAUDE.md` that tells an agent to
route Atlassian data needs here. See [INTEGRATION.md](./docs/INTEGRATION.md).

One repo quirk: the **root** `.gitignore` ignores `package.json`/`package-lock.json`
(the comic reader is deliberately dependency-free), so this directory's `.gitignore`
re-includes them with `!` negations. Don't remove those lines or the manifests silently
drop out of git.

## Limitations

- **Read-only.** No creating, editing, or transitioning issues — by design.
- **Load all caps at 500 issues.** Refine your JQL for bigger result sets, or export in
  slices.
- **The proxy is required in production.** Static hosting of `dist/` alone won't connect
  to anything; see [The CORS proxy](#the-cors-proxy).
