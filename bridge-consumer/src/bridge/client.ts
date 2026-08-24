import type { BridgeConfig, Deployment } from './config'

export interface BridgeResponse<T = unknown> {
  status: number
  ok: boolean
  /** Parsed JSON body, or null when the response wasn't JSON / was empty. */
  data: T | null
  /** Raw response text (useful when data is null). */
  text: string
}

/** Thrown when the bridge proxy itself can't be reached — usually because it isn't running. */
export class BridgeUnreachableError extends Error {
  constructor(url: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    super(
      `Could not reach the Jira Data Bridge at ${url} (${detail}). ` +
        'Start it with: cd ../jira-data-bridge && npm run dev',
    )
    this.name = 'BridgeUnreachableError'
  }
}

type QueryInput = string | Record<string, string | number | boolean | undefined> | undefined

export interface SearchOptions {
  maxResults?: number
  fields?: string
  /** Cloud only: page token from a previous /search/jql response. */
  nextPageToken?: string
  /** Server/DC only: page offset for classic /search. */
  startAt?: number
}

export interface BridgeClient {
  /** Low-level GET of a site-relative path (e.g. '/rest/api/3/myself') through the proxy. */
  get<T = unknown>(sitePath: string, query?: QueryInput): Promise<BridgeResponse<T>>
  /** Jira REST GET: apiPath is relative to /rest/api/<version>, e.g. '/issue/PROJ-123'. */
  jira<T = unknown>(apiPath: string, query?: QueryInput): Promise<BridgeResponse<T>>
  /** Confluence REST GET: apiPath is relative to /wiki/rest/api, e.g. '/space' or '/content/123'. */
  confluence<T = unknown>(apiPath: string, query?: QueryInput): Promise<BridgeResponse<T>>
  /** The connected user (GET /rest/api/<version>/myself). */
  myself<T = unknown>(): Promise<BridgeResponse<T>>
  /** Run a JQL search — Cloud uses /search/jql (token pagination), Server/DC uses classic /search. */
  searchIssues<T = unknown>(jql: string, opts?: SearchOptions): Promise<BridgeResponse<T>>
}

function apiVersion(deployment: Deployment): '3' | '2' {
  return deployment === 'cloud' ? '3' : '2'
}

function authHeader(config: BridgeConfig): string {
  if (config.deployment === 'cloud') {
    // Cloud uses HTTP Basic with the account email and an API token.
    return `Basic ${Buffer.from(`${config.email}:${config.token}`).toString('base64')}`
  }
  return `Bearer ${config.token}`
}

function buildQuery(query: QueryInput): string {
  if (!query) return ''
  if (typeof query === 'string') {
    const trimmed = query.replace(/^[?&]+/, '')
    return trimmed === '' ? '' : `?${trimmed}`
  }
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value))
  }
  const s = params.toString()
  return s === '' ? '' : `?${s}`
}

function withLeadingSlash(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

/**
 * A read-only Atlassian client that talks to the running Jira Data Bridge proxy
 * instead of calling Atlassian directly. It sends the same three headers the
 * bridge's browser client sends (accept, authorization, x-jira-base-url), so all
 * auth and CORS handling stays in one place.
 */
export function createBridgeClient(config: BridgeConfig): BridgeClient {
  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: authHeader(config),
    'x-jira-base-url': config.site,
  }
  const version = apiVersion(config.deployment)

  async function get<T = unknown>(sitePath: string, query?: QueryInput): Promise<BridgeResponse<T>> {
    const url = `${config.bridgeUrl}${withLeadingSlash(sitePath)}${buildQuery(query)}`
    let res: Response
    try {
      res = await fetch(url, { method: 'GET', headers })
    } catch (cause) {
      throw new BridgeUnreachableError(config.bridgeUrl, cause)
    }
    const text = await res.text()
    let data: T | null = null
    try {
      data = text ? (JSON.parse(text) as T) : null
    } catch {
      data = null
    }
    return { status: res.status, ok: res.ok, data, text }
  }

  return {
    get,
    jira<T = unknown>(apiPath: string, query?: QueryInput) {
      return get<T>(`/rest/api/${version}${withLeadingSlash(apiPath)}`, query)
    },
    confluence<T = unknown>(apiPath: string, query?: QueryInput) {
      return get<T>(`/wiki/rest/api${withLeadingSlash(apiPath)}`, query)
    },
    myself<T = unknown>() {
      return get<T>(`/rest/api/${version}/myself`)
    },
    searchIssues<T = unknown>(jql: string, opts: SearchOptions = {}) {
      const fields = opts.fields ?? 'summary,status,assignee,updated'
      const maxResults = opts.maxResults ?? 50
      if (config.deployment === 'cloud') {
        return get<T>('/rest/api/3/search/jql', {
          jql,
          maxResults,
          fields,
          nextPageToken: opts.nextPageToken,
        })
      }
      return get<T>('/rest/api/2/search', {
        jql,
        maxResults,
        fields,
        startAt: opts.startAt ?? 0,
      })
    },
  }
}
