import { createBridgeClient, loadBridgeConfig } from './bridge'

// Demonstrates pulling data from BOTH Jira and Confluence through the bridge.
// Run with: npm run example  (the bridge must be running — see CLAUDE.md).
async function main(): Promise<void> {
  const bridge = createBridgeClient(loadBridgeConfig())

  // 1. Jira: who am I?
  const me = await bridge.myself<{ displayName?: string; emailAddress?: string }>()
  console.log(`\nmyself → HTTP ${me.status}: ${me.data?.displayName ?? me.text.slice(0, 120)}`)

  // 2. Jira: five most recently updated issues via JQL.
  const issues = await bridge.searchIssues<{
    issues?: { key: string; fields: { summary: string } }[]
  }>('ORDER BY updated DESC', { maxResults: 5 })
  console.log(`\nsearchIssues → HTTP ${issues.status}`)
  for (const issue of issues.data?.issues ?? []) {
    console.log(`  ${issue.key}  ${issue.fields.summary}`)
  }

  // 3. Confluence: spaces — same bridge, same Atlassian token, /wiki/rest/api base.
  const spaces = await bridge.confluence<{ results?: { key: string; name: string }[] }>('/space', {
    limit: 5,
  })
  console.log(`\nconfluence /space → HTTP ${spaces.status}`)
  for (const space of spaces.data?.results ?? []) {
    console.log(`  ${space.key}  ${space.name}`)
  }

  // 4. Any Jira REST GET works via jira(); any Confluence GET via confluence().
  //    e.g. await bridge.jira('/issue/PROJ-123')
  //         await bridge.confluence('/content/12345', { expand: 'body.storage' })
}

void main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
