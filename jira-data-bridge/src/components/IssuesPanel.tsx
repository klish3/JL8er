import { useCallback, useEffect, useRef, useState } from 'react'
import type { JiraClient } from '../lib/jiraClient'
import type { JiraIssue, SearchCursor } from '../types'
import { downloadFile, flattenIssue, toCsv } from '../lib/export'
import { formatDate } from '../lib/format'
import { IssueDetail } from './IssueDetail'
import { StatusChip } from './StatusChip'

const DEFAULT_JQL = 'ORDER BY updated DESC'
const LOAD_ALL_CAP = 500

export function IssuesPanel({
  client,
  preset,
}: {
  client: JiraClient
  preset: { id: number; jql: string } | null
}) {
  const [jql, setJql] = useState(DEFAULT_JQL)
  const [issues, setIssues] = useState<JiraIssue[]>([])
  const [next, setNext] = useState<SearchCursor | undefined>(undefined)
  const [total, setTotal] = useState<number | undefined>(undefined)
  const [busy, setBusy] = useState<'search' | 'more' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  // Last successfully executed JQL — pagination must not follow live input edits.
  const executedJqlRef = useRef<string | null>(null)
  // Monotonic request id so stale responses never clobber newer state.
  const seqRef = useRef(0)
  const presetIdRef = useRef<number | null>(null)

  const runSearch = useCallback(
    async (query: string) => {
      const id = ++seqRef.current
      setBusy('search')
      setError(null)
      setSelectedKey(null)
      try {
        const page = await client.searchIssues(query)
        if (seqRef.current !== id) return
        executedJqlRef.current = query
        setIssues(page.issues)
        setTotal(page.total)
        setNext(page.isLast ? undefined : page.next)
      } catch (err) {
        if (seqRef.current !== id) return
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (seqRef.current === id) setBusy(null)
      }
    },
    [client],
  )

  // Initial search. If a preset is already pending at mount (workspace remount),
  // consume it here so the preset effect below does not run it a second time.
  useEffect(() => {
    let initial = DEFAULT_JQL
    if (preset) {
      presetIdRef.current = preset.id
      initial = preset.jql
    }
    setJql(initial)
    void runSearch(initial)
    // Mount-only by design: `client` can only change together with a remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!preset || preset.id === presetIdRef.current) return
    presetIdRef.current = preset.id
    setJql(preset.jql)
    void runSearch(preset.jql)
  }, [preset, runSearch])

  const loadMore = async () => {
    const executed = executedJqlRef.current
    if (!next || executed === null) return
    const id = ++seqRef.current
    setBusy('more')
    setError(null)
    try {
      const page = await client.searchIssues(executed, next)
      if (seqRef.current !== id) return
      setIssues((prev) => [...prev, ...page.issues])
      if (page.total !== undefined) setTotal(page.total)
      setNext(page.isLast ? undefined : page.next)
    } catch (err) {
      if (seqRef.current !== id) return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (seqRef.current === id) setBusy(null)
    }
  }

  const loadAll = async () => {
    const executed = executedJqlRef.current
    if (!next || executed === null) return
    const id = ++seqRef.current
    setBusy('more')
    setError(null)
    try {
      let cursor: SearchCursor | undefined = next
      let count = issues.length
      while (cursor !== undefined && count < LOAD_ALL_CAP) {
        const page = await client.searchIssues(executed, cursor)
        if (seqRef.current !== id) return
        count += page.issues.length
        setIssues((prev) => [...prev, ...page.issues])
        if (page.total !== undefined) setTotal(page.total)
        cursor = page.isLast ? undefined : page.next
        setNext(cursor)
      }
    } catch (err) {
      if (seqRef.current !== id) return
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (seqRef.current === id) setBusy(null)
    }
  }

  const stamp = new Date().toISOString().slice(0, 10)

  const exportCsv = () => {
    downloadFile(
      `jira-issues-${stamp}.csv`,
      toCsv(issues.map(flattenIssue)),
      'text/csv;charset=utf-8',
    )
  }

  const exportJson = () => {
    downloadFile(`jira-issues-${stamp}.json`, JSON.stringify(issues, null, 2), 'application/json')
  }

  const countLabel =
    `${issues.length} issue${issues.length === 1 ? '' : 's'} loaded` +
    (total !== undefined ? ` of ${total}` : next ? ' (more available)' : '')

  const showEmpty =
    busy === null && error === null && issues.length === 0 && executedJqlRef.current !== null

  return (
    <div className="panel">
      <form
        className="jql-form"
        onSubmit={(e) => {
          e.preventDefault()
          void runSearch(jql)
        }}
      >
        <input
          className="input jql-input"
          value={jql}
          onChange={(e) => setJql(e.target.value)}
          placeholder='JQL, e.g. project = ABC AND status != Done ORDER BY updated DESC'
          aria-label="JQL query"
          spellCheck={false}
        />
        <button type="submit" className="btn btn-primary" disabled={busy === 'search'}>
          {busy === 'search' ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="notice notice-error" role="alert">
          {error}
        </div>
      )}

      <div className="toolbar">
        <span className="toolbar-info">{countLabel}</span>
        <div className="toolbar-actions">
          {next && (
            <button
              type="button"
              className="btn"
              onClick={() => void loadMore()}
              disabled={busy !== null}
            >
              {busy === 'more' ? 'Loading…' : 'Load more'}
            </button>
          )}
          {next && (
            <button
              type="button"
              className="btn"
              title={`Fetches remaining pages, capped at ${LOAD_ALL_CAP} issues`}
              onClick={() => void loadAll()}
              disabled={busy !== null}
            >
              Load all
            </button>
          )}
          <button type="button" className="btn" onClick={exportCsv} disabled={issues.length === 0}>
            Export CSV
          </button>
          <button type="button" className="btn" onClick={exportJson} disabled={issues.length === 0}>
            Export JSON
          </button>
        </div>
      </div>

      {busy === 'search' ? (
        <div className="loading">
          <span className="spinner" aria-hidden="true" />
          Searching…
        </div>
      ) : issues.length > 0 ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Summary</th>
                <th>Type</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assignee</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id} onClick={() => setSelectedKey(issue.key)}>
                  <td className="issue-key">{issue.key}</td>
                  <td className="issue-summary">{issue.fields.summary}</td>
                  <td>{issue.fields.issuetype?.name ?? '—'}</td>
                  <td>
                    <StatusChip status={issue.fields.status} />
                  </td>
                  <td>{issue.fields.priority?.name ?? '—'}</td>
                  <td>{issue.fields.assignee?.displayName ?? 'Unassigned'}</td>
                  <td className="nowrap">{formatDate(issue.fields.updated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : showEmpty ? (
        <div className="empty-state">No issues match this JQL.</div>
      ) : null}

      {selectedKey !== null && (
        <IssueDetail client={client} issueKey={selectedKey} onClose={() => setSelectedKey(null)} />
      )}
    </div>
  )
}
