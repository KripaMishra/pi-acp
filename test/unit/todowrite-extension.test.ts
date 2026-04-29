import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildPiSpawnArgs } from '../../src/pi-rpc/process.js'
import { ensureTodoWriteExtensionPath } from '../../src/pi-rpc/todowrite-extension.js'

test('ensureTodoWriteExtensionPath materializes TodoWrite extension source', () => {
  const path = ensureTodoWriteExtensionPath()
  const src = readFileSync(path, 'utf8')

  assert.match(path, /pi-acp-todowrite-extension/)
  assert.match(src, /name: "TodoWrite"/)
  assert.match(src, /registerTool/)
})

test('buildPiSpawnArgs appends extension paths after rpc args', () => {
  const args = buildPiSpawnArgs({
    sessionPath: '/tmp/session.jsonl',
    extensionPaths: ['/tmp/ext-a.ts', '/tmp/ext-b.ts']
  })

  assert.deepEqual(args, [
    '--mode',
    'rpc',
    '--no-themes',
    '--session',
    '/tmp/session.jsonl',
    '-e',
    '/tmp/ext-a.ts',
    '-e',
    '/tmp/ext-b.ts'
  ])
})
