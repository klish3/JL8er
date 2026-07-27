import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ConnectionConfig, Deployment } from '../types'

export function ConnectionForm({
  onConnect,
}: {
  onConnect: (config: ConnectionConfig) => Promise<void>
}) {
  const [deployment, setDeployment] = useState<Deployment>('cloud')
  const [siteUrl, setSiteUrl] = useState('')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [remember, setRemember] = useState(true)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCloud = deployment === 'cloud'

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setUrlError(null)

    let candidate = siteUrl.trim()
    if (candidate !== '' && !candidate.includes('://')) {
      candidate = `https://${candidate}`
    }
    let baseUrl: string
    try {
      const parsed = new URL(candidate)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error('unsupported protocol')
      }
      // Keep any context path (Server/DC often lives under e.g. /jira), drop query/hash.
      baseUrl = parsed.origin + parsed.pathname.replace(/\/+$/, '')
    } catch {
      setUrlError('Enter a valid site URL, e.g. https://your-site.atlassian.net')
      return
    }

    setConnecting(true)
    try {
      await onConnect({
        baseUrl,
        deployment,
        email: isCloud ? email.trim() : '',
        apiToken: token,
        remember,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setConnecting(false)
    }
  }

  return (
    <form className="card connect-card" onSubmit={handleSubmit}>
      <h1 className="card-title">Connect to Jira</h1>
      <p className="card-subtitle">Query issues, browse projects, and explore the REST API.</p>

      <div className="segmented" role="group" aria-label="Deployment type">
        <button
          type="button"
          className={isCloud ? 'segment active' : 'segment'}
          aria-pressed={isCloud}
          onClick={() => setDeployment('cloud')}
        >
          Cloud
        </button>
        <button
          type="button"
          className={isCloud ? 'segment' : 'segment active'}
          aria-pressed={!isCloud}
          onClick={() => setDeployment('server')}
        >
          Server / Data Center
        </button>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="conn-site-url">
          Site URL
        </label>
        <input
          id="conn-site-url"
          className="input"
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          placeholder={isCloud ? 'your-site.atlassian.net' : 'https://jira.your-company.com'}
          autoComplete="url"
          spellCheck={false}
          required
        />
        {urlError && <p className="field-error">{urlError}</p>}
      </div>

      {isCloud && (
        <div className="field">
          <label className="field-label" htmlFor="conn-email">
            Account email
          </label>
          <input
            id="conn-email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>
      )}

      <div className="field">
        <label className="field-label" htmlFor="conn-token">
          {isCloud ? 'API token' : 'Personal access token'}
        </label>
        <input
          id="conn-token"
          className="input"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          autoComplete="off"
          required
        />
        <p className="field-hint">
          {isCloud ? (
            <>
              Create one at{' '}
              <a
                href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank"
                rel="noreferrer"
              >
                id.atlassian.com
              </a>
              .
            </>
          ) : (
            'Create one in Jira under Profile → Personal Access Tokens.'
          )}
        </p>
      </div>

      <label className="check-row">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        <span>
          Remember on this device
          <span className="check-note"> — the token is stored unencrypted in localStorage</span>
        </span>
      </label>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primary btn-block" disabled={connecting}>
          {connecting ? 'Connecting…' : 'Connect'}
        </button>
      </div>
    </form>
  )
}
