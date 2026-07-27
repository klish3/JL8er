export type Deployment = 'cloud' | 'server'

export interface ConnectionConfig {
  baseUrl: string
  deployment: Deployment
  email: string
  apiToken: string
  remember: boolean
}

export interface JiraUser {
  accountId?: string
  displayName: string
  emailAddress?: string
  active?: boolean
}

export interface JiraStatus {
  name: string
  statusCategory?: { key: string; name?: string }
}

export interface JiraIssueFields {
  summary: string
  status?: JiraStatus
  issuetype?: { name: string }
  priority?: { name: string }
  assignee?: JiraUser | null
  reporter?: JiraUser | null
  created?: string
  updated?: string
  labels?: string[]
  project?: { key: string; name: string }
  description?: unknown
}

export interface JiraIssue {
  id: string
  key: string
  fields: JiraIssueFields
}

export interface JiraProject {
  id: string
  key: string
  name: string
  projectTypeKey?: string
  lead?: JiraUser
}

export type SearchCursor = { pageToken?: string; startAt?: number }

export interface SearchPage {
  issues: JiraIssue[]
  total?: number
  isLast: boolean
  next?: SearchCursor
}
