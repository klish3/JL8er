import type {
  ConnectionConfig,
  JiraIssue,
  JiraProject,
  JiraUser,
  SearchCursor,
  SearchPage,
} from '../types'

const SEARCH_FIELDS =
  'summary,status,issuetype,priority,assignee,reporter,created,updated,labels,project'

export class JiraError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'JiraError'
    this.status = status
  }
}

// btoa throws on characters outside Latin-1 (e.g. unicode in an email or
// token), so build the Basic credential from UTF-8 bytes instead.
function base64(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function extractJiraError(body: unknown): string {
  if (typeof body !== 'object' || body === null) return ''
  const record = body as Record<string, unknown>
  const parts: string[] = []
  if (Array.isArray(record.errorMessages)) {
    for (const item of record.errorMessages) {
      if (typeof item === 'string' && item) parts.push(item)
    }
  }
  if (typeof record.errors === 'object' && record.errors !== null) {
    for (const [field, value] of Object.entries(record.errors)) {
      if (typeof value === 'string' && value) parts.push(`${field}: ${value}`)
    }
  }
  if (parts.length === 0 && typeof record.message === 'string' && record.message) {
    parts.push(record.message)
  }
  return parts.join(' ')
}

function fallbackMessage(status: number): string {
  switch (status) {
    case 401:
      return 'Authentication failed (401). Check your email and API token.'
    case 403:
      return 'Access denied (403). Your account is not allowed to perform this request.'
    case 404:
      return 'Not found (404). Check the site URL and deployment type.'
    default:
      return `Jira responded with HTTP ${status}.`
  }
}

const NETWORK_ERROR_MESSAGE =
  'Could not reach the /jira-proxy middleware. Run the app through the Vite dev or preview server, which hosts the proxy.'

export class JiraClient {
  private readonly config: ConnectionConfig

  constructor(config: ConnectionConfig) {
    this.config = config
  }

  get baseUrl(): string {
    return this.config.baseUrl.replace(/\/+$/, '')
  }

  get apiVersion(): '3' | '2' {
    return this.config.deployment === 'cloud' ? '3' : '2'
  }

  getMyself(): Promise<JiraUser> {
    return this.request<JiraUser>('/myself')
  }

  async listProjects(): Promise<JiraProject[]> {
    if (this.config.deployment === 'server') {
      return this.request<JiraProject[]>('/project', { expand: 'lead' })
    }
    const projects: JiraProject[] = []
    let startAt = 0
    for (let page = 0; page < 20; page++) {
      const result = await this.request<{ values?: JiraProject[]; isLast?: boolean }>(
        '/project/search',
        { startAt, maxResults: 50, expand: 'lead' },
      )
      const values = result.values ?? []
      projects.push(...values)
      if (result.isLast !== false || values.length === 0) break
      startAt += values.length
    }
    return projects
  }

  async searchIssues(
    jql: string,
    cursor?: SearchCursor,
    maxResults = 50,
  ): Promise<SearchPage> {
    if (this.config.deployment === 'cloud') {
      // The legacy Cloud /search endpoint was removed in 2025; /search/jql is
      // token-paginated and does not report a total.
      const result = await this.request<{
        issues?: JiraIssue[]
        nextPageToken?: string
        isLast?: boolean
      }>('/search/jql', {
        jql,
        maxResults,
        fields: SEARCH_FIELDS,
        nextPageToken: cursor?.pageToken,
      })
      const issues = result.issues ?? []
      return {
        issues,
        isLast: result.isLast ?? !result.nextPageToken,
        next: result.nextPageToken ? { pageToken: result.nextPageToken } : undefined,
      }
    }

    const startAt = cursor?.startAt ?? 0
    const result = await this.request<{ issues?: JiraIssue[]; total?: number }>('/search', {
      jql,
      startAt,
      maxResults,
      fields: SEARCH_FIELDS,
    })
    const issues = result.issues ?? []
    const isLast =
      issues.length === 0 ||
      result.total === undefined ||
      startAt + issues.length >= result.total
    return {
      issues,
      total: result.total,
      isLast,
      next: isLast ? undefined : { startAt: startAt + issues.length },
    }
  }

  getIssue(key: string): Promise<JiraIssue> {
    return this.request<JiraIssue>(`/issue/${encodeURIComponent(key)}`, {
      fields: `${SEARCH_FIELDS},description`,
    })
  }

  browseUrl(key: string): string {
    return `${this.baseUrl}/browse/${key}`
  }

  async rawGet(
    sitePath: string,
    query?: string,
  ): Promise<{ status: number; ok: boolean; text: string; body: unknown }> {
    let url = '/jira-proxy' + sitePath
    const trimmedQuery = (query ?? '').replace(/^[?&]+/, '')
    if (trimmedQuery) {
      url += (url.includes('?') ? '&' : '?') + trimmedQuery
    }

    let response: Response
    try {
      response = await fetch(url, { headers: this.headers() })
    } catch {
      throw new JiraError(0, NETWORK_ERROR_MESSAGE)
    }

    const text = await response.text()
    // `undefined` marks a non-JSON body so callers can fall back to the raw text.
    let body: unknown
    try {
      body = text ? JSON.parse(text) : undefined
    } catch {
      body = undefined
    }
    return { status: response.status, ok: response.ok, text, body }
  }

  private headers(): Record<string, string> {
    const auth =
      this.config.deployment === 'cloud'
        ? 'Basic ' + base64(`${this.config.email}:${this.config.apiToken}`)
        : 'Bearer ' + this.config.apiToken
    return {
      Accept: 'application/json',
      Authorization: auth,
      'x-jira-base-url': this.baseUrl,
    }
  }

  private async request<T>(
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<T> {
    const search = new URLSearchParams()
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === '') continue
        search.set(key, String(value))
      }
    }
    const queryString = search.toString()
    const url =
      '/jira-proxy/rest/api/' + this.apiVersion + path + (queryString ? `?${queryString}` : '')

    let response: Response
    try {
      response = await fetch(url, { headers: this.headers() })
    } catch {
      throw new JiraError(0, NETWORK_ERROR_MESSAGE)
    }

    if (!response.ok) {
      let detail = ''
      try {
        detail = extractJiraError(await response.json())
      } catch {
        // Non-JSON error body; use the status-specific fallback.
      }
      throw new JiraError(response.status, detail || fallbackMessage(response.status))
    }

    return (await response.json()) as T
  }
}
