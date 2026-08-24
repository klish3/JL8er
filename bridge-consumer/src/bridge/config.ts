import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export type Deployment = 'cloud' | 'server'

export interface BridgeConfig {
  /** Base URL of the running bridge proxy, e.g. http://localhost:5173/jira-proxy */
  bridgeUrl: string
  /** Atlassian site origin, e.g. https://your-site.atlassian.net (Jira + Confluence share it on Cloud). */
  site: string
  deployment: Deployment
  /** Required for Cloud (Basic auth); unused for Server/DC. */
  email?: string
  /** Cloud API token or Server/DC personal access token. */
  token: string
}

/**
 * Minimal .env loader: reads KEY=VALUE lines from ./.env (if present) into
 * process.env WITHOUT overriding variables already set in the real environment.
 * Avoids a dotenv dependency; the real environment always wins.
 */
export function loadDotEnv(file = '.env'): void {
  const path = resolve(process.cwd(), file)
  if (!existsSync(path)) return
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

/** Build a BridgeConfig from the environment (loading ./.env first). Throws on missing required vars. */
export function loadBridgeConfig(): BridgeConfig {
  loadDotEnv()
  const deployment: Deployment = process.env.ATLASSIAN_DEPLOYMENT === 'server' ? 'server' : 'cloud'
  const site = required('ATLASSIAN_SITE').replace(/\/+$/, '')
  const token = required('ATLASSIAN_TOKEN')
  const email = process.env.ATLASSIAN_EMAIL || undefined
  if (deployment === 'cloud' && !email) {
    throw new Error(
      'ATLASSIAN_EMAIL is required for Cloud (Basic auth). Set it in .env, or use ATLASSIAN_DEPLOYMENT=server.',
    )
  }
  return {
    bridgeUrl: (process.env.BRIDGE_URL ?? 'http://localhost:5173/jira-proxy').replace(/\/+$/, ''),
    site,
    deployment,
    email,
    token,
  }
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable ${name} (set it in .env — see .env.example).`)
  }
  return value
}
