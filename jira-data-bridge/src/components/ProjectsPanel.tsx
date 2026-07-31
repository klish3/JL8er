import { useEffect, useState } from 'react'
import type { JiraClient } from '../lib/jiraClient'
import type { JiraProject } from '../types'

export function ProjectsPanel({
  client,
  onOpenIssues,
}: {
  client: JiraClient
  onOpenIssues: (projectKey: string) => void
}) {
  const [projects, setProjects] = useState<JiraProject[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  // Bumped to re-run the load effect (e.g. after a transient failure).
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setProjects(null)
    setError(null)
    client
      .listProjects()
      .then((list) => {
        if (!cancelled) setProjects(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [client, reloadKey])

  const query = filter.trim().toLowerCase()
  const visible = (projects ?? []).filter(
    (project) =>
      query === '' ||
      project.key.toLowerCase().includes(query) ||
      project.name.toLowerCase().includes(query),
  )

  return (
    <div className="panel">
      <div className="panel-head">
        <input
          className="input filter-input"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by key or name…"
          aria-label="Filter projects"
          spellCheck={false}
        />
        {projects !== null && (
          <span className="panel-count">
            {visible.length} of {projects.length} project{projects.length === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {error !== null ? (
        <div className="notice notice-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-ghost notice-action"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Retry
          </button>
        </div>
      ) : projects === null ? (
        <div className="loading">
          <span className="spinner" aria-hidden="true" />
          Loading projects…
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          {query !== ''
            ? `No projects match "${filter.trim()}".`
            : 'No projects are visible to this account.'}
        </div>
      ) : (
        <div className="project-grid">
          {visible.map((project) => (
            <article key={project.id} className="project-card">
              <div className="project-card-top">
                <span className="project-key">{project.key}</span>
                {project.projectTypeKey !== undefined && (
                  <span className="pill">{project.projectTypeKey}</span>
                )}
              </div>
              <h3 className="project-name">{project.name}</h3>
              {project.lead && <p className="project-lead">Lead: {project.lead.displayName}</p>}
              <button type="button" className="btn" onClick={() => onOpenIssues(project.key)}>
                View issues →
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
