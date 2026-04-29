import test from 'node:test'
import assert from 'node:assert/strict'
import {
  toPlanEntries,
  extractTodosFromPayload,
  maybePlanUpdateFromChecklistText,
  maybePlanUpdateFromToolEvent
} from '../../src/acp/todo-plan.js'

test('toPlanEntries maps statuses and fixes priority to medium', () => {
  const entries = toPlanEntries([
    { content: 'a', status: 'pending', priority: 'low' },
    { content: 'b', status: 'in_progress', priority: 'high' },
    { content: 'c', status: 'completed', priority: 'medium' },
    { content: 'd', status: 'cancelled', priority: 'high' }
  ])

  assert.equal(entries.length, 4)
  assert.deepEqual(entries.map(e => e.status), ['pending', 'in_progress', 'completed', 'pending'])
  assert.deepEqual(entries.map(e => e.priority), ['medium', 'medium', 'medium', 'medium'])
})

test('toPlanEntries omits ids by default and includes ids when requested', () => {
  const noIds = toPlanEntries([{ content: 'a', status: 'pending' }])
  assert.equal('id' in noIds[0]!, false)

  const withIds = toPlanEntries([{ content: 'a', status: 'pending' }], { includeIds: true })
  assert.equal(typeof (withIds[0] as any).id, 'string')
})

test('toPlanEntries allows multiple in_progress entries', () => {
  const entries = toPlanEntries([
    { content: 'a', status: 'in_progress' },
    { content: 'b', status: 'in_progress' }
  ])

  assert.deepEqual(entries.map(e => e.status), ['in_progress', 'in_progress'])
})

test('extractTodosFromPayload supports structured and fallback JSON content', () => {
  const structured = extractTodosFromPayload({ todos: [{ content: 'x', status: 'pending' }] })
  assert.equal(structured?.length, 1)

  const fallback = extractTodosFromPayload({
    content: [{ type: 'text', text: '{"todos":[{"content":"y","status":"completed"}]}' }]
  })
  assert.equal(fallback?.length, 1)
  assert.equal(fallback?.[0]?.content, 'y')
})

test('maybePlanUpdateFromChecklistText parses markdown checkboxes', () => {
  const update = maybePlanUpdateFromChecklistText('- [ ] step one\n- [x] step two')
  assert.ok(update)
  assert.deepEqual((update as any).entries.map((e: any) => e.status), ['pending', 'completed'])
  assert.deepEqual((update as any).entries.map((e: any) => e.content), ['step one', 'step two'])
})

test('maybePlanUpdateFromChecklistText ignores code fences', () => {
  const update = maybePlanUpdateFromChecklistText('```\n- [ ] not a todo\n```\n- [ ] real todo')
  assert.ok(update)
  assert.equal((update as any).entries.length, 1)
  assert.equal((update as any).entries[0].content, 'real todo')
})

test('maybePlanUpdateFromChecklistText uses latest checklist block only', () => {
  const update = maybePlanUpdateFromChecklistText('- [x] old one\n\ntext\n- [ ] new one\n- [ ] new two')
  assert.ok(update)
  assert.deepEqual((update as any).entries.map((e: any) => e.content), ['new one', 'new two'])
})

test('maybePlanUpdateFromToolEvent emits empty entries for todo clear', () => {
  const update = maybePlanUpdateFromToolEvent({ toolName: 'TodoWrite', args: { todos: [] } })
  assert.ok(update)
  assert.deepEqual(update, { sessionUpdate: 'plan', entries: [] })
})
