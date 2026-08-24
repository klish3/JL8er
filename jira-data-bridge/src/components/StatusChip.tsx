import type { JiraStatus } from '../types'

const CATEGORY_CLASS: Record<string, string> = {
  new: 'status-chip-new',
  indeterminate: 'status-chip-indeterminate',
  done: 'status-chip-done',
}

export function StatusChip({ status }: { status: JiraStatus | undefined }) {
  if (!status) {
    return <span className="muted">—</span>
  }
  const key = status.statusCategory?.key
  const variant = (key !== undefined && CATEGORY_CLASS[key]) || 'status-chip-neutral'
  return <span className={`status-chip ${variant}`}>{status.name}</span>
}
