import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const EXT_DIR = join(tmpdir(), 'pi-acp-todowrite-extension')
const EXT_PATH = join(EXT_DIR, 'index.ts')

const EXT_SOURCE = String.raw`import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { Type } from "typebox"

function normalizeTodos(input: unknown) {
  if (!input || typeof input !== "object" || !Array.isArray((input as any).todos)) {
    throw new Error("TodoWrite expects { todos: [...] }")
  }

  return (input as any).todos.map((todo: any, index: number) => {
    const content = String(todo?.content ?? "").trim()
    if (!content) throw new Error("TodoWrite todos[" + index + "] requires non-empty content")
    const rawStatus = String(todo?.status ?? "pending")
    const status = rawStatus === "in_progress" || rawStatus === "completed" ? rawStatus : "pending"
    return {
      id: todo?.id == null ? undefined : String(todo.id),
      content,
      status
    }
  })
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "TodoWrite",
    label: "TodoWrite",
    description:
      "Replace the current task plan with the provided todo list. Use this to track multi-step work instead of writing todo files.",
    parameters: Type.Object({
      todos: Type.Array(
        Type.Object({
          content: Type.String({ description: "Human-readable task text" }),
          status: Type.Union([
            Type.Literal("pending"),
            Type.Literal("in_progress"),
            Type.Literal("completed")
          ]),
          id: Type.Optional(Type.String({ description: "Optional stable todo id" }))
        })
      )
    }),
    async execute(_toolCallId, params) {
      const todos = normalizeTodos(params)
      return {
        content: [{ type: "text", text: JSON.stringify({ todos }) }],
        details: { todos }
      }
    }
  })
}
`

export function ensureTodoWriteExtensionPath(): string {
  mkdirSync(EXT_DIR, { recursive: true })

  const needsWrite = !existsSync(EXT_PATH) || readFileSync(EXT_PATH, 'utf8') !== EXT_SOURCE
  if (needsWrite) writeFileSync(EXT_PATH, EXT_SOURCE, 'utf8')

  return EXT_PATH
}
