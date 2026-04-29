import test from 'node:test'
import assert from 'node:assert/strict'
import { PiAcpAgent } from '../../src/acp/agent.js'
import { PiRpcProcess } from '../../src/pi-rpc/process.js'
import { FakeAgentSideConnection, asAgentConn } from '../helpers/fakes.js'

test('PiAcpAgent: newSession passes TodoWrite extension path to pi spawn', async () => {
  const prevKey = process.env.ANTHROPIC_API_KEY
  process.env.ANTHROPIC_API_KEY = 'test-key'

  const realSetTimeout = globalThis.setTimeout
  ;(globalThis as any).setTimeout = () => 0 as any

  const originalSpawn = PiRpcProcess.spawn
  let spawnParams: any = null
  ;(PiRpcProcess as any).spawn = async (params: any) => {
    spawnParams = params
    return {
      onEvent: () => () => {},
      getCommands: async () => ({ commands: [] }),
      getAvailableModels: async () => ({ models: [{ provider: 'test', id: 'm1', name: 'm1' }] }),
      getState: async () => ({ thinkingLevel: 'medium', sessionId: 's1', sessionFile: '/tmp/s1.jsonl' }),
      dispose: () => {}
    } as any
  }

  try {
    const agent = new PiAcpAgent(asAgentConn(new FakeAgentSideConnection()))
    await agent.newSession({ cwd: process.cwd(), mcpServers: [] } as any)

    assert.ok(Array.isArray(spawnParams?.extensionPaths))
    assert.equal(spawnParams.extensionPaths.length, 1)
    assert.match(String(spawnParams.extensionPaths[0]), /pi-acp-todowrite-extension/)
  } finally {
    PiRpcProcess.spawn = originalSpawn
    ;(globalThis as any).setTimeout = realSetTimeout
    if (prevKey == null) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = prevKey
  }
})
