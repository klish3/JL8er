import type { ConnectionConfig, Deployment } from '../types'

const STORAGE_KEY = 'jira-data-bridge:connection'

function isDeployment(value: unknown): value is Deployment {
  return value === 'cloud' || value === 'server'
}

export function loadConnection(): ConnectionConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const record = parsed as Record<string, unknown>
    if (
      typeof record.baseUrl !== 'string' ||
      !isDeployment(record.deployment) ||
      typeof record.email !== 'string' ||
      typeof record.apiToken !== 'string'
    ) {
      return null
    }
    // Re-validate the URL on load: auto-connect will send the stored token to
    // this host, so a tampered baseUrl must not be trusted just because it
    // round-tripped through storage.
    try {
      const protocol = new URL(record.baseUrl).protocol
      if (protocol !== 'http:' && protocol !== 'https:') return null
    } catch {
      return null
    }
    // A stored connection only exists because it was saved with remember on.
    return {
      baseUrl: record.baseUrl,
      deployment: record.deployment,
      email: record.email,
      apiToken: record.apiToken,
      remember: true,
    }
  } catch {
    return null
  }
}

export function saveConnection(config: ConnectionConfig): void {
  try {
    if (config.remember) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // localStorage can be unavailable (private mode, blocked storage);
    // persistence is best-effort.
  }
}

export function clearConnection(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Best-effort; nothing to do if storage is unavailable.
  }
}
