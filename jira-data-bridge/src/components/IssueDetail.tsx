import { useEffect, useState } from 'react'
import type { JiraClient } from '../lib/jiraClient'
import type { JiraIssue } from '../types'
import { descriptionToText } from '../lib/adf'
import { formatDate } from '../lib/format'
import { StatusChip } from './StatusChip'

export function IssueDetail({
  client,
  issueKey,
  onClose,
}: {
  client: JiraClient
  issueKey: string
  onClose: () => void
}) {
  const [issue, setIssue] = useState<JiraIssue | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIssue(null)
    setError(null)
    client
      .getIssue(issueKey)
      .then((loaded) => {
        if (!cancelled) setIssue(loaded)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [client, issueKey])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const fields = issue?.fields
  const labels = fields?.labels ?? []
  const description =
    fields && fields.description != null ? descriptionToText(fields.description).trim() : ''

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Issue ${issueKey}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <a
            className="issue-key-link"
            href={client.browseUrl(issueKey)}
            target="_blank"
            rel="noreferrer"
          >
            {issueKey} ↗
          </a>
          <button type="button" className="btn btn-ghost modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="modal-body">
          {error ? (
            <div className="notice notice-error" role="alert">
              {error}
            </div>
          ) : !fields ? (
            <div className="loading">
              <span className="spinner" aria-hidden="true" />
              Loading issue…
            </div>
          ) : (
            <>
              <h2 className="issue-title">{fields.summary}</h2>

              <dl className="def-grid">
                <div>
                  <dt>Status</dt>
                  <dd>
                    <StatusChip status={fields.status} />
                  </dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{fields.issuetype?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt>Priority</dt>
                  <dd>{fields.priority?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt>Assignee</dt>
                  <dd>{fields.assignee?.displayName ?? 'Unassigned'}</dd>
                </div>
                <div>
                  <dt>Reporter</dt>
                  <dd>{fields.reporter?.displayName ?? '—'}</dd>
                </div>
                <div>
                  <dt>Project</dt>
                  <dd>
                    {fields.project ? `${fields.project.name} (${fields.project.key})` : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDate(fields.created)}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd>{formatDate(fields.updated)}</dd>
                </div>
              </dl>

              {labels.length > 0 && (
                <div className="label-row">
                  {labels.map((label) => (
                    <span key={label} className="pill">
                      {label}
                    </span>
                  ))}
                </div>
              )}

              <section className="description-section">
                <h3 className="section-title">Description</h3>
                {description !== '' ? (
                  <div className="description-text">{description}</div>
                ) : (
                  <p className="muted">No description.</p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
