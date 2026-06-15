import { createHash, randomUUID } from 'crypto'
import { dirname, join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import http from 'http'
import https from 'https'
import { URL } from 'url'
import { getPathFallback } from './electronRuntime'
import { ConfigService } from './config'
import type { Message } from './chatService'

type PersonaKind = 'contact' | 'self'
type KnowledgeItemType = 'source_chunk' | 'session_summary' | 'memory_item'
type KnowledgeStatus = 'active' | 'pinned' | 'excluded'

export interface KnowledgeRetrieval {
  itemId: string
  title: string
  summary: string
  score: number
  reason: string
  tags: string[]
  status: KnowledgeStatus
}

export interface PersonaKnowledgeItem {
  id: string
  personaId: string
  type: KnowledgeItemType
  title: string
  summary: string
  rawText: string
  sourceSessionIds: string[]
  sourceMessageCount: number
  sourceDateRange: { startTime: number; endTime: number }
  tags: string[]
  status: KnowledgeStatus
  importance: number
  confidence: number
  createdAt: number
  updatedAt: number
  origin: {
    mode: 'auto' | 'user' | 'reply'
    chunkIndex?: number
    personaVersion?: number
  }
}

export interface PersonaAnswerTrace {
  id: string
  personaId: string
  question: string
  answer: string
  retrievals: KnowledgeRetrieval[]
  createdAt: number
  source: 'chat' | 'generateReply'
}

interface KnowledgeStore {
  version: number
  items: PersonaKnowledgeItem[]
  traces: PersonaAnswerTrace[]
}

interface PersonaSnapshot {
  id: string
  kind?: PersonaKind
  contactName: string
  summary?: string
  personality?: { traits?: string[] }
  communicationStyle?: {
    tone?: string
    sentencePatterns?: string[]
    emojiHabits?: string[]
    responseLength?: string
    commonPhrases?: string[]
  }
  valuesAndMotivations?: string[]
  relationshipHints?: string[]
  conversationRules?: string[]
  doAndDont?: { do?: string[]; dont?: string[] }
  exampleReplies?: string[]
  edgeCases?: string[]
  sourceSessionIds?: string[]
  version?: number
}

function cleanText(value: string): string {
  return String(value || '').replace(/\r\n/g, '\n').replace(/\0/g, '').trim()
}

function formatTime(ts: number): string {
  const ms = ts > 1_000_000_000_000 ? ts : ts * 1000
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function normalizeSourceTime(ts: number): number {
  return ts > 1_000_000_000_000 ? ts : ts * 1000
}

function hashText(value: string): string {
  return createHash('sha1').update(value).digest('hex').slice(0, 16)
}

function buildMessageLine(msg: Message, selfLabel: string, peerLabel: string): string {
  const sender = msg.isSend === 1 ? selfLabel : peerLabel
  const content = cleanText(String(msg.parsedContent || msg.rawContent || '')) || '[消息]'
  return `${formatTime(msg.createTime)} ${sender}: ${content}`
}

function tokenize(text: string): string[] {
  const normalized = cleanText(text).toLowerCase()
  if (!normalized) return []

  const tokens = new Set<string>()
  for (const match of normalized.match(/[a-z0-9_]+/g) || []) {
    if (match.length >= 2) tokens.add(match)
  }
  const cjkMatches = normalized.match(/[\u4e00-\u9fff]+/g) || []
  for (const part of cjkMatches) {
    if (part.length <= 2) {
      tokens.add(part)
      continue
    }
    tokens.add(part)
    for (let i = 0; i < part.length - 1; i += 1) {
      tokens.add(part.slice(i, i + 2))
    }
  }
  return [...tokens]
}

function scoreText(queryTokens: string[], candidate: string, boost = 1): number {
  const text = cleanText(candidate).toLowerCase()
  if (!text || queryTokens.length === 0) return 0

  let score = 0
  for (const token of queryTokens) {
    if (!token) continue
    if (text.includes(token)) {
      score += token.length >= 4 ? 3 : 1.5
    }
  }
  return score * boost
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

class AiPersonaKnowledgeService {
  private storePath: string
  private store: KnowledgeStore

  constructor() {
    const baseDir = getPathFallback('userData')
    mkdirSync(baseDir, { recursive: true })
    this.storePath = join(baseDir, 'ai-persona-knowledge.json')
    this.store = { version: 1, items: [], traces: [] }
    this.load()
  }

  private load(): void {
    try {
      if (!existsSync(this.storePath)) return
      const raw = readFileSync(this.storePath, 'utf8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        this.store = {
          version: parsed.version || 1,
          items: Array.isArray(parsed.items) ? parsed.items : [],
          traces: Array.isArray(parsed.traces) ? parsed.traces : []
        }
      }
    } catch {
      this.store = { version: 1, items: [], traces: [] }
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.storePath), { recursive: true })
    writeFileSync(this.storePath, JSON.stringify(this.store, null, 2), 'utf8')
  }

  private getModelConfig(): { apiBaseUrl: string; apiKey: string; model: string } {
    const cfg = ConfigService.getInstance()
    return {
      apiBaseUrl: String(cfg.get('aiModelApiBaseUrl') || cfg.get('aiInsightApiBaseUrl') || '').trim(),
      apiKey: String(cfg.get('aiModelApiKey') || cfg.get('aiInsightApiKey') || '').trim(),
      model: String(cfg.get('aiModelApiModel') || cfg.get('aiInsightApiModel') || 'gpt-4o-mini').trim() || 'gpt-4o-mini'
    }
  }

  private async callModel(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: { maxTokens?: number; temperature?: number; timeoutMs?: number }
  ): Promise<string> {
    const cfg = this.getModelConfig()
    if (!cfg.apiBaseUrl || !cfg.apiKey) throw new Error('请先在设置中配置 AI 模型')

    const endpoint = cfg.apiBaseUrl.replace(/\/+$/, '') + '/chat/completions'
    const urlObj = new URL(endpoint)
    const body = JSON.stringify({
      model: cfg.model,
      messages,
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.2,
      stream: false
    })

    return await new Promise<string>((resolve, reject) => {
      const reqOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST' as const,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body).toString(),
          Authorization: `Bearer ${cfg.apiKey}`
        }
      }
      const req = (urlObj.protocol === 'https:' ? https.request : http.request)(reqOptions, (res: any) => {
        let data = ''
        res.on('data', (chunk: any) => { data += chunk })
        res.on('end', () => {
          try {
            const content = JSON.parse(data)?.choices?.[0]?.message?.content
            if (typeof content === 'string' && content.trim()) resolve(content.trim())
            else reject(new Error(`API 返回异常: ${data.slice(0, 200)}`))
          } catch {
            reject(new Error(`JSON 解析失败: ${data.slice(0, 200)}`))
          }
        })
      })
      req.setTimeout(options?.timeoutMs ?? 60_000, () => { req.destroy(); reject(new Error('API 超时')) })
      req.on('error', (e: any) => reject(e))
      req.write(body)
      req.end()
    })
  }

  private buildChunkPrompt(lines: string[], snapshot: PersonaSnapshot, sourceSessionIds: string[]): string[] {
    return [
      '你正在把聊天记录切片整理成可检索的知识库条目。',
      '请只输出 JSON，不要输出额外说明。',
      '',
      'JSON 结构如下：',
      '{',
      '  "title": "不超过20个字的标题",',
      '  "summary": "100到220字的摘要，强调可检索信息",',
      '  "tags": ["标签1", "标签2"],',
      '  "importance": 0,',
      '  "confidence": 0,',
      '  "keyPoints": ["要点1", "要点2"],',
      '  "styleSignals": ["风格信号1", "风格信号2"]',
      '}',
      '',
      `分身名称：${snapshot.contactName}`,
      `分身类型：${snapshot.kind === 'self' ? '我的分身' : '联系人分身'}`,
      sourceSessionIds.length ? `来源会话：${sourceSessionIds.join('、')}` : '',
      '',
      '已有长期画像：',
      JSON.stringify({
        summary: snapshot.summary || '',
        traits: snapshot.personality?.traits || [],
        tone: snapshot.communicationStyle?.tone || '',
        responseLength: snapshot.communicationStyle?.responseLength || '',
        commonPhrases: snapshot.communicationStyle?.commonPhrases || [],
        rules: snapshot.conversationRules || [],
        doAndDont: snapshot.doAndDont || { do: [], dont: [] },
        examples: snapshot.exampleReplies || [],
        edgeCases: snapshot.edgeCases || []
      }, null, 2),
      '',
      '聊天片段：',
      lines.join('\n'),
      '',
      '要求：',
      '1. 标题要像知识卡片标题，避免空泛',
      '2. 摘要要保留事实、偏好、关系、规则、语气',
      '3. tags 选择可用于检索的短标签',
      '4. importance 和 confidence 使用 0-100 的整数',
      '5. 如果内容更像对话风格或规则，请在 summary 中明确写出'
    ].filter(Boolean)
  }

  private parseChunkPayload(content: string): Partial<{ title: string; summary: string; tags: string[]; importance: number; confidence: number }> {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return {}
    const parsed = safeJsonParse<any>(jsonMatch[0])
    if (!parsed || typeof parsed !== 'object') return {}
    return {
      title: String(parsed.title || '').trim(),
      summary: String(parsed.summary || '').trim(),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map((t: any) => String(t).trim()).filter(Boolean) : [],
      importance: Number.isFinite(Number(parsed.importance)) ? Math.max(0, Math.min(100, Number(parsed.importance))) : 50,
      confidence: Number.isFinite(Number(parsed.confidence)) ? Math.max(0, Math.min(100, Number(parsed.confidence))) : 60
    }
  }

  private async summarizeChunk(lines: string[], snapshot: PersonaSnapshot, sourceSessionIds: string[]): Promise<Partial<{ title: string; summary: string; tags: string[]; importance: number; confidence: number }>> {
    try {
      const prompt = this.buildChunkPrompt(lines, snapshot, sourceSessionIds)
      const resp = await this.callModel(
        [
          { role: 'system', content: '你是一个严格的知识库摘要器，只输出 JSON。' },
          { role: 'user', content: prompt.join('\n') }
        ],
        { maxTokens: 1200, temperature: 0.15, timeoutMs: 90_000 }
      )
      return this.parseChunkPayload(resp)
    } catch {
      const joined = lines.join('\n')
      const preview = joined.slice(0, 160).replace(/\s+/g, ' ').trim()
      return {
        title: preview.slice(0, 18) || '聊天片段',
        summary: preview || '聊天片段摘要',
        tags: [],
        importance: 50,
        confidence: 50
      }
    }
  }

  private buildMemoryItem(snapshot: PersonaSnapshot): PersonaKnowledgeItem | null {
    const parts = [
      snapshot.summary ? `综合画像：${snapshot.summary}` : '',
      snapshot.personality?.traits?.length ? `性格特质：${snapshot.personality.traits.join('、')}` : '',
      snapshot.communicationStyle?.tone ? `语气：${snapshot.communicationStyle.tone}` : '',
      snapshot.communicationStyle?.commonPhrases?.length ? `高频用语：${snapshot.communicationStyle.commonPhrases.join('、')}` : '',
      snapshot.communicationStyle?.sentencePatterns?.length ? `句式特点：${snapshot.communicationStyle.sentencePatterns.join('；')}` : '',
      snapshot.valuesAndMotivations?.length ? `价值观：${snapshot.valuesAndMotivations.join('、')}` : '',
      snapshot.relationshipHints?.length ? `关系提示：${snapshot.relationshipHints.join('；')}` : '',
      snapshot.conversationRules?.length ? `对话规则：${snapshot.conversationRules.join('；')}` : '',
      snapshot.doAndDont?.do?.length ? `应该做：${snapshot.doAndDont.do.join('；')}` : '',
      snapshot.doAndDont?.dont?.length ? `不要做：${snapshot.doAndDont.dont.join('；')}` : '',
      snapshot.exampleReplies?.length ? `示例回复：${snapshot.exampleReplies.join('；')}` : '',
      snapshot.edgeCases?.length ? `边界情况：${snapshot.edgeCases.join('；')}` : ''
    ].filter(Boolean)
    const rawText = parts.join('\n')
    if (!rawText) return null

    return {
      id: `memory-${snapshot.id}`,
      personaId: snapshot.id,
      type: 'memory_item',
      title: '长期人格记忆',
      summary: rawText,
      rawText,
      sourceSessionIds: snapshot.sourceSessionIds || [],
      sourceMessageCount: 0,
      sourceDateRange: { startTime: 0, endTime: 0 },
      tags: snapshot.personality?.traits?.slice(0, 5) || [],
      status: 'pinned',
      importance: 90,
      confidence: 95,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      origin: { mode: 'auto', personaVersion: snapshot.version || 1 }
    }
  }

  private splitMessages(messages: Message[], maxMessages = 40, maxChars = 8000): Message[][] {
    const chunks: Message[][] = []
    let buf: Message[] = []
    let chars = 0
    for (const msg of messages) {
      const line = cleanText(String(msg.parsedContent || msg.rawContent || ''))
      const nextChars = chars + line.length + 1
      if (buf.length >= maxMessages || nextChars >= maxChars) {
        if (buf.length) chunks.push(buf)
        buf = []
        chars = 0
      }
      buf.push(msg)
      chars += line.length + 1
    }
    if (buf.length) chunks.push(buf)
    return chunks
  }

  async ingestPersonaMessages(payload: {
    persona: PersonaSnapshot
    messages: Message[]
    sourceSessionIds: string[]
    sourceSessionId?: string
    scope: PersonaKind
  }): Promise<{ success: boolean; items?: PersonaKnowledgeItem[]; error?: string }> {
    try {
      const messages = payload.messages || []
      if (!messages.length) return { success: true, items: [] }

      const chunks = this.splitMessages(messages)
      const now = Date.now()
      const items: PersonaKnowledgeItem[] = []
      const sourceSessionIds = Array.from(new Set((payload.sourceSessionIds || []).filter(Boolean)))
      const sourceSessionId = payload.sourceSessionId || sourceSessionIds[0] || ''

      for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i]
        const rawLines = chunk.map(m => buildMessageLine(m, payload.scope === 'self' ? '我' : '我', payload.persona.contactName))
        const metaTimes = chunk.map(m => normalizeSourceTime(m.createTime))
        const summary = await this.summarizeChunk(rawLines, payload.persona, sourceSessionIds)
        const rawText = rawLines.join('\n')
        const idSeed = `${payload.persona.id}|${sourceSessionId}|${metaTimes[0] || 0}|${metaTimes[metaTimes.length - 1] || 0}|${hashText(rawText)}`
        const id = `kb-${hashText(idSeed)}`

        const existingIndex = this.store.items.findIndex(item => item.id === id)
        const baseItem: PersonaKnowledgeItem = {
          id,
          personaId: payload.persona.id,
          type: 'source_chunk',
          title: String(summary.title || `片段 ${i + 1}`).trim(),
          summary: String(summary.summary || rawText.slice(0, 200)).trim(),
          rawText,
          sourceSessionIds: sourceSessionIds.length ? sourceSessionIds : (sourceSessionId ? [sourceSessionId] : []),
          sourceMessageCount: chunk.length,
          sourceDateRange: {
            startTime: metaTimes[0] || now,
            endTime: metaTimes[metaTimes.length - 1] || now
          },
          tags: Array.from(new Set((summary.tags || []).map(t => String(t).trim()).filter(Boolean))).slice(0, 8),
          status: 'active',
          importance: Number(summary.importance || 50),
          confidence: Number(summary.confidence || 60),
          createdAt: existingIndex >= 0 ? this.store.items[existingIndex].createdAt : now,
          updatedAt: now,
          origin: { mode: 'auto', chunkIndex: i, personaVersion: payload.persona.version }
        }

        if (existingIndex >= 0) this.store.items[existingIndex] = baseItem
        else this.store.items.push(baseItem)
        items.push(baseItem)
      }

      const memoryItem = this.buildMemoryItem(payload.persona)
      if (memoryItem) {
        const existingMemory = this.store.items.findIndex(item => item.id === memoryItem.id)
        if (existingMemory >= 0) {
          this.store.items[existingMemory] = { ...memoryItem, createdAt: this.store.items[existingMemory].createdAt }
        } else {
          this.store.items.push(memoryItem)
        }
        items.push(memoryItem)
      }

      const sessionSummary = this.buildSessionSummaryItem(payload.persona, items.filter(item => item.type === 'source_chunk'))
      if (sessionSummary) {
        const existingSummary = this.store.items.findIndex(item => item.id === sessionSummary.id)
        if (existingSummary >= 0) {
          this.store.items[existingSummary] = { ...sessionSummary, createdAt: this.store.items[existingSummary].createdAt }
        } else {
          this.store.items.push(sessionSummary)
        }
        items.push(sessionSummary)
      }

      this.persist()
      return { success: true, items }
    } catch (error: any) {
      return { success: false, error: error?.message || '知识库入库失败' }
    }
  }

  private async buildSessionSummaryItem(persona: PersonaSnapshot, chunks: PersonaKnowledgeItem[]): Promise<PersonaKnowledgeItem | null> {
    if (!chunks.length) return null
    const content = chunks.slice(0, 12).map(item => `- ${item.title}：${item.summary}`).join('\n')
    try {
      const resp = await this.callModel(
        [
          { role: 'system', content: '你是对话知识库的二次摘要器，只输出 JSON。' },
          {
            role: 'user',
            content: [
              `分身：${persona.contactName}`,
              '下面是若干聊天片段摘要，请合成一条可检索的会话摘要。',
              '请只输出 JSON，格式如下：',
              '{ "title": "会话主题", "summary": "180字以内摘要", "tags": ["标签"], "importance": 0, "confidence": 0 }',
              '',
              content
            ].join('\n')
          }
        ],
        { maxTokens: 800, temperature: 0.15, timeoutMs: 60_000 }
      )
      const parsed = this.parseChunkPayload(resp)
      const allSessionIds = Array.from(new Set(chunks.flatMap(item => item.sourceSessionIds)))
      const dateRange = chunks.reduce(
        (acc, item) => ({
          startTime: acc.startTime === 0 ? item.sourceDateRange.startTime : Math.min(acc.startTime, item.sourceDateRange.startTime),
          endTime: Math.max(acc.endTime, item.sourceDateRange.endTime)
        }),
        { startTime: 0, endTime: 0 }
      )
      const rawText = content
      const id = `summary-${persona.id}-${hashText(rawText)}`
      return {
        id,
        personaId: persona.id,
        type: 'session_summary',
        title: String(parsed.title || `${persona.contactName} 会话摘要`).trim(),
        summary: String(parsed.summary || rawText).trim(),
        rawText,
        sourceSessionIds: allSessionIds,
        sourceMessageCount: chunks.reduce((sum, item) => sum + item.sourceMessageCount, 0),
        sourceDateRange: dateRange,
        tags: Array.from(new Set((parsed.tags || []).map(t => String(t).trim()).filter(Boolean))).slice(0, 8),
        status: 'active',
        importance: Number(parsed.importance || 55),
        confidence: Number(parsed.confidence || 70),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        origin: { mode: 'auto', personaVersion: persona.version }
      }
    } catch {
      return null
    }
  }

  async listKnowledge(personaId: string): Promise<{ success: boolean; data?: PersonaKnowledgeItem[]; error?: string }> {
    try {
      const data = this.store.items
        .filter(item => item.personaId === personaId)
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === 'pinned' ? -1 : b.status === 'pinned' ? 1 : 0
          return (b.updatedAt || 0) - (a.updatedAt || 0)
        })
      return { success: true, data }
    } catch (error: any) {
      return { success: false, error: error?.message || '获取知识库失败' }
    }
  }

  async updateKnowledgeItem(
    personaId: string,
    itemId: string,
    patch: Partial<Pick<PersonaKnowledgeItem, 'title' | 'summary' | 'rawText' | 'tags' | 'status' | 'importance' | 'confidence'>>
  ): Promise<{ success: boolean; data?: PersonaKnowledgeItem; error?: string }> {
    try {
      const idx = this.store.items.findIndex(item => item.personaId === personaId && item.id === itemId)
      if (idx < 0) return { success: false, error: '未找到知识项' }
      const next = {
        ...this.store.items[idx],
        ...patch,
        updatedAt: Date.now()
      }
      this.store.items[idx] = next
      this.persist()
      return { success: true, data: next }
    } catch (error: any) {
      return { success: false, error: error?.message || '更新知识项失败' }
    }
  }

  async deletePersonaKnowledge(personaId: string): Promise<void> {
    this.store.items = this.store.items.filter(item => item.personaId !== personaId)
    this.store.traces = this.store.traces.filter(trace => trace.personaId !== personaId)
    this.persist()
  }

  async searchKnowledge(personaId: string, query: string, limit = 8): Promise<KnowledgeRetrieval[]> {
    const items = this.store.items.filter(item => item.personaId === personaId && item.status !== 'excluded')
    const qTokens = tokenize(query)
    if (!qTokens.length) return []

    const scored = items.map(item => {
      const titleScore = scoreText(qTokens, item.title, 3)
      const summaryScore = scoreText(qTokens, item.summary, 2)
      const rawScore = scoreText(qTokens, item.rawText, 1)
      const tagScore = scoreText(qTokens, item.tags.join(' '), 2)
      const recencyBoost = item.status === 'pinned' ? 20 : Math.min(10, Math.max(0, (Date.now() - item.updatedAt) / (1000 * 60 * 60 * 24 * 30)))
      const score = titleScore + summaryScore + rawScore + tagScore + (item.importance / 10) + recencyBoost
      const reasonParts = [
        titleScore > 0 ? '标题命中' : '',
        summaryScore > 0 ? '摘要命中' : '',
        rawScore > 0 ? '原文命中' : '',
        tagScore > 0 ? '标签命中' : '',
        item.status === 'pinned' ? '已置顶' : ''
      ].filter(Boolean)
      return {
        item,
        score,
        reason: reasonParts.join('，') || '语义相关'
      }
    })

    return scored
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score || b.item.updatedAt - a.item.updatedAt)
      .slice(0, limit)
      .map(entry => ({
        itemId: entry.item.id,
        title: entry.item.title,
        summary: entry.item.summary,
        score: Number(entry.score.toFixed(2)),
        reason: entry.reason,
        tags: entry.item.tags,
        status: entry.item.status
      }))
  }

  async buildRagContext(personaId: string, query: string, limit = 8): Promise<{ retrievals: KnowledgeRetrieval[]; contextText: string }> {
    const retrievals = await this.searchKnowledge(personaId, query, limit)
    const chunks = retrievals
      .map(item => this.store.items.find(source => source.id === item.itemId))
      .filter(Boolean) as PersonaKnowledgeItem[]

    const contextText = chunks
      .map(item => [
        `- ${item.title}（${item.type === 'memory_item' ? '长期记忆' : item.type === 'session_summary' ? '会话摘要' : '原始片段'}）`,
        `  摘要：${item.summary}`,
        item.rawText && item.rawText !== item.summary ? `  原文：${item.rawText.slice(0, 1500)}` : ''
      ].filter(Boolean).join('\n'))
      .join('\n\n')

    return { retrievals, contextText }
  }

  async recordAnswerTrace(payload: {
    personaId: string
    question: string
    answer: string
    retrievals: KnowledgeRetrieval[]
    source: 'chat' | 'generateReply'
  }): Promise<void> {
    const trace: PersonaAnswerTrace = {
      id: `trace-${randomUUID()}`,
      personaId: payload.personaId,
      question: cleanText(payload.question),
      answer: cleanText(payload.answer),
      retrievals: payload.retrievals || [],
      createdAt: Date.now(),
      source: payload.source
    }
    this.store.traces.unshift(trace)
    this.store.traces = this.store.traces.slice(0, 1000)
    this.persist()
  }

  async listAnswerTraces(personaId: string): Promise<{ success: boolean; data?: PersonaAnswerTrace[]; error?: string }> {
    try {
      return { success: true, data: this.store.traces.filter(trace => trace.personaId === personaId) }
    } catch (error: any) {
      return { success: false, error: error?.message || '获取回答证据失败' }
    }
  }
}

export const personaKnowledgeService = new AiPersonaKnowledgeService()
