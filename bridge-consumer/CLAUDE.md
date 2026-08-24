# bridge-consumer

This project pulls Jira and Confluence data **only through the Jira Data Bridge**
(`../jira-data-bridge`). It never calls the Atlassian REST API directly and holds no
Atlassian credentials of its own beyond a local, git-ignored `.env`.

## Rule for Claude

Whenever a task in this project needs data from **Jira** or **Confluence** — issues, JQL
results, projects, boards/sprints/epics, users, fields, Confluence pages or spaces, and so
on — do **not** hand-roll HTTP requests or Atlassian auth. Route the request through the
bridge helper in `src/bridge/`.

Triggers (non-exhaustive): "get the issues in…", "what's the status of PROJ-123", "pull the
sprint", "read the Confluence page…", "list the projects", "export the issues", or any
mention of Jira / Confluence / Atlassian data.

## The action (runbook)

1. **Make sure the bridge is running.** Its proxy only exists while its dev (or preview)
   server is up:
   ```bash
   cd ../jira-data-bridge && npm install && npm run dev
   # proxy now at http://localhost:5173/jira-proxy
   ```
   If a call throws `BridgeUnreachableError`, the bridge is down — start it.

2. **Make sure `.env` is configured** (copy `.env.example`):
   `BRIDGE_URL`, `ATLASSIAN_SITE`, `ATLASSIAN_DEPLOYMENT`, `ATLASSIAN_EMAIL` (Cloud only),
   `ATLASSIAN_TOKEN`.

3. **Use the helper** — every method returns `{ status, ok, data, text }` and never throws
   on a non-2xx (only if the bridge itself is unreachable):
   ```ts
   import { createBridgeClient, loadBridgeConfig } from './bridge'

   const bridge = createBridgeClient(loadBridgeConfig())

   const me     = await bridge.myself()
   const issues = await bridge.searchIssues('project = PROJ ORDER BY updated DESC', { maxResults: 20 })
   const issue  = await bridge.jira('/issue/PROJ-123')                 // any Jira REST GET
   const page   = await bridge.confluence('/content/12345', { expand: 'body.storage' })
   ```

4. **Run it**: `npm run example` (Jira + Confluence demo) or `npm start` (readiness check).

## Constraints (enforced by the bridge, not just convention)

- **Read-only.** The proxy relays `GET`/`HEAD` only — anything else is refused (`405`). Do
  not try to create, edit, or transition issues through it.
- **Localhost only.** The proxy rejects non-loopback `Host` headers (`403`), so call it from
  this machine. Don't expose it to the network.
- **Confluence is the same client.** Use `bridge.confluence(path)`. Confluence Cloud REST
  lives at `/wiki/rest/api/...` on the same site with the same Cloud token, so it goes
  through the same relay unchanged. (The bridge has no Confluence UI yet — this is the relay
  path. Server/DC Confluence uses a different base URL; confirm your instance.)

## Where things are

- Helper: `src/bridge/` — `client.ts` (`createBridgeClient`), `config.ts` (`loadBridgeConfig`),
  `index.ts` (re-exports).
- The bridge itself and its full HTTP contract: `../jira-data-bridge/` and
  **`../jira-data-bridge/docs/INTEGRATION.md`**.

Do not add a second path to Atlassian. If the bridge doesn't cover something you need,
extend the helper here, or add the endpoint to the catalog in
`../jira-data-bridge/src/lib/endpoints.ts`.
