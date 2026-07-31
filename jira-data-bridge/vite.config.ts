import { defineConfig, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const PROXY_PREFIX = '/jira-proxy'

/**
 * Only requests whose Host is loopback are served. This runs ahead of Vite's
 * own host-check middleware, so without it the proxy would be reachable via
 * DNS rebinding (a page on attacker.com rebound to 127.0.0.1) or, under
 * `--host`, directly from the LAN — turning the relay into an SSRF vector.
 * The browser sets Host from the page origin and JS cannot forge it, so
 * pinning to localhost defeats both.
 */
function isLoopbackHost(hostHeader: string | undefined): boolean {
  if (!hostHeader) return false
  const host = hostHeader.startsWith('[')
    ? hostHeader.slice(1, hostHeader.indexOf(']')) // bracketed IPv6, e.g. [::1]:5173
    : hostHeader.split(':')[0]
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

/**
 * Browsers cannot call Jira's REST API directly because Jira does not send
 * CORS headers. This middleware runs inside the Vite dev/preview server and
 * forwards requests to the Jira site named in the `x-jira-base-url` header,
 * so the browser only ever talks to its own origin.
 */
const jiraProxyHandler: Connect.SimpleHandleFunction = (req, res) => {
  const sendJson = (status: number, payload: unknown): void => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(payload))
  }

  void (async () => {
    if (!isLoopbackHost(req.headers.host)) {
      sendJson(403, { errorMessages: ['jira-proxy only accepts requests from localhost.'] })
      return
    }

    // The app is a read-only data bridge; refuse anything that could mutate Jira
    // so the guarantee holds at the proxy, not just in the client's endpoint list.
    const method = (req.method ?? 'GET').toUpperCase()
    if (method !== 'GET' && method !== 'HEAD') {
      sendJson(405, { errorMessages: ['jira-proxy relays read-only GET/HEAD requests only.'] })
      return
    }

    const rawHeader = req.headers['x-jira-base-url']
    const baseHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader

    let base: URL
    try {
      base = new URL(baseHeader ?? '')
      if (base.protocol !== 'http:' && base.protocol !== 'https:') {
        throw new Error('unsupported protocol')
      }
    } catch {
      sendJson(400, { errorMessages: ['Invalid or missing x-jira-base-url header.'] })
      return
    }

    // Connect strips the mount prefix, so req.url is already the site-relative
    // path (e.g. /rest/api/3/myself). Preserve any path on the base URL
    // (e.g. https://host/jira) with trailing slashes stripped.
    const basePath = base.pathname.replace(/\/+$/, '')
    const target = base.origin + basePath + (req.url ?? '')

    const headers: Record<string, string> = { accept: 'application/json' }
    if (req.headers.authorization) headers.authorization = req.headers.authorization
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type']

    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const body = Buffer.concat(chunks)

    let upstream: Response
    try {
      upstream = await fetch(target, {
        method: req.method,
        headers,
        body: body.length > 0 ? body : undefined,
        redirect: 'manual',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      sendJson(502, { errorMessages: [`Could not reach ${base.origin}: ${message}`] })
      return
    }

    res.statusCode = upstream.status
    const contentType = upstream.headers.get('content-type')
    if (contentType) res.setHeader('content-type', contentType)
    res.end(Buffer.from(await upstream.arrayBuffer()))
  })().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    if (!res.headersSent) {
      sendJson(500, { errorMessages: [`Proxy error: ${message}`] })
    } else {
      res.end()
    }
  })
}

function jiraProxyPlugin(): Plugin {
  return {
    name: 'jira-data-bridge-proxy',
    configureServer(server) {
      server.middlewares.use(PROXY_PREFIX, jiraProxyHandler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(PROXY_PREFIX, jiraProxyHandler)
    },
  }
}

export default defineConfig({
  plugins: [react(), jiraProxyPlugin()],
})
