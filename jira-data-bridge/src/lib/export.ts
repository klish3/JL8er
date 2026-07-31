import type { JiraIssue } from '../types'

export function flattenIssue(issue: JiraIssue): Record<string, string> {
  const fields = issue.fields
  return {
    key: issue.key,
    summary: fields.summary ?? '',
    type: fields.issuetype?.name ?? '',
    status: fields.status?.name ?? '',
    priority: fields.priority?.name ?? '',
    assignee: fields.assignee?.displayName ?? '',
    reporter: fields.reporter?.displayName ?? '',
    labels: fields.labels?.join(' ') ?? '',
    project: fields.project?.key ?? '',
    created: fields.created ?? '',
    updated: fields.updated ?? '',
  }
}

function escapeCsv(value: string): string {
  // Neutralize spreadsheet formula injection: a cell starting with =, +, -, @
  // or a control char is executed as a formula by Excel/Sheets, so
  // attacker-controlled Jira text (summaries, display names) could run on open.
  let cell = /^[=+\-@\t\r]/.test(value) ? "'" + value : value
  // RFC 4180: quote values containing commas, quotes, or line breaks and
  // double any embedded quotes.
  if (/[",\r\n]/.test(cell)) {
    cell = '"' + cell.replaceAll('"', '""') + '"'
  }
  return cell
}

export function toCsv(rows: Record<string, string>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers.map(escapeCsv).join(',')]
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsv(row[header] ?? '')).join(','))
  }
  // Lead with a UTF-8 BOM so Excel on Windows detects the encoding instead of
  // rendering non-ASCII text (accents, CJK, Cyrillic) as mojibake.
  return '﻿' + lines.join('\r\n') + '\r\n'
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
