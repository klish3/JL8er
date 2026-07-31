import { useCallback, useEffect, useState } from 'react'
import type { ConnectionConfig, JiraUser } from './types'
import { JiraClient, JiraError } from './lib/jiraClient'
import { clearConnection, loadConnection, saveConnection } from './lib/storage'
import { ApiExplorer } from './components/ApiExplorer'
import { ConnectionForm } from './components/ConnectionForm'
import { IssuesPanel } from './components/IssuesPanel'
import { ProjectsPanel } from './components/ProjectsPanel'

interface Session {
  client: JiraClient
  user: JiraUser
  config: ConnectionConfig
}

interface Preset {
  id: number
  jql: string
}

const TABS = [
  { id: 'issues', label: 'Issues' },
  { id: 'projects', label: 'Projects' },
  { id: 'explorer', label: 'API Explorer' },
] as const

type Tab = (typeof TABS)[number]['id']

function initials(displayName: string): string {
  return displayName
    .trim()
    .split(/\s+/)
    .filter((word) => word !== '')
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

function siteHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host
  } catch {
    return baseUrl
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  // Lazy init: only show the restoring state when there is something to restore.
  const [restoring, setRestoring] = useState<boolean>(() => loadConnection() !== null)
  const [tab, setTab] = useState<Tab>('issues')
  const [preset, setPreset] = useState<Preset | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)

  const connect = useCallback(async (config: ConnectionConfig) => {
    const client = new JiraClient(config)
    const user = await client.getMyself()
    saveConnection(config)
    setSession({ client, user, config })
  }, [])

  useEffect(() => {
    const saved = loadConnection()
    if (!saved) return
    let active = true
    connect(saved)
      .catch((err: unknown) => {
        // Only wipe stored credentials when Jira actively rejects them. A
        // transient failure (network, VPN, 502 from the proxy) must keep them
        // so a reload can succeed instead of forcing the user to re-enter.
        if (err instanceof JiraError && (err.status === 401 || err.status === 403)) {
          clearConnection()
        }
        if (active) {
          setRestoreError(
            err instanceof Error
              ? `Could not restore your saved connection: ${err.message}`
              : 'Could not restore your saved connection.',
          )
        }
      })
      .finally(() => {
        if (active) setRestoring(false)
      })
    return () => {
      active = false
    }
  }, [connect])

  const disconnect = useCallback(() => {
    clearConnection()
    setSession(null)
    setTab('issues')
    setPreset(null)
  }, [])

  const openProjectIssues = useCallback((projectKey: string) => {
    setPreset((prev) => ({
      id: (prev?.id ?? 0) + 1,
      jql: `project = "${projectKey}" ORDER BY updated DESC`,
    }))
    setTab('issues')
  }, [])

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              ⇄
            </span>
            <span className="brand-name">Jira Data Bridge</span>
          </div>
          {session && (
            <div className="topbar-session">
              <span className="site-host">{siteHost(session.config.baseUrl)}</span>
              <span className="avatar" aria-hidden="true">
                {initials(session.user.displayName)}
              </span>
              <span className="user-name">{session.user.displayName}</span>
              <button type="button" className="btn btn-ghost" onClick={disconnect}>
                Disconnect
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="main">
        {restoring ? (
          <div className="restoring">
            <span className="spinner" aria-hidden="true" />
            Restoring saved connection…
          </div>
        ) : session ? (
          <div className="workspace" key={session.config.baseUrl}>
            <nav className="tabs" aria-label="Sections">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={tab === t.id ? 'tab active' : 'tab'}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            {/* All three panels stay mounted so each tab's state survives switching. */}
            <section className="tab-panel" hidden={tab !== 'issues'} aria-label="Issues">
              <IssuesPanel client={session.client} preset={preset} />
            </section>
            <section className="tab-panel" hidden={tab !== 'projects'} aria-label="Projects">
              <ProjectsPanel client={session.client} onOpenIssues={openProjectIssues} />
            </section>
            <section className="tab-panel" hidden={tab !== 'explorer'} aria-label="API Explorer">
              <ApiExplorer client={session.client} />
            </section>
          </div>
        ) : (
          <div className="connect-wrap">
            {restoreError && (
              <div className="notice notice-error connect-notice" role="alert">
                {restoreError}
              </div>
            )}
            <ConnectionForm onConnect={connect} />
          </div>
        )}
      </main>

      <footer className="footer">
        Credentials stay in this browser — requests are relayed through the local{' '}
        <code>/jira-proxy</code> dev proxy.
      </footer>
    </div>
  )
}
