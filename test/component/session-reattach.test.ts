import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { PiAcpAgent } from '../../src/acp/agent.js'
import { FakeAgentSideConnection, asAgentConn } from '../helpers/fakes.js'
import { PiRpcProcess } from '../../src/pi-rpc/process.js'
import { getPiAcpSessionMapPath } from '../../src/acp/paths.js'

test('PiAcpAgent: prompt reattaches detached session and preserves stored mcpServers', async () => {
  const home = mkdtempSync(join(tmpdir(), 'pi-acp-home-'))
  const cwd = mkdtempSync(join(tmpdir(), 'pi-acp-cwd-'))
  const sessionId = 'sess-reattach-1'
  const sessionFile = join(home, 'session.jsonl')
  writeFileSync(sessionFile, '')

  const oldHome = process.env.HOME
  process.env.HOME = home

  const mapPath = getPiAcpSessionMapPath()
  mkdirSync(join(mapPath, '..'), { recursive: true })
  writeFileSync(
    mapPath,
    JSON.stringify(
      {
        version: 1,
        sessions: {
          [sessionId]: {
            sessionId,
            cwd,
            sessionFile,
            mcpServers: [{ name: 'local-mcp', type: 'stdio', command: 'mcp-server' }],
            updatedAt: new Date().toISOString()
          }
        }
      },
      null,
      2
    ) + '\n'
  )

  const originalSpawn = PiRpcProcess.spawn
  try {
    ;(PiRpcProcess as any).spawn = async () => {
      let handler: ((ev: any) => void) | null = null
      return {
        onEvent: (h: (ev: any) => void) => {
          handler = h
          return () => {
            handler = null
          }
        },
        prompt: async () => {
          handler?.({ type: 'agent_start' })
          handler?.({ type: 'turn_end' })
          handler?.({ type: 'agent_end' })
        },
        abort: async () => {},
        getCommands: async () => ({ commands: [] }),
        getAvailableModels: async () => ({ models: [{ provider: 'p', id: 'm', name: 'm' }] }),
        getState: async () => ({ thinkingLevel: 'medium' })
      } as any
    }

    const conn = new FakeAgentSideConnection()
    const agent = new PiAcpAgent(asAgentConn(conn))

    const res = await agent.prompt({ sessionId, prompt: [{ type: 'text', text: 'hello' }], _meta: null } as any)
    assert.equal(res.stopReason, 'end_turn')

    const reattached = (agent as any).sessions.get(sessionId)
    assert.equal(reattached.mcpServers.length, 1)
    assert.equal(reattached.mcpServers[0].name, 'local-mcp')
  } finally {
    PiRpcProcess.spawn = originalSpawn
    if (oldHome === undefined) delete process.env.HOME
    else process.env.HOME = oldHome
  }
})
