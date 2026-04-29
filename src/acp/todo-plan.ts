import type { PlanEntry, SessionUpdate } from '@agentclientprotocol/sdk'

type TodoLike = {
  id?: string
  content?: string
  status?: string
  priority?: string
  activeForm?: string
}

function toAcpStatus(status: string | undefined): 'pending' | 'in_progress' | 'completed' {
  if (status === 'in_progress') return 'in_progress'
  if (status === 'completed') return 'completed'
  return 'pending'
}

export function toPlanEntries(todos: TodoLike[], opts?: { includeIds?: boolean }): PlanEntry[] {
  return todos
    .map((todo, index) => {
      const content = String(todo?.content ?? '').trim()
      if (!content) return null

      const base: PlanEntry = {
        content,
        status: toAcpStatus(todo?.status),
        priority: 'medium'
      }

      if (opts?.includeIds) {
        return {
          ...base,
          id: String(todo?.id ?? `${index}:${content}`)
        }
      }

      return base
    })
    .filter((x): x is PlanEntry => Boolean(x))
}

function parseTodosObject(x: unknown): TodoLike[] | null {
  if (!x || typeof x !== 'object') return null
  const todos = (x as any).todos
  return Array.isArray(todos) ? (todos as TodoLike[]) : null
}

export function extractTodosFromPayload(payload: unknown): TodoLike[] | null {
  const direct = parseTodosObject(payload)
  if (direct) return direct

  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload)
      const nested = parseTodosObject(parsed)
      if (nested) return nested
    } catch {
      return null
    }
  }

  if (payload && typeof payload === 'object') {
    const content = (payload as any).content
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block?.type !== 'text' || typeof block?.text !== 'string') continue
        try {
          const parsed = JSON.parse(block.text)
          const nested = parseTodosObject(parsed)
          if (nested) return nested
        } catch {
          // ignore
        }
      }
    }
  }

  return null
}

function parseChecklistTodos(text: string): TodoLike[] {
  const lines = text.split(/\r?\n/)
  const blocks: TodoLike[][] = []
  let current: TodoLike[] = []
  let inCodeFence = false

  const flush = () => {
    if (current.length) blocks.push(current)
    current = []
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (line.trimStart().startsWith('```')) {
      inCodeFence = !inCodeFence
      flush()
      continue
    }
    if (inCodeFence) continue

    const m = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.+)$/)
    if (!m) {
      flush()
      continue
    }

    const checked = m[1]?.toLowerCase() === 'x'
    const content = String(m[2] ?? '').trim()
    if (!content) continue

    current.push({
      content,
      status: checked ? 'completed' : 'pending'
    })
  }

  flush()
  return blocks.length ? blocks[blocks.length - 1]! : []
}

function isTodoToolName(name: string): boolean {
  const n = name.toLowerCase()
  return n === 'todowrite' || n === 'todo_write' || n === 'todo'
}

export function maybePlanUpdateFromChecklistText(
  text: string,
  opts?: { includeIds?: boolean }
): SessionUpdate | null {
  const todos = parseChecklistTodos(text)
  if (!todos.length) return null

  return {
    sessionUpdate: 'plan',
    entries: toPlanEntries(todos, { includeIds: opts?.includeIds })
  }
}

export function maybePlanUpdateFromToolEvent(
  input: {
    toolName?: string
    args?: unknown
    result?: unknown
  },
  opts?: { includeIds?: boolean }
): SessionUpdate | null {
  const toolName = String(input.toolName ?? '')
  if (!isTodoToolName(toolName)) return null

  const todos = extractTodosFromPayload(input.args) ?? extractTodosFromPayload(input.result)
  if (!todos) return null

  return {
    sessionUpdate: 'plan',
    entries: toPlanEntries(todos, { includeIds: opts?.includeIds })
  }
}
