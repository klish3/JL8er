import { useEffect, useState } from 'react'
import type { JiraClient } from '../lib/jiraClient'
import { ENDPOINT_GROUPS, JIRA_ENDPOINTS } from '../lib/endpoints'
import { downloadFile } from '../lib/export'

interface RawResult {
  status: number
  ok: boolean
  text: string
  body: unknown
}

/** Clipboard fallback for non-secure origins where navigator.clipboard is absent. */
function legacyCopy(text: string): boolean {
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}

/** Renders a path template with the remaining {placeholders} highlighted. */
function PathTemplate({ template }: { template: string }) {
  return (
    <code className="endpoint-path">
      {template.split(/(\{[^}]+\})/g).map((part, index) =>
        part.startsWith('{') && part.endsWith('}') ? (
          <span key={index} className="path-placeholder">
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </code>
  )
}

export function ApiExplorer({ client }: { client: JiraClient }) {
  const [selectedId, setSelectedId] = useState('')
  const [pathValues, setPathValues] = useState<Record<string, string>>({})
  const [queryValues, setQueryValues] = useState<Record<string, string>>({})
  const [extraQuery, setExtraQuery] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<RawResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timer)
  }, [copied])

  const endpoint = JIRA_ENDPOINTS.find((e) => e.id === selectedId)
  const isServer = client.apiVersion === '2'

  const selectEndpoint = (id: string) => {
    setSelectedId(id)
    setPathValues({})
    setQueryValues({})
    setExtraQuery('')
    setResult(null)
    setError(null)
  }

  const resolvedTemplate = endpoint
    ? endpoint.path.replace(/\{apiVersion\}/g, client.apiVersion)
    : ''

  const missing = endpoint
    ? (endpoint.pathParams ?? [])
        .filter((p) => (pathValues[p.name] ?? '').trim() === '')
        .map((p) => p.name)
    : []

  const sendRequest = async () => {
    if (!endpoint || missing.length > 0) return
    let path = resolvedTemplate
    for (const param of endpoint.pathParams ?? []) {
      path = path.replace(
        `{${param.name}}`,
        encodeURIComponent((pathValues[param.name] ?? '').trim()),
      )
    }
    const parts: string[] = []
    for (const param of endpoint.queryParams ?? []) {
      const value = (queryValues[param.name] ?? '').trim()
      if (value !== '') {
        parts.push(`${encodeURIComponent(param.name)}=${encodeURIComponent(value)}`)
      }
    }
    const extra = extraQuery.trim().replace(/^[?&]+/, '')
    if (extra !== '') parts.push(extra)
    const query = parts.join('&')

    setSending(true)
    setError(null)
    setResult(null)
    try {
      const response = await client.rawGet(path, query === '' ? undefined : query)
      setResult(response)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  const resultText =
    result === null
      ? ''
      : result.body === undefined
        ? result.text
        : JSON.stringify(result.body, null, 2)

  const copyResult = () => {
    // navigator.clipboard is undefined on non-secure origins (e.g. a LAN http
    // dev server); fall back to a hidden textarea so the button still works.
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(resultText)
        .then(() => setCopied(true))
        .catch(() => legacyCopy(resultText) && setCopied(true))
      return
    }
    if (legacyCopy(resultText)) setCopied(true)
  }

  const downloadResult = () => {
    // Non-JSON responses (HTML error pages, plain text) shouldn't claim .json.
    const isJson = result?.body !== undefined
    const ext = isJson ? 'json' : 'txt'
    const mime = isJson ? 'application/json' : 'text/plain;charset=utf-8'
    const name = endpoint ? `jira-${endpoint.id}.${ext}` : `jira-response.${ext}`
    downloadFile(name, resultText, mime)
  }

  return (
    <div className="panel">
      <p className="explorer-hint">
        This tab issues read-only GET requests with your connected credentials.
        {isServer
          ? ' Cloud-only endpoints are disabled for this Server / Data Center connection.'
          : ' Server / Data Center–only endpoints are disabled for this Cloud connection.'}
      </p>

      <div className="field">
        <label className="field-label" htmlFor="explorer-endpoint">
          Endpoint
        </label>
        <select
          id="explorer-endpoint"
          className="input select"
          value={selectedId}
          onChange={(e) => selectEndpoint(e.target.value)}
        >
          <option value="">Select an endpoint…</option>
          {ENDPOINT_GROUPS.map((group) => (
            <optgroup key={group} label={group}>
              {JIRA_ENDPOINTS.filter((e) => e.group === group).map((e) => (
                <option
                  key={e.id}
                  value={e.id}
                  disabled={(e.cloudOnly === true && isServer) || (e.serverOnly === true && !isServer)}
                >
                  {e.label}
                  {e.cloudOnly ? ' (Cloud only)' : ''}
                  {e.serverOnly ? ' (Server only)' : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {endpoint && (
        <form
          className="card endpoint-card"
          onSubmit={(e) => {
            e.preventDefault()
            if (!sending) void sendRequest()
          }}
        >
          <p className="endpoint-desc">{endpoint.description}</p>
          <PathTemplate template={resolvedTemplate} />

          {(endpoint.pathParams ?? []).length > 0 && (
            <section className="params-section">
              <h3 className="params-title">Path parameters</h3>
              <div className="params-grid">
                {(endpoint.pathParams ?? []).map((param) => (
                  <div className="field" key={param.name}>
                    <label className="field-label" htmlFor={`path-param-${param.name}`}>
                      {param.name} <span className="field-flag">required</span>
                    </label>
                    <input
                      id={`path-param-${param.name}`}
                      className="input"
                      value={pathValues[param.name] ?? ''}
                      placeholder={param.example}
                      spellCheck={false}
                      onChange={(e) =>
                        setPathValues((prev) => ({ ...prev, [param.name]: e.target.value }))
                      }
                    />
                    {param.description !== undefined && (
                      <p className="field-hint">{param.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="params-section">
            <h3 className="params-title">Query parameters</h3>
            <div className="params-grid">
              {(endpoint.queryParams ?? []).map((param) => (
                <div className="field" key={param.name}>
                  <label className="field-label" htmlFor={`query-param-${param.name}`}>
                    {param.name} <span className="field-flag">optional</span>
                  </label>
                  <input
                    id={`query-param-${param.name}`}
                    className="input"
                    value={queryValues[param.name] ?? ''}
                    placeholder={param.example}
                    spellCheck={false}
                    onChange={(e) =>
                      setQueryValues((prev) => ({ ...prev, [param.name]: e.target.value }))
                    }
                  />
                  {param.description !== undefined && (
                    <p className="field-hint">{param.description}</p>
                  )}
                </div>
              ))}
              <div className="field">
                <label className="field-label" htmlFor="extra-query">
                  Extra query string <span className="field-flag">optional</span>
                </label>
                <input
                  id="extra-query"
                  className="input"
                  value={extraQuery}
                  placeholder="expand=names&fields=summary"
                  spellCheck={false}
                  onChange={(e) => setExtraQuery(e.target.value)}
                />
                <p className="field-hint">Appended verbatim to the query string.</p>
              </div>
            </div>
          </section>

          <div className="send-row">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={sending || missing.length > 0}
              title={
                missing.length > 0
                  ? `Fill required path parameter${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`
                  : undefined
              }
            >
              {sending ? 'Sending…' : 'Send request'}
            </button>
            {missing.length > 0 && (
              <span className="send-hint">Fill {missing.join(', ')} to send</span>
            )}
          </div>
        </form>
      )}

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      {result && (
        <div className="result">
          <div className="result-head">
            <span className={`status-badge ${result.ok ? 'ok' : 'err'}`}>HTTP {result.status}</span>
            <div className="result-actions">
              <button type="button" className="btn" onClick={copyResult}>
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button type="button" className="btn" onClick={downloadResult}>
                Download
              </button>
            </div>
          </div>
          <pre className="json-viewer">{resultText !== '' ? resultText : '(empty response body)'}</pre>
        </div>
      )}
    </div>
  )
}
