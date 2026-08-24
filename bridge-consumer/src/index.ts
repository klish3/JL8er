import { BridgeUnreachableError, createBridgeClient, loadBridgeConfig } from './bridge'

// Your project starts here. This seed just proves the bridge wiring works:
// it loads config, connects through the Jira Data Bridge, and prints who you are.
async function main(): Promise<void> {
  console.log('bridge-consumer — a project wired to the Jira Data Bridge.\n')

  let config
  try {
    config = loadBridgeConfig()
  } catch (err) {
    console.error(`Config error: ${(err as Error).message}`)
    console.error('Copy .env.example to .env and fill it in.')
    process.exitCode = 1
    return
  }

  const bridge = createBridgeClient(config)
  try {
    const me = await bridge.myself<{ displayName?: string }>()
    if (me.ok) {
      console.log(`✔ Connected through the bridge as: ${me.data?.displayName ?? '(unknown user)'}`)
      console.log(`  Site: ${config.site}  ·  Deployment: ${config.deployment}`)
    } else {
      console.error(`✘ Bridge reached, but Atlassian returned HTTP ${me.status}. Check your ATLASSIAN_* credentials.`)
      process.exitCode = 1
    }
  } catch (err) {
    console.error(err instanceof BridgeUnreachableError ? `✘ ${err.message}` : `✘ Unexpected error: ${(err as Error).message}`)
    process.exitCode = 1
  }
}

void main()
