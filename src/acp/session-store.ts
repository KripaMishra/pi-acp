import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { McpServer } from '@agentclientprotocol/sdk'
import { getPiAcpSessionMapPath } from './paths.js'

export type StoredSession = {
  sessionId: string
  cwd: string
  sessionFile: string
  mcpServers: McpServer[]
  updatedAt: string
}

type SessionMapFile = {
  version: 1
  sessions: Record<string, StoredSession>
}

function ensureParentDir(path: string) {
  mkdirSync(dirname(path), { recursive: true })
}

function loadFile(path: string): SessionMapFile {
  try {
    const raw = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(raw) as SessionMapFile
    if (parsed?.version !== 1 || typeof parsed.sessions !== 'object' || !parsed.sessions) {
      return { version: 1, sessions: {} }
    }
    return parsed
  } catch {
    return { version: 1, sessions: {} }
  }
}

function saveFile(path: string, data: SessionMapFile): void {
  ensureParentDir(path)
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

export class SessionStore {
  private readonly path: string

  constructor(path = getPiAcpSessionMapPath()) {
    this.path = path
  }

  get(sessionId: string): StoredSession | null {
    const db = loadFile(this.path)
    const session = db.sessions[sessionId]
    if (!session) return null

    return {
      ...session,
      mcpServers: Array.isArray((session as any).mcpServers) ? ((session as any).mcpServers as McpServer[]) : []
    }
  }

  upsert(entry: { sessionId: string; cwd: string; sessionFile: string; mcpServers?: McpServer[] }): void {
    const db = loadFile(this.path)
    db.sessions[entry.sessionId] = {
      sessionId: entry.sessionId,
      cwd: entry.cwd,
      sessionFile: entry.sessionFile,
      mcpServers: entry.mcpServers ?? [],
      updatedAt: new Date().toISOString()
    }
    saveFile(this.path, db)
  }
}
