# Jira Data Bridge — Functionality Reference

A complete tour of everything the app does, for a developer new to the codebase. It
pairs with [ARCHITECTURE.md](./ARCHITECTURE.md) (how it's wired) and
[INTEGRATION.md](./INTEGRATION.md) (how other tools pull data through the same proxy).

## Overview

Jira Data Bridge is a self-contained **React 19 + TypeScript + Vite 6** single-page app
for pulling data **out** of Jira. You enter a site URL and a token in the UI, and the app
lets you run JQL, browse projects, inspect single issues, and hit any of **86 read-only
REST endpoints**. Everything runs in the browser; there is no backend except the Vite
dev/preview **CORS proxy** (`/jira-proxy`) that relays requests to your Jira site — browsers
can't call Jira's REST API cross-origin.

The whole app is **read-only by design**: the endpoint catalog contains only GET
endpoints, and the proxy itself refuses anything but GET/HEAD, so the guarantee holds at
the relay and not just in the client.

Entry point: `src/main.tsx` renders `<App />` inside React `StrictMode`. `App.tsx` owns
the session and tab state; the three tab panels and the connect form live under
`src/components/`; all Jira/HTTP/data logic lives under `src/lib/`.

## Connecting

Connection is handled by `ConnectionForm.tsx` and the `connect` callback in `App.tsx`.
`connect` constructs a `JiraClient`, calls `client.getMyself()` to verify the credentials,
then (if the myself call succeeds) persists the config and stores the session.

### Deployment types and auth

A segmented toggle selects the deployment. The auth scheme and API version follow from it
(`JiraClient.headers()` and the `apiVersion` getter):

| Deployment | Credentials entered | `Authorization` header | API version |
| --- | --- | --- | --- |
| **Cloud** | account email + API token | `Basic base64(email:token)` | `3` (`/rest/api/3`) |
| **Server / Data Center** | personal access token only | `Bearer <token>` | `2` (`/rest/api/2`) |

- For Cloud, the form shows an **Account email** field; for Server/DC it's hidden and the
  stored `email` is `''`.
- The token field is a password input labelled **API token** (Cloud) or **Personal access
  token** (Server/DC), with an inline link to
  `id.atlassian.com` for Cloud tokens or "Profile → Personal Access Tokens" for Server/DC.
- The Basic credential is base64-encoded from **UTF-8 bytes** (`base64()` in
  `jiraClient.ts`), not `btoa` directly, so a unicode email or token doesn't throw.

### Where tokens come from

- **Cloud API token:** `id.atlassian.com/manage-profile/security/api-tokens` → Security →
  API tokens.
- **Server/DC personal access token:** created in Jira under your profile → Personal Access
  Tokens.

### Site URL handling

`ConnectionForm.handleSubmit` normalizes the URL before connecting:

- If you omit a scheme, `https://` is prepended.
- The URL must parse and use `http:`/`https:`, else the form shows
  *"Enter a valid site URL, e.g. https://your-site.atlassian.net"*.
- Only `origin + pathname` is kept (trailing slashes stripped, query/hash dropped), so a
  Server/DC context path such as `https://host/jira` is preserved.

### Persistence and its caveats

Persistence lives in `storage.ts` (key `jira-data-bridge:connection`) and is **opt-in** via
the **"Remember on this device"** checkbox (checked by default in the form):

- `saveConnection` writes the full config to `localStorage` **only** when `remember` is
  true; otherwise it removes any stored entry. It is best-effort — wrapped in try/catch so
  private-mode / blocked storage fails silently.
- The token is stored **unencrypted**. The form spells this out inline: *"the token is
  stored unencrypted in localStorage"*.
- `loadConnection` validates the stored shape (`baseUrl`/`email`/`apiToken` strings,
  `deployment` is `'cloud'`/`'server'`) **and re-validates `baseUrl` as http/https** on
  every load — a tampered `baseUrl` is not trusted just because it round-tripped through
  storage, since auto-connect will send the stored token to that host.
- On startup, `App` auto-connects from a saved config. If Jira **actively rejects** the
  credentials (`JiraError` with status **401 or 403**) the stored config is wiped; a
  transient failure (network, VPN, proxy 502) **keeps** it so a reload can succeed.
- **Disconnect** (`disconnect` in `App`) clears storage, drops the session, resets to the
  Issues tab, and clears any pending preset.

## The three tabs

`App` renders all three panels at once and toggles them with the `hidden` attribute, so
each tab keeps its state when you switch away (see ARCHITECTURE.md for why). Nav is a row
of `<button>`s; the active tab gets the `active` class.

### Issues (`IssuesPanel.tsx`)

A JQL search box over a paginated results table.

- **Default query:** `ORDER BY updated DESC` (`DEFAULT_JQL`). The panel **auto-runs a search
  on mount** — either the default or, if a preset is already pending at mount, the preset's
  JQL.
- **Search:** submitting the form calls `runSearch(jql)` → `client.searchIssues(query)`.
- **Results table columns:** Key, Summary, Type, Status (rendered by `StatusChip`),
  Priority, Assignee (or "Unassigned"), Updated (via `formatDate`). Clicking a row opens the
  `IssueDetail` modal for that key.
- **Count label:** `"{n} issues loaded"`, plus `" of {total}"` when a total is known
  (Server/DC), or `" (more available)"` when there's a next cursor but no total (Cloud).
- **Load more:** visible when a `next` cursor exists; appends the next page via
  `client.searchIssues(executed, next)`.
- **Load all:** visible while `next` exists **and** fewer than **`LOAD_ALL_CAP` = 500**
  issues are loaded (it disappears once the cap is reached). It loops `searchIssues`,
  bounded by three conditions: cursor still live, `count < 500`, and **`pages <
  LOAD_ALL_MAX_PAGES` = 40** requests per click. It **breaks on an empty page** — Cloud's
  `/search/jql` can return an empty page that still carries a next token, so the loop stops
  rather than spinning (the cursor stays live, so Load more remains usable).
- **Export CSV / Export JSON:** exports **everything currently loaded** (not the whole
  result set). Files are named `jira-issues-<YYYY-MM-DD>.csv` / `.json`. CSV goes through
  `toCsv(issues.map(flattenIssue))`; JSON is `JSON.stringify(issues, null, 2)`. Both buttons
  disable when zero issues are loaded.
- **Empty state:** *"No issues match this JQL."* shows only after a search has actually
  executed and returned nothing.

**Edge behaviors worth knowing:**

- **`seqRef` staleness guard** — a monotonic `useRef` counter is incremented at the start of
  every search / load. Each async handler captures its id and bails (`if (seqRef.current !==
  id) return`) before touching state, so a slow earlier response can never clobber a newer
  one.
- **`executedJqlRef`** — pagination follows the *last successfully executed* query, not live
  input. Editing the JQL box mid-scroll doesn't corrupt Load more / Load all.
- **Preset flow** — `presetIdRef` records the last consumed preset id. The mount effect
  consumes a preset already present at mount so the preset effect below doesn't re-run it;
  the preset effect fires only for a *new* preset id. This is how Projects → "View issues"
  pushes a JQL in without double-searching.

### Projects (`ProjectsPanel.tsx`)

- **Load on mount:** calls `client.listProjects()`; a `reloadKey` state lets **Retry**
  re-run the effect after a failure.
- **Filter:** a client-side text box matches the query (case-insensitive) against project
  **key or name**.
- **Card grid:** each card shows the project **key badge**, an optional **`projectTypeKey`
  pill**, the name, an optional **Lead: {displayName}**, and a **"View issues →"** button.
- **View issues →** calls `onOpenIssues(project.key)`, which in `App` sets a preset
  (`project = "KEY" ORDER BY updated DESC`) and switches to the Issues tab.
- **States:** loading spinner, an **error notice with a Retry action**, an empty state
  (either "No projects match …" when filtered, or "No projects are visible to this
  account." otherwise), and a count `"{visible} of {total} projects"`.

### API Explorer (`ApiExplorer.tsx`)

A form over the endpoint catalog for issuing arbitrary read-only GETs.

- **Endpoint picker:** a grouped `<select>` built from `ENDPOINT_GROUPS` (optgroups) and
  `JIRA_ENDPOINTS`. Options tagged `cloudOnly`/`serverOnly` are **`disabled` for the wrong
  deployment** and labelled "(Cloud only)" / "(Server only)". The panel hint tells you which
  set is disabled for the current connection.
- **Path template:** the selected endpoint's `path` is shown with `{apiVersion}` already
  substituted (`resolvedTemplate`), remaining `{placeholders}` highlighted.
- **Auto-generated inputs:**
  - **Path parameters** — one required input each. The Send button is disabled and titled
    with the missing names until every path param is filled (`missing`). Values are
    **`encodeURIComponent`-escaped** into the path.
  - **Query parameters** — one optional input each; blank values are omitted.
  - **Extra query string** — a free-form field appended verbatim (leading `?`/`&` stripped).
- **Send:** builds the final path and query, then calls
  `client.rawGet(path, query)`. `rawGet` **never throws on a non-2xx status** — the panel
  shows whatever came back.
- **Response view:** an **HTTP status badge** (green `ok` / red `err`), then a `<pre>` of the
  **pretty-printed JSON** (`JSON.stringify(body, null, 2)`) or the **raw text** when the body
  wasn't JSON, or "(empty response body)".
- **Copy:** uses `navigator.clipboard.writeText`, falling back to a hidden-`<textarea>` +
  `document.execCommand('copy')` on non-secure origins (`legacyCopy`); shows "Copied" for
  1.5s.
- **Download:** `.json` (`application/json`) when the body parsed as JSON, else `.txt`
  (`text/plain`); named `jira-<endpoint-id>.<ext>`.

### Issue detail (`IssueDetail.tsx`)

A modal opened from an Issues row.

- Fetches `client.getIssue(key)` on open (this adds the `description` field to the search
  field set).
- **Close:** clicking the backdrop, the ✕ button, or pressing **Escape** (a `keydown`
  listener). Clicks inside the modal don't propagate to the backdrop.
- **Header:** the issue key is an external link to `client.browseUrl(key)`
  (`{baseUrl}/browse/{key}`), opening in a new tab.
- **Body:** a definition grid (Status via `StatusChip`, Type, Priority, Assignee, Reporter,
  Project as `"Name (KEY)"`, Created, Updated), **label pills**, and a **Description** section
  rendered through `descriptionToText` (ADF → plain text), or "No description."

## The endpoint catalog (`endpoints.ts`)

The catalog powering the API Explorer. Two exported types — `EndpointParam` and
`JiraEndpoint` — and two exported consts: `ENDPOINT_GROUPS` (ordered group labels) and
`JIRA_ENDPOINTS` (the entries). Every entry is a GET; there are **no mutating endpoints**.

Each `JiraEndpoint` carries: `id`, `group`, `label`, `path`, `description`, optional
`pathParams`/`queryParams` (each an `EndpointParam` with `name`, optional `example`,
`description`), and optional `cloudOnly` / `serverOnly` flags.

**Path tokens.** Core-API entries embed the literal token **`{apiVersion}`**, which the
explorer replaces with `3` (Cloud) or `2` (Server/DC) at render/send time. Agile (Jira
Software) entries use the **fixed** prefix **`/rest/agile/1.0`** — the same on both
deployments.

**The 86 endpoints across 13 groups:**

| Group (`ENDPOINT_GROUPS`) | Count | Examples |
| --- | --- | --- |
| Self & session | 3 | `get-myself`, `get-my-permissions` |
| Server & instance | 4 | `get-server-info`, `get-instance-license` *(Cloud only)* |
| Projects | 10 | `search-projects` *(Cloud only)*, `list-projects` |
| Issues | 15 | `get-issue`, `get-issue-changelog` *(Cloud only)* |
| Search (JQL) | 4 | `search-classic` *(Server only)*, `jql-autocomplete-data` |
| Users & groups | 7 | user/group lookups |
| Metadata & fields | 9 | fields, statuses, priorities |
| Filters & dashboards | 5 | filters, dashboards |
| Permissions & security | 4 | permission schemes / checks |
| Workflows & screens | 5 | workflows, screens |
| Versions & components | 3 | versions, components |
| Agile (Jira Software) | 11 | `get-board-backlog`, `list-board-sprints`, `get-sprint` |
| Audit & misc | 6 | audit records and assorted |

Nine entries are flagged `cloudOnly` and two `serverOnly`. The most important pair:
`search-classic` (`/search`, Server/DC only) vs. the Cloud `/search/jql` path used by the
Issues tab — Cloud removed the classic offset-paginated `/search` in 2025.

## The `JiraClient` API surface (`jiraClient.ts`)

A single class holding the `ConnectionConfig`. All requests go through the `/jira-proxy`
relay. `JiraError extends Error` and carries a numeric `status` (0 means the proxy itself
was unreachable).

**Getters**

| Member | Returns |
| --- | --- |
| `baseUrl` | `config.baseUrl` with trailing slashes stripped |
| `apiVersion` | `'3'` for Cloud, `'2'` for Server/DC |

**Methods**

| Method | Endpoint hit (via proxy) | Cloud vs Server/DC | Returns |
| --- | --- | --- | --- |
| `getMyself()` | `/rest/api/{v}/myself` | same call, version differs | `JiraUser` |
| `listProjects()` | Cloud: pages `/project/search` (up to **40 × 50 = 2000**, following `isLast`); Server: `GET /project?expand=lead` | different endpoints | `JiraProject[]` |
| `searchIssues(jql, cursor?, maxResults=50)` | Cloud: `GET /search/jql` (token pagination via `nextPageToken`, **no total**); Server: `GET /search` (`startAt`/`total`) | different endpoints & pagination | `SearchPage` |
| `getIssue(key)` | `GET /issue/{key}` with fields `SEARCH_FIELDS + ,description` | same call | `JiraIssue` |
| `browseUrl(key)` | — (string builder) | same | `"{baseUrl}/browse/{key}"` |
| `rawGet(sitePath, query?)` | `GET /jira-proxy{sitePath}` (any site-relative path) | caller supplies full path | `{ status, ok, text, body }` |

**Search fields.** `SEARCH_FIELDS =
'summary,status,issuetype,priority,assignee,reporter,created,updated,labels,project'`.
`getIssue` appends `,description`.

**`SearchPage` shaping.** `searchIssues` normalizes both API flavors into one `SearchPage`
(`issues`, optional `total`, `isLast`, optional `next` cursor). Cloud derives `isLast` from
`result.isLast ?? !nextPageToken` and never sets `total`; Server derives `isLast` from
`startAt + issues.length >= total` and sets `total`.

**Private helpers**

- `headers()` — builds `Accept`, the deployment-appropriate `Authorization`, and the
  **`x-jira-base-url`** header (the proxy reads this to know which site to relay to).
- `request<T>(path, params?)` — used by the typed methods. Serializes params (dropping
  `undefined`/`''`), builds `/jira-proxy/rest/api/{apiVersion}{path}?...`, fetches, and on a
  non-OK status throws a `JiraError`. Error message comes from `extractJiraError`
  (`errorMessages[]`, `errors{}`, or `message`) or a status-specific `fallbackMessage`:

  | Status | Fallback message |
  | --- | --- |
  | 401 | "Authentication failed (401). Check your email and API token." |
  | 403 | "Access denied (403). Your account is not allowed to perform this request." |
  | 404 | "Not found (404). Check the site URL and deployment type." |
  | other | "Jira responded with HTTP {status}." |

  A `fetch` rejection (proxy missing) throws `JiraError(0, …)` with a message telling you to
  run through the Vite dev/preview server.

**`rawGet` differs from `request`:** it prefixes the path with `/jira-proxy` **directly**
(the caller passes the full site-relative path, e.g. `/rest/api/3/...`), returns the
outcome for **any** status instead of throwing, and parses the body as JSON when possible
(`body: undefined` marks a non-JSON body). It only throws — as `JiraError(0, …)` — when the
proxy itself can't be reached.

## Utility libraries

| Module | Exports | What it does |
| --- | --- | --- |
| `storage.ts` | `loadConnection`, `saveConnection`, `clearConnection` | localStorage persistence under `jira-data-bridge:connection`; shape + URL re-validation on load; best-effort writes |
| `export.ts` | `flattenIssue`, `toCsv`, `downloadFile` | `flattenIssue` → a flat `Record<string,string>` (key, summary, type, status, priority, assignee, reporter, labels space-joined, project key, created, updated); `toCsv` → RFC-4180 CSV; `downloadFile` → blob-based download |
| `adf.ts` | `descriptionToText` | Atlassian Document Format node tree (Cloud) or plain string (Server) → plain text |
| `format.ts` | `formatDate` | ISO date → localized `"Mon D, YYYY"`; `"—"` for empty; echoes the raw string if unparseable |

**CSV safety (`escapeCsv` in `export.ts`).** Two guards:

- **Formula-injection guard** — a cell starting with `=`, `+`, `-`, `@`, tab, or CR is
  prefixed with a single quote so Excel/Sheets won't execute attacker-controlled Jira text
  (summaries, display names) as a formula.
- **RFC-4180 quoting** — cells containing `"`, `,`, CR, or LF are wrapped in quotes with
  embedded quotes doubled. Rows are joined with CRLF, and the file leads with a **UTF-8 BOM**
  so Excel on Windows detects the encoding instead of mojibake.

**ADF rendering (`descriptionToText`).** Returns the string as-is for Server/DC plain-text
descriptions. For Cloud's ADF node tree it walks recursively: `text` → its text,
`hardBreak` → newline, `mention`/`status` → `attrs.text`, `emoji` → `attrs.shortName`,
`inlineCard` → `attrs.url`, `rule` → `---`. Nodes in `BLOCK_TYPES` (paragraph, heading,
blockquote, codeBlock, listItem, tableRow, panel) append a trailing newline after their
children. Finally collapses 3+ newlines to 2 and trims.

## Cloud vs Server / Data Center — differences at a glance

| | Cloud | Server / Data Center |
| --- | --- | --- |
| Auth | `Basic base64(email:token)` | `Bearer <token>` |
| API base | `/rest/api/3` | `/rest/api/2` |
| Project list | paged `/project/search` (`isLast`) | `GET /project?expand=lead` |
| Issue search | `/search/jql`, token pagination, **no total** | `/search`, `startAt`/`total` |
| Issues count label | "(more available)" | "n of N" |
| Description format | ADF node tree | plain string |
| Agile API | `/rest/agile/1.0` (identical) | `/rest/agile/1.0` (identical) |
| Explorer gating | `serverOnly` options disabled | `cloudOnly` options disabled |

## Keyboard / UX niceties

- **Escape closes** the issue detail modal; the backdrop click closes it too, and inner
  clicks are stopped from bubbling.
- **Copy** in the API Explorer falls back to a legacy hidden-textarea copy on non-secure
  (http/LAN) origins where `navigator.clipboard` is undefined, and flashes "Copied" for
  1.5s.
- **Restore** state on startup shows a "Restoring saved connection…" spinner only when
  there's actually something stored to restore (lazy-initialized).
- **Workspace remount** is keyed on `session.config.baseUrl`, so switching sites resets all
  panel state cleanly.
- Inputs that hold identifiers/queries set `spellCheck={false}`; the token field is a
  password input with `autoComplete="off"`.
- **Load all** button carries a `title` explaining the 500-issue cap; the **Send** button
  in the explorer carries a `title` listing missing required params.

## Known limits

- **Read-only.** No create/edit/transition — the catalog is GET-only *and* the proxy
  refuses non-GET/HEAD.
- **Load all caps at 500 issues** (`LOAD_ALL_CAP`) and **40 requests per click**
  (`LOAD_ALL_MAX_PAGES`). Refine the JQL or export in slices for larger sets.
- **Exports cover only loaded issues**, not the entire result set.
- **The proxy is required in production.** The built `dist/` is not standalone — static
  hosting needs an equivalent `/jira-proxy` relay in front, or same-origin deployment next
  to Jira. `npm run preview` runs the proxy too.
- **Proxy is localhost-only and GET/HEAD-only** by design (non-loopback Host → 403, other
  methods → 405).
- **No Confluence UI** — though the same proxy + Cloud token can reach Confluence Cloud
  (`/wiki/rest/api/...`) via `rawGet`; see [INTEGRATION.md](./INTEGRATION.md).

## Commands and toolchain

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Vite dev server **+** the `/jira-proxy` relay |
| `npm run build` | `tsc -p tsconfig.app.json` + `tsc -p tsconfig.node.json` + `vite build` → `dist/` |
| `npm run preview` | Serves `dist/` **with** the proxy |
| `npm run typecheck` | Both tsconfigs, no emit |

Node 22 (`@types/node ^22`), TypeScript ~5.8 in **strict** mode with `noUnusedLocals`,
`noUnusedParameters`, `noFallthroughCasesInSwitch`, and `verbatimModuleSyntax`. React 19,
Vite 6.
