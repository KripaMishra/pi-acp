import test from 'node:test'
import assert from 'node:assert/strict'
import { PiAcpAgent } from '../../src/acp/agent.js'
import { FakeAgentSideConnection, FakePiRpcProcess, asAgentConn } from '../helpers/fakes.js'

class FakeSessions {
  constructor(private readonly session: any) {}
  get(_id: string) {
    return this.session
  }
}

test('PiAcpAgent: /steering is handled adapter-side', async () => {
  const conn = new FakeAgentSideConnection()
  const proc = new FakePiRpcProcess() as any
  proc.getState = async () => ({ steeringMode: 'one-at-a-time' })

  const agent = new PiAcpAgent(asAgentConn(conn))
  ;(agent as any).sessions = new FakeSessions({ sessionId: 's1', proc, fileCommands: [] }) as any

  const res = await agent.prompt({
    sessionId: 's1',
    prompt: [{ type: 'text', text: '/steering' }]
  } as any)

  assert.equal(res.stopReason, 'end_turn')
  assert.equal(proc.prompts.length, 0)
  const last = conn.updates.at(-1)
  assert.match((last as any).update.content.text, /Steering mode: one-at-a-time/)
})

test('PiAcpAgent: /name sets session display name adapter-side', async () => {
  const conn = new FakeAgentSideConnection()
  const proc = new FakePiRpcProcess() as any

  let setTo: string | null = null
  proc.setSessionName = async (name: string) => {
    setTo = name
  }

  const agent = new PiAcpAgent(asAgentConn(conn))
  ;(agent as any).sessions = new FakeSessions({ sessionId: 's1', proc, fileCommands: [] }) as any

  const res = await agent.prompt({
    sessionId: 's1',
    prompt: [{ type: 'text', text: '/name My Session' }]
  } as any)

  assert.equal(res.stopReason, 'end_turn')
  assert.equal(proc.prompts.length, 0)
  assert.equal(setTo, 'My Session')
  const info = conn.updates.find(u => (u as any).update?.sessionUpdate === 'session_info_update')
  assert.equal((info as any)?.update?.title, 'My Session')

  const last = conn.updates.at(-1)
  assert.match((last as any).update.content.text, /Session name set: My Session/)
})

test('PiAcpAgent: first non-command prompt sets default session title once', async () => {
  const conn = new FakeAgentSideConnection()
  const proc = new FakePiRpcProcess() as any
  const setNames: string[] = []
  proc.setSessionName = async (name: string) => {
    setNames.push(name)
  }

  const session = {
    sessionId: 's1',
    proc,
    fileCommands: [],
    prompt: async () => 'end_turn'
  }

  const agent = new PiAcpAgent(asAgentConn(conn))
  ;(agent as any).sessions = new FakeSessions(session) as any

  await agent.prompt({
    sessionId: 's1',
    prompt: [{ type: 'text', text: '   Hello   there   from ACP    ' }]
  } as any)

  await agent.prompt({
    sessionId: 's1',
    prompt: [{ type: 'text', text: 'second message' }]
  } as any)

  assert.deepEqual(setNames, ['Hello there from ACP'])
  const info = conn.updates.find(u => (u as any).update?.sessionUpdate === 'session_info_update')
  assert.equal((info as any)?.update?.title, 'Hello there from ACP')
})

test('PiAcpAgent: first prompt slash command does not auto-name session', async () => {
  const conn = new FakeAgentSideConnection()
  const proc = new FakePiRpcProcess() as any
  let setCalls = 0
  proc.setSessionName = async () => {
    setCalls += 1
  }

  const session = {
    sessionId: 's1',
    proc,
    fileCommands: [],
    prompt: async () => 'end_turn'
  }

  const agent = new PiAcpAgent(asAgentConn(conn))
  ;(agent as any).sessions = new FakeSessions(session) as any

  await agent.prompt({
    sessionId: 's1',
    prompt: [{ type: 'text', text: '/steering' }]
  } as any)

  assert.equal(setCalls, 0)
})
