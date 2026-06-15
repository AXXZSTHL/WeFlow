import { join, dirname } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { randomUUID, createHash } from 'crypto'
import https from 'https'
import http from 'http'
import { URL } from 'url'
import { chatService, Message } from './chatService'
import { ConfigService } from './config'
import { getPathFallback } from './electronRuntime'
import { CHAT_SYSTEM_PROMPT, PERSONA_CHUNK_EXTRACT_PROMPT, PERSONA_GENERATION_PROMPT } from './aiPersonaPrompts'
import { personaKnowledgeService } from './aiPersonaKnowledgeService'

interface AiPersonaProfile {
  id: string
  kind?: 'contact' | 'self'
  sessionId: string
  contactName: string
  avatarUrl?: string
  sourceMessageCount: number
  sourceDateRange: { startTime: number; endTime: number }
  summary: string
  personality: {
    traits: string[]
    ocean?: {
      openness: number
      conscientiousness: number
      extraversion: number
      agreeableness: number
      neuroticism: number
    }
  }
  communicationStyle: {
    tone: string
    sentencePatterns: string[]
    emojiHabits: string[]
    responseLength: string
    commonPhrases: string[]
  }
  valuesAndMotivations: string[]
  relationshipHints: string[]
  conversationRules: string[]
  doAndDont?: { do: string[]; dont: string[] }
  exampleReplies?: string[]
  edgeCases?: string[]
  sourceSessionIds?: string[]
  sourceSessionProgress?: Record<string, number>
  promptSkill: string
  createdAt: number
  updatedAt: number
  version: number
}

interface AiPersonaConversation {
  id: string
  personaId: string
  title: string
  messages: Array<{
    id: string
    role: 'user' | 'assistant'
    content: string
    createdAt: number
  }>
  createdAt: number
  updatedAt: number
}

interface PersonaListItem {
  id: string
  kind?: 'contact' | 'self'
  sessionId: string
  contactName: string
  avatarUrl?: string
  sourceMessageCount: number
  updatedAt: number
  profileCompleteness: number
  tags: string[]
  createdAt: number
}

interface CreatePersonaOptions {
  dateRange: 'all' | '1year' | '6months' | 'custom'
  customStartTime?: number
  customEndTime?: number
}

interface CreateSelfPersonaOptions extends CreatePersonaOptions {
  sessionIds: string[]
}

interface PersonaStore {
  version: number
  personas: AiPersonaProfile[]
  conversations: AiPersonaConversation[]
}

type PersonaChunkInsight = {
  traits?: string[]
  tone?: string
  commonPhrases?: string[]
  emojiHabits?: string[]
  sentencePatterns?: string[]
  valuesAndMotivations?: string[]
  relationshipHints?: string[]
  conversationRules?: string[]
  evidence?: string[]
}

function isWxid(s: string): boolean {
  return /^wxid_[a-z0-9]+$/i.test(String(s || '').trim()) || /^[a-z0-9_]+@chatroom$/i.test(String(s || '').trim())
}

function formatTs(createTime: number): string {
  const ms = createTime > 1_000_000_000_000 ? createTime : createTime * 1000
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function clean(s: string) { return String(s || '').replace(/\r\n/g, '\n').replace(/\0/g, '').trim() }
function isXml(s: string) { return /^(<\?xml|<msg\b|<appmsg\b|&lt;\?xml|&lt;msg\b)/i.test(String(s || '').trim()) }

function fmtMsg(msg: Message, myName: string, peer: string): string {
  const sender = msg.isSend === 1 ? myName : peer
  let content = clean(String(msg.parsedContent || ''))
  if (!content) { const raw = clean(String(msg.rawContent || '')); if (raw && !isXml(raw)) content = raw }
  // Normalized fallback (some legacy strings in this file were mojibake-corrupted).
  if (!content) content = '[非文本消息]'
  if (!content) content = '[非文本消息]'
  return `${formatTs(msg.createTime)} ${sender}: ${content}`
}

/* Legacy prompt constants below were previously used, but may be corrupted.
 * We now import prompts from `aiPersonaPrompts.ts`.
 */
const PERSONA_GENERATION_PROMPT_LEGACY = `你是一位专业的对话行为分析师。请基于以下聊天记录，为联系人创建一份结构化的人格档案。

请严格按照以下 JSON 格式输出（不要输出其他内容）：

{
  "summary": "一段200字以内的综合描述",
  "personality": {
    "traits": ["特质1", "特质2", "特质3", "特质4", "特质5"],
    "ocean": {
      "openness": 0.0到1.0的数值,
      "conscientiousness": 0.0到1.0的数值,
      "extraversion": 0.0到1.0的数值,
      "agreeableness": 0.0到1.0的数值,
      "neuroticism": 0.0到1.0的数值
    }
  },
  "communicationStyle": {
    "tone": "整体语气描述，如：温暖直接、理性克制",
    "sentencePatterns": ["句式特点1", "句式特点2", "句式特点3"],
    "emojiHabits": ["常用表情习惯1", "常用表情习惯2"],
    "responseLength": "简短/中等/长篇",
    "commonPhrases": ["高频用语1", "高频用语2", "高频用语3"]
  },
  "valuesAndMotivations": ["价值观1", "价值观2", "价值观3"],
  "relationshipHints": ["关系建议1", "关系建议2", "关系建议3"],
  "conversationRules": ["对话规则1", "对话规则2", "对话规则3", "对话规则4", "对话规则5"]
}

分析要求：
1. 每个结论都应基于聊天记录中的具体对话模式
2. 性格特质要具体，不要笼统
3. 语言习惯要包含句式、表情、回复长度等具体特征
4. 价值观和动机要从对话内容中推断
5. 对话规则用于后续模拟对话
6. 只使用中文输出`

const CHAT_SYSTEM_PROMPT_LEGACY = `你正在模拟一个人格分身进行对话。请严格遵守以下规则：

1. 你只能基于下面提供的人格档案和聊天证据来模拟回应
2. 不要声称自己就是真实联系人本人
3. 保持该联系人的语言风格、句式习惯和用词偏好
4. 遇到档案中没有的信息要自然表达不确定，可以说"我不太确定"、"这个说不好"
5. 不输出隐私猜测、控制建议、危险建议
6. 可以适度提醒用户这只是模拟
7. 回复长度应与该联系人的习惯一致
8. 使用中文回复`

const PERSONA_CHUNK_EXTRACT_PROMPT_LEGACY = `浣犳槸涓€浣嶄笓涓氱殑瀵硅瘽琛屼负鍒嗘瀽甯堛€備綘灏嗚鍒拌亨澶╄褰曠殑涓€涓垎娈碉紝璇蜂粠涓彁鍙栧彲澶嶇敤鐨勭壒寰佷俊鎭紝鐢ㄤ互鍚庣殑鍚堝苟姒傛嫭銆?

璇蜂弗鏍兼寜 JSON 杈撳嚭锛堜笉瑕佽緭鍑哄叾浠栫殑鍐呭锛夛紝瀛楁涓嶈澶氾紝鍐呭瑕佸叿浣撳彲鎵ц锛屼笉瑕佺┖娲炲璇濄€?

{
  "traits": ["..."],
  "tone": "...",
  "commonPhrases": ["..."],
  "emojiHabits": ["..."],
  "sentencePatterns": ["..."],
  "valuesAndMotivations": ["..."],
  "relationshipHints": ["..."],
  "conversationRules": ["..."],
  "evidence": ["..."]
}

鍙傛暟瑕佹眰锛?
1. traits <= 8
2. commonPhrases <= 10
3. emojiHabits <= 6
4. sentencePatterns <= 8
5. valuesAndMotivations <= 6
6. relationshipHints <= 6
7. conversationRules <= 8
8. evidence <= 6锛屾瘡鏉?<= 80 瀛楋紝寮曠敤褰撳墠鍒嗘涓殑鍘熻瘽鐗囨
9. 宁缺毋滥锛屼笉纭畾灏辫繑鍥炵┖鏁扮粍`

class AiPersonaService {
  private storePath: string
  private store: PersonaStore

  constructor() {
    const baseDir = getPathFallback('userData')
    mkdirSync(baseDir, { recursive: true })
    this.storePath = join(baseDir, 'ai-personas.json')
    this.store = { version: 1, personas: [], conversations: [] }
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
          personas: Array.isArray(parsed.personas) ? parsed.personas : [],
          conversations: Array.isArray(parsed.conversations) ? parsed.conversations : []
        }
      }
    } catch {
      this.store = { version: 1, personas: [], conversations: [] }
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.storePath), { recursive: true })
    writeFileSync(this.storePath, JSON.stringify(this.store, null, 2), 'utf8')
  }

  private async getName(sessionId: string): Promise<string> {
    try {
      const c = await chatService.getContactAvatar(sessionId)
      const n = c?.displayName || ''
      if (n && !isWxid(n)) return n
    } catch { /* ignore */ }
    return sessionId
  }

  private async getAvatarUrl(sessionId: string): Promise<string | undefined> {
    try {
      const c = await chatService.getContactAvatar(sessionId)
      return c?.avatarUrl
    } catch { return undefined }
  }

  private getMessageTimeMs(msg: Message): number {
    return msg.createTime > 1_000_000_000_000 ? msg.createTime : msg.createTime * 1000
  }

  private isMyMessage(msg: Message, myWxid: string): boolean {
    if (msg.isSend === 1) return true
    const sender = String(msg.senderUsername || '').trim()
    if (!sender || !myWxid) return false
    return sender === myWxid
  }

  private async createContactPersonaIncremental(
    sessionId: string,
    options: CreatePersonaOptions
  ): Promise<{ success: boolean; data?: AiPersonaProfile; error?: string }> {
    if (!sessionId) return { success: false, error: '缺少会话 ID' }

    const existing = this.store.personas.find(p => p.sessionId === sessionId)
    if (existing) return { success: false, error: '该联系人已生成过 AI 分身，请使用更新功能' }

    const cr = await chatService.connect()
    if (!cr.success) return { success: false, error: '数据库连接失败' }

    const msgs = await this.getMessages(sessionId, options)
    if (!msgs.length) return { success: false, error: '未找到符合条件的聊天记录' }

    const peer = await this.getName(sessionId) || '对方'
    const avatarUrl = await this.getAvatarUrl(sessionId)
    const isGroup = sessionId.endsWith('@chatroom')
    const parsedRes = await this.generatePersonaFromMessages(msgs, peer, isGroup)
    if (!parsedRes.success) return { success: false, error: parsedRes.error || 'AI 生成失败' }

    const now = Date.now()
    const timestamps = msgs.map(m => this.getMessageTimeMs(m)).sort((a, b) => a - b)
    const progressTime = timestamps[timestamps.length - 1] || now
    const parsed = parsedRes.data || {}

    const persona: AiPersonaProfile = {
      id: randomUUID(),
      kind: 'contact',
      sessionId,
      contactName: peer,
      avatarUrl,
      sourceMessageCount: msgs.length,
      sourceDateRange: {
        startTime: timestamps[0] || now,
        endTime: progressTime
      },
      summary: parsed.summary || '',
      personality: parsed.personality || { traits: [] },
      communicationStyle: parsed.communicationStyle || { tone: '', sentencePatterns: [], emojiHabits: [], responseLength: '', commonPhrases: [] },
      valuesAndMotivations: parsed.valuesAndMotivations || [],
      relationshipHints: parsed.relationshipHints || [],
      conversationRules: parsed.conversationRules || [],
      sourceSessionIds: [sessionId],
      sourceSessionProgress: { [sessionId]: progressTime },
      promptSkill: this.buildPromptSkillV2(parsed, peer),
      createdAt: now,
      updatedAt: now,
      version: 1
    }

    this.store.personas.push(persona)
    this.persist()
    await personaKnowledgeService.ingestPersonaMessages({
      persona,
      messages: msgs,
      sourceSessionIds: [sessionId],
      sourceSessionId: sessionId,
      scope: 'contact'
    })
    return { success: true, data: persona }
  }

  private async createSelfPersonaIncremental(
    options: CreateSelfPersonaOptions
  ): Promise<{ success: boolean; data?: AiPersonaProfile; error?: string }> {
    const sessionIds = Array.from(new Set((options.sessionIds || []).map(id => String(id || '').trim()).filter(Boolean)))
    if (!sessionIds.length) return { success: false, error: '请至少选择一个会话' }

    const cr = await chatService.connect()
    if (!cr.success) return { success: false, error: '数据库连接失败' }

    const myWxid = String(ConfigService.getInstance().get('myWxid') || '').trim()
    const selectedSessions: Array<{
      sessionId: string
      peerName: string
      messages: Message[]
      progressTime: number
    }> = []

    for (const sessionId of sessionIds) {
      const msgs = await this.getMessages(sessionId, options)
      if (!msgs.length) continue

      const selfMsgs = msgs.filter(msg => this.isMyMessage(msg, myWxid))
      if (!selfMsgs.length) continue

      selectedSessions.push({
        sessionId,
        peerName: await this.getName(sessionId),
        messages: selfMsgs,
        progressTime: msgs.reduce((max, msg) => Math.max(max, this.getMessageTimeMs(msg)), 0)
      })
    }

    const flattenedMessages = selectedSessions.flatMap(item => item.messages)
    if (!flattenedMessages.length) {
      return { success: false, error: '没有找到可用于生成“我的分身”的本人发言记录' }
    }

    const parsedRes = await this.generatePersonaFromMessages(flattenedMessages, '我', false)
    if (!parsedRes.success) return { success: false, error: parsedRes.error || 'AI 生成失败' }

    const now = Date.now()
    const timestamps = flattenedMessages.map(m => this.getMessageTimeMs(m)).sort((a, b) => a - b)
    const sessionHash = createHash('sha1').update(sessionIds.slice().sort().join('|')).digest('hex').slice(0, 12)
    const parsed = parsedRes.data || {}

    const persona: AiPersonaProfile = {
      id: randomUUID(),
      kind: 'self',
      sessionId: `self::${sessionHash}`,
      contactName: '我的AI分身',
      avatarUrl: await this.getAvatarUrl(myWxid || sessionIds[0]),
      sourceMessageCount: flattenedMessages.length,
      sourceDateRange: {
        startTime: timestamps[0] || now,
        endTime: timestamps[timestamps.length - 1] || now
      },
      summary: parsed.summary || '',
      personality: parsed.personality || { traits: [] },
      communicationStyle: parsed.communicationStyle || { tone: '', sentencePatterns: [], emojiHabits: [], responseLength: '', commonPhrases: [] },
      valuesAndMotivations: parsed.valuesAndMotivations || [],
      relationshipHints: parsed.relationshipHints || [],
      conversationRules: parsed.conversationRules || [],
      doAndDont: parsed.doAndDont,
      exampleReplies: parsed.exampleReplies,
      edgeCases: parsed.edgeCases,
      sourceSessionIds: selectedSessions.map(item => item.sessionId),
      sourceSessionProgress: Object.fromEntries(selectedSessions.map(item => [item.sessionId, item.progressTime])),
      promptSkill: this.buildPromptSkillV2(parsed, '我'),
      createdAt: now,
      updatedAt: now,
      version: 1
    }

    this.store.personas.push(persona)
    this.persist()
    await personaKnowledgeService.ingestPersonaMessages({
      persona,
      messages: flattenedMessages,
      sourceSessionIds: selectedSessions.map(item => item.sessionId),
      scope: 'self'
    })
    return { success: true, data: persona }
  }

  private async updateContactPersonaIncremental(
    oldPersona: AiPersonaProfile,
    options: CreatePersonaOptions
  ): Promise<{ success: boolean; data?: AiPersonaProfile; error?: string }> {
    const cr = await chatService.connect()
    if (!cr.success) return { success: false, error: '数据库连接失败' }

    const sessionId = oldPersona.sessionId
    const progressMap = { ...(oldPersona.sourceSessionProgress || {}) }
    const sinceTime = progressMap[sessionId] || 0

    let msgs: Message[] = []
    if (sinceTime > 0) {
      const incrementalResult = await chatService.getNewMessages(sessionId, sinceTime, 500)
      if (incrementalResult.success && incrementalResult.messages?.length) {
        msgs = incrementalResult.messages
      }
    } else {
      msgs = await this.getMessages(sessionId, options)
    }

    if (!msgs.length) return { success: true, data: oldPersona }

    const peer = oldPersona.contactName
    const isGroup = sessionId.endsWith('@chatroom')
    const parsedRes = await this.generatePersonaFromMessages(msgs, peer, isGroup)
    if (!parsedRes.success) return { success: false, error: parsedRes.error || 'AI 生成失败' }

    const now = Date.now()
    const timestamps = msgs.map(m => this.getMessageTimeMs(m)).sort((a, b) => a - b)
    const progressTime = timestamps[timestamps.length - 1] || sinceTime
    const lastEnd = Math.max(oldPersona.sourceDateRange?.endTime || 0, progressTime)
    const parsed = parsedRes.data || {}

    const updated: AiPersonaProfile = {
      ...oldPersona,
      summary: parsed.summary || oldPersona.summary,
      personality: parsed.personality || oldPersona.personality,
      communicationStyle: parsed.communicationStyle || oldPersona.communicationStyle,
      valuesAndMotivations: parsed.valuesAndMotivations || oldPersona.valuesAndMotivations,
      relationshipHints: parsed.relationshipHints || oldPersona.relationshipHints,
      conversationRules: parsed.conversationRules || oldPersona.conversationRules,
      promptSkill: this.buildPromptSkillV2(parsed, peer),
      sourceMessageCount: oldPersona.sourceMessageCount + msgs.length,
      sourceDateRange: {
        startTime: oldPersona.sourceDateRange?.startTime || timestamps[0] || now,
        endTime: lastEnd || now
      },
      sourceSessionIds: oldPersona.sourceSessionIds || [sessionId],
      sourceSessionProgress: {
        ...progressMap,
        [sessionId]: progressTime
      },
      updatedAt: now,
      version: oldPersona.version + 1
    }

    this.store.personas[this.store.personas.findIndex(p => p.id === oldPersona.id)] = updated
    this.persist()
    await personaKnowledgeService.ingestPersonaMessages({
      persona: updated,
      messages: msgs,
      sourceSessionIds: [sessionId],
      sourceSessionId: sessionId,
      scope: 'contact'
    })
    return { success: true, data: updated }
  }

  private async updateSelfPersonaIncremental(
    oldPersona: AiPersonaProfile,
    options: CreatePersonaOptions
  ): Promise<{ success: boolean; data?: AiPersonaProfile; error?: string }> {
    const sourceSessionIds = oldPersona.sourceSessionIds || []
    if (!sourceSessionIds.length) return { success: false, error: '该“我的分身”没有可回放的来源会话' }

    const cr = await chatService.connect()
    if (!cr.success) return { success: false, error: '数据库连接失败' }

    const myWxid = String(ConfigService.getInstance().get('myWxid') || '').trim()
    const flattenedMessages: Message[] = []
    const nextProgress: Record<string, number> = { ...(oldPersona.sourceSessionProgress || {}) }

    for (const sessionId of sourceSessionIds) {
      const sinceTime = nextProgress[sessionId] || 0
      let sessionMessages: Message[] = []

      if (sinceTime > 0) {
        const incrementalResult = await chatService.getNewMessages(sessionId, sinceTime, 500)
        if (incrementalResult.success && incrementalResult.messages?.length) {
          sessionMessages = incrementalResult.messages
        }
      } else {
        sessionMessages = await this.getMessages(sessionId, options)
      }

      if (!sessionMessages.length) continue

      const selfMsgs = sessionMessages.filter(msg => this.isMyMessage(msg, myWxid))
      const progressTime = sessionMessages.reduce((max, msg) => Math.max(max, this.getMessageTimeMs(msg)), sinceTime)
      if (progressTime > sinceTime) nextProgress[sessionId] = progressTime

      if (!selfMsgs.length) continue
      flattenedMessages.push(...selfMsgs)
    }

    if (!flattenedMessages.length) return { success: true, data: oldPersona }

    const parsedRes = await this.generatePersonaFromMessages(flattenedMessages, '我', false)
    if (!parsedRes.success) return { success: false, error: parsedRes.error || 'AI 生成失败' }

    const now = Date.now()
    const timestamps = flattenedMessages.map(m => this.getMessageTimeMs(m)).sort((a, b) => a - b)
    const progressTime = timestamps[timestamps.length - 1] || oldPersona.sourceDateRange?.endTime || now
    const lastEnd = Math.max(oldPersona.sourceDateRange?.endTime || 0, progressTime)
    const parsed = parsedRes.data || {}

    const updated: AiPersonaProfile = {
      ...oldPersona,
      kind: 'self',
      sourceMessageCount: oldPersona.sourceMessageCount + flattenedMessages.length,
      sourceDateRange: {
        startTime: oldPersona.sourceDateRange?.startTime || timestamps[0] || now,
        endTime: lastEnd || now
      },
      summary: parsed.summary || oldPersona.summary,
      personality: parsed.personality || oldPersona.personality,
      communicationStyle: parsed.communicationStyle || oldPersona.communicationStyle,
      valuesAndMotivations: parsed.valuesAndMotivations || oldPersona.valuesAndMotivations,
      relationshipHints: parsed.relationshipHints || oldPersona.relationshipHints,
      conversationRules: parsed.conversationRules || oldPersona.conversationRules,
      doAndDont: parsed.doAndDont || oldPersona.doAndDont,
      exampleReplies: parsed.exampleReplies || oldPersona.exampleReplies,
      edgeCases: parsed.edgeCases || oldPersona.edgeCases,
      sourceSessionIds,
      sourceSessionProgress: nextProgress,
      promptSkill: this.buildPromptSkillV2(parsed, '我'),
      updatedAt: now,
      version: oldPersona.version + 1
    }

    this.store.personas[this.store.personas.findIndex(p => p.id === oldPersona.id)] = updated
    this.persist()
    await personaKnowledgeService.ingestPersonaMessages({
      persona: updated,
      messages: flattenedMessages,
      sourceSessionIds: sourceSessionIds,
      scope: 'self'
    })
    return { success: true, data: updated }
  }

  private computeCompleteness(profile: AiPersonaProfile): number {
    let score = 0
    let total = 0
    const check = (val: unknown) => { total++; if (val) score++ }
    check(profile.summary?.length > 10)
    check(profile.personality?.traits?.length > 0)
    check(profile.personality?.ocean)
    check(profile.communicationStyle?.tone?.length > 0)
    check(profile.communicationStyle?.sentencePatterns?.length > 0)
    check(profile.communicationStyle?.commonPhrases?.length > 0)
    check(profile.valuesAndMotivations?.length > 0)
    check(profile.relationshipHints?.length > 0)
    check(profile.conversationRules?.length > 0)
    check(profile.promptSkill?.length > 50)
    return Math.round((score / Math.max(total, 1)) * 100)
  }

  async listPersonas(): Promise<{ success: boolean; data?: PersonaListItem[]; error?: string }> {
    try {
      const items: PersonaListItem[] = this.store.personas.map(p => ({
        id: p.id,
        kind: p.kind || 'contact',
        sessionId: p.sessionId,
        contactName: p.contactName,
        avatarUrl: p.avatarUrl,
        sourceMessageCount: p.sourceMessageCount,
        updatedAt: p.updatedAt,
        profileCompleteness: this.computeCompleteness(p),
        tags: p.personality?.traits?.slice(0, 3) || [],
        createdAt: p.createdAt
      }))
      items.sort((a, b) => b.updatedAt - a.updatedAt)
      return { success: true, data: items }
    } catch (e: any) {
      return { success: false, error: e.message || '获取分身列表失败' }
    }
  }

  async getPersona(id: string): Promise<{ success: boolean; data?: AiPersonaProfile; error?: string }> {
    try {
      const persona = this.store.personas.find(p => p.id === id)
      if (!persona) return { success: false, error: '分身不存在' }
      return { success: true, data: persona }
    } catch (e: any) {
      return { success: false, error: e.message || '获取分身详情失败' }
    }
  }

  async getPersonaBySession(sessionId: string): Promise<{ success: boolean; data?: AiPersonaProfile; error?: string }> {
    try {
      const persona = this.store.personas.find(p => p.sessionId === sessionId)
      if (!persona) return { success: false, error: '未找到该会话的分身' }
      return { success: true, data: persona }
    } catch (e: any) {
      return { success: false, error: e.message || '获取分身失败' }
    }
  }

  async createPersona(
    sessionId: string,
    options: CreatePersonaOptions
  ): Promise<{ success: boolean; data?: AiPersonaProfile; error?: string }> {
    return this.createContactPersonaIncremental(sessionId, options)
    if (!sessionId) return { success: false, error: '缺少会话 ID' }

    try {
      const existing = this.store.personas.find(p => p.sessionId === sessionId)
      if (existing) return { success: false, error: '该联系人已生成过 AI 分身，请使用更新功能' }

      const cr = await chatService.connect()
      if (!cr.success) return { success: false, error: '数据库连接失败' }

      const msgs = await this.getMessages(sessionId, options)
      if (!msgs.length) return { success: false, error: '未找到符合条件的聊天记录' }

      const peer = await this.getName(sessionId) || '对方'
      const avatarUrl = await this.getAvatarUrl(sessionId)

      // Generate persona profile via chunked extraction/merge to avoid context truncation
      const isGroup = sessionId.endsWith('@chatroom')
      const parsedRes = await this.generatePersonaFromMessages(msgs, peer, isGroup)
      if (!parsedRes.success) return { success: false, error: parsedRes.error || 'AI 生成失败' }
      const aiResult = parsedRes.success
        ? { success: true, data: { content: JSON.stringify(parsedRes.data || {}) } }
        : { success: false, error: parsedRes.error || 'AI 鐢熸垚澶辫触' }

      if (!parsedRes.success) {
        return { success: false, error: parsedRes.error || 'AI 生成失败' }
        return { success: false, error: aiResult.error || 'AI 生成失败' }
      }

      const parsed = parsedRes.data || {}
      const now = Date.now()
      const timestamps = msgs.map(m => m.createTime > 1_000_000_000_000 ? m.createTime : m.createTime * 1000).sort((a, b) => a - b)

      const persona: AiPersonaProfile = {
        id: randomUUID(),
        kind: 'contact',
        sessionId,
        contactName: peer,
        avatarUrl,
        sourceMessageCount: msgs.length,
        sourceDateRange: {
          startTime: timestamps[0] || now,
          endTime: timestamps[timestamps.length - 1] || now
        },
        summary: parsed.summary || '',
        personality: parsed.personality || { traits: [] },
        communicationStyle: parsed.communicationStyle || { tone: '', sentencePatterns: [], emojiHabits: [], responseLength: '', commonPhrases: [] },
        valuesAndMotivations: parsed.valuesAndMotivations || [],
        relationshipHints: parsed.relationshipHints || [],
        conversationRules: parsed.conversationRules || [],
        promptSkill: this.buildPromptSkillV2(parsed, peer),
        createdAt: now,
        updatedAt: now,
        version: 1
      }

      this.store.personas.push(persona)
      this.persist()
      return { success: true, data: persona }
    } catch (e: any) {
      return { success: false, error: e.message || '生成分身失败' }
    }
  }

  async createSelfPersona(
    options: CreateSelfPersonaOptions
  ): Promise<{ success: boolean; data?: AiPersonaProfile; error?: string }> {
    return this.createSelfPersonaIncremental(options)
  }

  async updateSelfPersona(
    id: string,
    options: CreatePersonaOptions
  ): Promise<{ success: boolean; data?: AiPersonaProfile; error?: string }> {
    const idx = this.store.personas.findIndex(p => p.id === id)
    if (idx === -1) return { success: false, error: '分身不存在' }
    return this.updateSelfPersonaIncremental(this.store.personas[idx], options)
  }

  async updatePersona(
    id: string,
    options: CreatePersonaOptions
  ): Promise<{ success: boolean; data?: AiPersonaProfile; error?: string }> {
    try {
      const idx = this.store.personas.findIndex(p => p.id === id)
      if (idx === -1) return { success: false, error: '分身不存在' }

      const oldPersona = this.store.personas[idx]
      if (oldPersona.kind === 'self') {
        return this.updateSelfPersona(id, options)
      }
      return this.updateContactPersonaIncremental(oldPersona, options)
    } catch (e: any) {
      return { success: false, error: e.message || '更新分身失败' }
    }
  }

  async deletePersona(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const idx = this.store.personas.findIndex(p => p.id === id)
      if (idx === -1) return { success: false, error: '分身不存在' }
      this.store.personas.splice(idx, 1)
      // Also remove associated conversations
      this.store.conversations = this.store.conversations.filter(c => c.personaId !== id)
      await personaKnowledgeService.deletePersonaKnowledge(id)
      this.persist()
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message || '删除分身失败' }
    }
  }

  async updatePromptSkill(id: string, promptSkill: string): Promise<{ success: boolean; data?: AiPersonaProfile; error?: string }> {
    try {
      const idx = this.store.personas.findIndex(p => p.id === id)
      if (idx === -1) return { success: false, error: '分身不存在' }
      this.store.personas[idx] = {
        ...this.store.personas[idx],
        promptSkill,
        updatedAt: Date.now(),
        version: this.store.personas[idx].version + 1
      }
      this.persist()
      return { success: true, data: this.store.personas[idx] }
    } catch (e: any) {
      return { success: false, error: e.message || '更新 skill 失败' }
    }
  }

  async updatePersonaField(
    id: string,
    field: string,
    value: unknown
  ): Promise<{ success: boolean; data?: AiPersonaProfile; error?: string }> {
    try {
      const idx = this.store.personas.findIndex(p => p.id === id)
      if (idx === -1) return { success: false, error: '分身不存在' }
      const persona = this.store.personas[idx]
      const updated = { ...persona, [field]: value, updatedAt: Date.now(), version: persona.version + 1 }
      this.store.personas[idx] = updated
      this.persist()
      return { success: true, data: updated }
    } catch (e: any) {
      return { success: false, error: e.message || '更新字段失败' }
    }
  }

  // Conversation management
  async getConversation(personaId: string): Promise<{ success: boolean; data?: AiPersonaConversation; error?: string }> {
    try {
      let conv = this.store.conversations.find(c => c.personaId === personaId)
      if (!conv) {
        conv = {
          id: randomUUID(),
          personaId,
          title: '新对话',
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        this.store.conversations.push(conv)
        this.persist()
      }
      return { success: true, data: conv }
    } catch (e: any) {
      return { success: false, error: e.message || '获取对话失败' }
    }
  }

  async chatWithPersona(
    personaId: string,
    userMessage: string
  ): Promise<{ success: boolean; data?: { content: string }; error?: string }> {
    try {
      const persona = this.store.personas.find(p => p.id === personaId)
      if (!persona) return { success: false, error: '分身不存在' }

      // Get or create conversation
      let conv = this.store.conversations.find(c => c.personaId === personaId)
      if (!conv) {
        conv = {
          id: randomUUID(),
          personaId,
          title: userMessage.slice(0, 30),
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        this.store.conversations.push(conv)
      }

      // Save user message
      const userMsg = {
        id: randomUUID(),
        role: 'user' as const,
        content: userMessage,
        createdAt: Date.now()
      }
      conv.messages.push(userMsg)

      // Build context from last 20 messages
      const recentMsgs = conv.messages.slice(-20)
      const contextText = recentMsgs.map(m =>
        `${m.role === 'user' ? '用户' : persona.contactName}: ${m.content}`
      ).join('\n')
      const knowledgePack = await personaKnowledgeService.buildRagContext(personaId, userMessage, 8)

      // Build prompt
      const userPrompt = [
        `以下是 ${persona.contactName} 的人格档案：`,
        `- 性格特质：${persona.personality.traits.join('、')}`,
        `- 语言风格：${persona.communicationStyle.tone}`,
        `- 常用短语：${persona.communicationStyle.commonPhrases.join('、')}`,
        `- 回复长度习惯：${persona.communicationStyle.responseLength}`,
        persona.communicationStyle.sentencePatterns.length ? `- 句式特点：${persona.communicationStyle.sentencePatterns.join('；')}` : '',
        persona.valuesAndMotivations.length ? `- 价值观：${persona.valuesAndMotivations.join('、')}` : '',
        persona.relationshipHints.length ? `- 关系提示：${persona.relationshipHints.join('；')}` : '',
        persona.conversationRules.length ? `- 对话规则：${persona.conversationRules.join('；')}` : '',
        '',
        knowledgePack.contextText ? `知识库命中：\n${knowledgePack.contextText}\n` : '',
        contextText ? `对话历史：\n${contextText}\n` : '',
        `用户: ${userMessage}`,
        `\n请以 ${persona.contactName} 的身份回复（记住：你只是在模拟，不是真实本人）：`
      ].filter(Boolean).join('\n')

      const cfg = ConfigService.getInstance()
      const apiBaseUrl = String(cfg.get('aiModelApiBaseUrl') || cfg.get('aiInsightApiBaseUrl') || '').trim()
      const apiKey = String(cfg.get('aiModelApiKey') || cfg.get('aiInsightApiKey') || '').trim()
      const model = String(cfg.get('aiModelApiModel') || cfg.get('aiInsightApiModel') || 'gpt-4o-mini').trim() || 'gpt-4o-mini'

      if (!apiBaseUrl || !apiKey) return { success: false, error: '请先在设置中配置 AI 模型' }

      // Use the same API call pattern as aiService

      const endpoint = apiBaseUrl.replace(/\/+$/, '') + '/chat/completions'
      const urlObj = new URL(endpoint)
      const body = JSON.stringify({
        model,
        messages: [
          { role: 'system', content: CHAT_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1024,
        temperature: 0.8,
        stream: false
      })

      const result = await new Promise<string>((resolve, reject) => {
        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: 'POST' as const,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body).toString(),
            Authorization: `Bearer ${apiKey}`
          }
        }
        const req = (urlObj.protocol === 'https:' ? https.request : http.request)(options, (res: any) => {
          let data = ''
          res.on('data', (chunk: any) => { data += chunk })
          res.on('end', () => {
            try {
              const content = JSON.parse(data)?.choices?.[0]?.message?.content
              if (typeof content === 'string' && content.trim()) resolve(content.trim())
              else reject(new Error(`API 返回异常: ${data.slice(0, 200)}`))
            } catch { reject(new Error(`JSON 解析失败: ${data.slice(0, 200)}`)) }
          })
        })
        req.setTimeout(60000, () => { req.destroy(); reject(new Error('API 超时')) })
        req.on('error', (e: any) => reject(e))
        req.write(body)
        req.end()
      })

      // Save assistant response
      const assistantMsg = {
        id: randomUUID(),
        role: 'assistant' as const,
        content: result,
        createdAt: Date.now()
      }
      conv.messages.push(assistantMsg)
      conv.updatedAt = Date.now()
      if (conv.messages.length <= 2) {
        conv.title = userMessage.slice(0, 30)
      }
      this.persist()
      await personaKnowledgeService.recordAnswerTrace({
        personaId,
        question: userMessage,
        answer: result,
        retrievals: knowledgePack.retrievals,
        source: 'chat'
      })

      return { success: true, data: { content: result } }
    } catch (e: any) {
      return { success: false, error: e.message || '对话失败' }
    }
  }

  async generateReplyWithPersona(
    personaId: string,
    goal: string,
    contextMessages: Array<{ isSend: boolean; content: string; createTime: number }>,
    draftText?: string,
    toneOverride?: string
  ): Promise<{ success: boolean; data?: { content: string }; error?: string }> {
    try {
      const persona = this.store.personas.find(p => p.id === personaId)
      if (!persona) return { success: false, error: '分身不存在' }

      const cfg = ConfigService.getInstance()
      const apiBaseUrl = String(cfg.get('aiModelApiBaseUrl') || cfg.get('aiInsightApiBaseUrl') || '').trim()
      const apiKey = String(cfg.get('aiModelApiKey') || cfg.get('aiInsightApiKey') || '').trim()
      const model = String(cfg.get('aiModelApiModel') || cfg.get('aiInsightApiModel') || 'gpt-4o-mini').trim() || 'gpt-4o-mini'

      if (!apiBaseUrl || !apiKey) return { success: false, error: '请先在设置中配置 AI 模型' }

      // Build context
      const contextText = contextMessages.map(m =>
        `${m.isSend ? '我' : persona.contactName}: ${clean(m.content) || '[非文本]'}`
      ).join('\n')

      const personaContext = [
        `## ${persona.contactName} 的人格档案`,
        `- 性格特质：${persona.personality.traits.join('、')}`,
        `- 语言风格：${persona.communicationStyle.tone}`,
        `- 回复长度：${persona.communicationStyle.responseLength}`,
        `- 常用语：${persona.communicationStyle.commonPhrases.join('、')}`,
        persona.conversationRules.length ? `- 对话规则：${persona.conversationRules.join('；')}` : '',
        persona.relationshipHints.length ? `- 关系提示：${persona.relationshipHints.join('；')}` : '',
      ].filter(Boolean).join('\n')
      const knowledgeQuery = [
        draftText || '',
        ...contextMessages.slice(-4).map(m => clean(m.content))
      ].filter(Boolean).join('\n')
      const knowledgePack = await personaKnowledgeService.buildRagContext(personaId, knowledgeQuery || draftText || contextText, 8)

      let systemPrompt: string
      let userPrompt: string

      if (goal === 'predict_reaction') {
        systemPrompt = `你是一个关系分析助手。你正在分析用户准备发送给 ${persona.contactName} 的消息。基于 ${persona.contactName} 的人格档案和历史聊天模式，预测对方可能的反应。请务必说明这是基于历史数据的模拟推测，不代表本人真实想法。`
        userPrompt = [
          personaContext,
          '',
          knowledgePack.contextText ? `## 知识库命中\n${knowledgePack.contextText}` : '',
          '',
          '## 最近聊天记录',
          contextText,
          '',
          draftText ? `## 用户准备发送的消息\n${draftText}` : '## 用户准备发送的消息\n（基于最近聊天语境）',
          '',
          '请分析：',
          '1. 对方可能的反应和解读',
          '2. 这句话可能的风险点',
          '3. 建议的改写方式（如果需要）',
          '',
          '请用中文回复，结构清晰，在开头加上提醒：⚠️ 此为基于历史数据的模拟推测，不代表本人真实想法。'
        ].join('\n')
      } else if (goal === 'rewrite_draft') {
        systemPrompt = `你是一个沟通辅助助手。请参考 ${persona.contactName} 的语言风格和沟通习惯，帮助用户改写一段话，使其更符合对方的沟通偏好。注意：这不是让"对方替你说话"，而是"参考对方的风格调整表达方式"。`
        userPrompt = [
          personaContext,
          '',
          knowledgePack.contextText ? `## 知识库命中\n${knowledgePack.contextText}` : '',
          '',
          '## 最近聊天记录',
          contextText,
          '',
          draftText ? `## 需要改写的内容\n${draftText}` : '请根据语境生成适合的回复',
          toneOverride ? `\n语气微调：${toneOverride}` : '',
          '',
          '请输出改写后的版本，附上改写说明。'
        ].join('\n')
      } else {
        // interpret / risk_check / other goals
        systemPrompt = `你是一个沟通分析助手。请基于 ${persona.contactName} 的人格档案，分析当前聊天语境。`
        userPrompt = [
          personaContext,
          '',
          knowledgePack.contextText ? `## 知识库命中\n${knowledgePack.contextText}` : '',
          '',
          '## 聊天记录',
          contextText,
          '',
          draftText ? `## 待分析内容\n${draftText}` : '',
          `\n任务目标：${goal}`,
          '',
          '请分析并提供建议。'
        ].join('\n')
      }


      const endpoint = apiBaseUrl.replace(/\/+$/, '') + '/chat/completions'
      const urlObj = new URL(endpoint)
      const body = JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 2048,
        temperature: 0.7,
        stream: false
      })

      const result = await new Promise<string>((resolve, reject) => {
        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
          path: urlObj.pathname + urlObj.search,
          method: 'POST' as const,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body).toString(),
            Authorization: `Bearer ${apiKey}`
          }
        }
        const req = (urlObj.protocol === 'https:' ? https.request : http.request)(options, (res: any) => {
          let data = ''
          res.on('data', (chunk: any) => { data += chunk })
          res.on('end', () => {
            try {
              const content = JSON.parse(data)?.choices?.[0]?.message?.content
              if (typeof content === 'string' && content.trim()) resolve(content.trim())
              else reject(new Error(`API 返回异常: ${data.slice(0, 200)}`))
            } catch { reject(new Error(`JSON 解析失败: ${data.slice(0, 200)}`)) }
          })
        })
        req.setTimeout(120000, () => { req.destroy(); reject(new Error('API 超时')) })
        req.on('error', (e: any) => reject(e))
        req.write(body)
        req.end()
      })

      await personaKnowledgeService.recordAnswerTrace({
        personaId,
        question: draftText || contextText || goal,
        answer: result,
        retrievals: knowledgePack.retrievals,
        source: 'generateReply'
      })

      return { success: true, data: { content: result } }
    } catch (e: any) {
      return { success: false, error: e.message || '生成回复失败' }
    }
  }

  async listKnowledge(personaId: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
    return personaKnowledgeService.listKnowledge(personaId)
  }

  async updateKnowledgeItem(
    personaId: string,
    itemId: string,
    patch: {
      title?: string
      summary?: string
      rawText?: string
      tags?: string[]
      status?: 'active' | 'pinned' | 'excluded'
      importance?: number
      confidence?: number
    }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    return personaKnowledgeService.updateKnowledgeItem(personaId, itemId, patch)
  }

  async listAnswerTraces(personaId: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
    return personaKnowledgeService.listAnswerTraces(personaId)
  }

  // Helper methods
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
    if (!cfg.apiBaseUrl || !cfg.apiKey) {
      throw new Error('璇峰厛鍦ㄨ缃腑閰嶇疆 AI 妯″瀷')
    }

    const endpoint = cfg.apiBaseUrl.replace(/\/+$/, '') + '/chat/completions'
    const urlObj = new URL(endpoint)
    const body = JSON.stringify({
      model: cfg.model,
      messages,
      max_tokens: options?.maxTokens ?? 2048,
      temperature: options?.temperature ?? 0.7,
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
            else reject(new Error(`API 杩斿洖寮傚父: ${data.slice(0, 200)}`))
          } catch {
            reject(new Error(`JSON 瑙ｆ瀽澶辫触: ${data.slice(0, 200)}`))
          }
        })
      })
      req.setTimeout(options?.timeoutMs ?? 120_000, () => { req.destroy(); reject(new Error('API 瓒呮椂')) })
      req.on('error', (e: any) => reject(e))
      req.write(body)
      req.end()
    })
  }

  private async generatePersonaFromMessages(
    msgs: Message[],
    peer: string,
    isGroup: boolean
  ): Promise<{ success: boolean; data?: Partial<AiPersonaProfile>; error?: string }> {
    try {
      // More chunks = better coverage for long histories. Still capped to avoid runaway API calls.
      // Quality-first mode: use larger chunks and more chunks to better cover very long histories.
      // This intentionally increases API calls and token usage.
      const chunks = this.splitMessagesIntoChunks(msgs, peer, { maxLines: 420, maxChars: 35_000, maxChunks: 80 })

      const insights: PersonaChunkInsight[] = []
      const concurrency = 6
      let cursor = 0
      const workers = Array.from({ length: Math.min(concurrency, chunks.length) }, async () => {
        while (true) {
          const idx = cursor
          cursor += 1
          if (idx >= chunks.length) return
          const chunkText = chunks[idx]
          const resp = await this.callModel(
            [
              { role: 'system', content: PERSONA_CHUNK_EXTRACT_PROMPT },
              { role: 'user', content: chunkText }
            ],
            { maxTokens: 2000, temperature: 0.1, timeoutMs: 180_000 }
          )
          insights[idx] = this.parseChunkInsight(resp)
        }
      })
      await Promise.all(workers)

      const merged = this.mergeChunkInsights(insights.filter(Boolean))
      const chatSample = this.buildChatText(msgs, peer)

      const finalUserPrompt = [
        PERSONA_GENERATION_PROMPT,
        '',
        `联系人：${peer}（类型：${isGroup ? '群聊' : '私聊'}）`,
        '',
        '分段提炼要点（来自多段聊天摘要，供你综合）：',
        JSON.stringify(merged, null, 2),
        '',
        '聊天记录样本（用于语言风格/表达习惯锚定）：',
        chatSample
      ].join('\n')

      const finalResp = await this.callModel(
        [
          { role: 'system', content: '你是严谨的对话行为分析师。只输出 JSON，不要输出任何多余文字。' },
          { role: 'user', content: finalUserPrompt }
        ],
        { maxTokens: 4096, temperature: 0.25, timeoutMs: 240_000 }
      )

      const parsed = this.parsePersonaResponse(finalResp)
      return { success: true, data: parsed }
    } catch (e: any) {
      return { success: false, error: e.message || 'AI 鐢熸垚澶辫触' }
    }
  }

  private splitMessagesIntoChunks(
    msgs: Message[],
    peer: string,
    limits: { maxLines: number; maxChars: number; maxChunks: number }
  ): string[] {
    const lines = msgs.map(m => fmtMsg(m, '我', peer))
    const chunks: string[] = []
    let buf: string[] = []
    let chars = 0

    const flush = () => {
      if (buf.length === 0) return
      chunks.push(buf.join('\n'))
      buf = []
      chars = 0
    }

    for (const line of lines) {
      const nextChars = chars + line.length + 1
      if (buf.length >= limits.maxLines || nextChars >= limits.maxChars) flush()
      buf.push(line)
      chars += line.length + 1
    }
    flush()

    if (chunks.length <= limits.maxChunks) return chunks

    // Evenly sample, always keep first+last to preserve arc.
    const sampled: string[] = []
    sampled.push(chunks[0])
    const step = Math.max(1, Math.floor(chunks.length / (limits.maxChunks - 2)))
    for (let i = step; i < chunks.length - 1; i += step) {
      sampled.push(chunks[i])
      if (sampled.length >= limits.maxChunks - 1) break
    }
    sampled.push(chunks[chunks.length - 1])
    return sampled
  }

  private parseChunkInsight(content: string): PersonaChunkInsight {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) return JSON.parse(jsonMatch[0]) as PersonaChunkInsight
    } catch { /* ignore */ }
    return {}
  }

  private mergeChunkInsights(insights: PersonaChunkInsight[]): PersonaChunkInsight {
    const pickTop = (items: string[] | undefined, limit: number): string[] => {
      if (!Array.isArray(items) || items.length === 0) return []
      const freq = new Map<string, number>()
      for (const raw of items) {
        const v = String(raw || '').trim()
        if (!v) continue
        freq.set(v, (freq.get(v) || 0) + 1)
      }
      return [...freq.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, limit)
        .map(([v]) => v)
    }

    const allTraits: string[] = []
    const allPhrases: string[] = []
    const allEmoji: string[] = []
    const allPatterns: string[] = []
    const allValues: string[] = []
    const allHints: string[] = []
    const allRules: string[] = []
    const allEvidence: string[] = []
    const tones: string[] = []

    for (const i of insights) {
      if (i.tone) tones.push(String(i.tone))
      if (Array.isArray(i.traits)) allTraits.push(...i.traits)
      if (Array.isArray(i.commonPhrases)) allPhrases.push(...i.commonPhrases)
      if (Array.isArray(i.emojiHabits)) allEmoji.push(...i.emojiHabits)
      if (Array.isArray(i.sentencePatterns)) allPatterns.push(...i.sentencePatterns)
      if (Array.isArray(i.valuesAndMotivations)) allValues.push(...i.valuesAndMotivations)
      if (Array.isArray(i.relationshipHints)) allHints.push(...i.relationshipHints)
      if (Array.isArray(i.conversationRules)) allRules.push(...i.conversationRules)
      if (Array.isArray(i.evidence)) allEvidence.push(...i.evidence)
    }

    const tone = pickTop(tones, 1)[0] || ''
    return {
      traits: pickTop(allTraits, 40),
      tone,
      commonPhrases: pickTop(allPhrases, 60),
      emojiHabits: pickTop(allEmoji, 30),
      sentencePatterns: pickTop(allPatterns, 40),
      valuesAndMotivations: pickTop(allValues, 30),
      relationshipHints: pickTop(allHints, 30),
      conversationRules: pickTop(allRules, 40),
      evidence: pickTop(allEvidence, 60)
    }
  }

  private async getMessages(sessionId: string, options: CreatePersonaOptions): Promise<Message[]> {
    const allMsgs = await this.getAllMessages(sessionId)
    if (!allMsgs.length) return []

    const now = Date.now()
    let startTime = 0

    switch (options.dateRange) {
      case '1year':
        startTime = now - 365 * 24 * 60 * 60 * 1000
        break
      case '6months':
        startTime = now - 180 * 24 * 60 * 60 * 1000
        break
      case 'custom':
        startTime = options.customStartTime || 0
        break
      default:
        startTime = 0
    }

    if (startTime > 0) {
      return allMsgs.filter(m => {
        const ts = m.createTime > 1_000_000_000_000 ? m.createTime : m.createTime * 1000
        return ts >= startTime
      })
    }
    return allMsgs
  }

  private async getAllMessages(sessionId: string): Promise<Message[]> {
    try {
      const r = await chatService.getLatestMessages(sessionId, 99999)
      if (r.success && r.messages) return r.messages.reverse()
    } catch { /* ignore */ }
    return []
  }

  private buildChatText(msgs: Message[], peer: string): string {
    // Sample messages to avoid exceeding token limits
    const sampleSize = Math.min(msgs.length, 3000)
    const step = Math.max(1, Math.floor(msgs.length / sampleSize))
    const sampled: Message[] = []
    for (let i = 0; i < msgs.length; i += step) {
      sampled.push(msgs[i])
    }
    // Always include last N messages (style anchor).
    const latestMsgs = msgs.slice(-80)
    for (const m of latestMsgs) {
      if (!sampled.includes(m)) sampled.push(m)
    }
    sampled.sort((a, b) => {
      const ta = a.createTime > 1_000_000_000_000 ? a.createTime : a.createTime * 1000
      const tb = b.createTime > 1_000_000_000_000 ? b.createTime : b.createTime * 1000
      return ta - tb
    })

    const lines = sampled.map(m => fmtMsg(m, '我', peer))
    const joined = lines.join('\n')
    const MAX_CHARS = 120_000
    if (joined.length <= MAX_CHARS) return joined
    const tail = joined.slice(-MAX_CHARS)
    const cutAt = tail.indexOf('\n')
    return cutAt >= 0 ? tail.slice(cutAt + 1) : tail
  }

  private parsePersonaResponse(content: string): Partial<AiPersonaProfile> {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    } catch { /* ignore */ }
    // Return raw content as summary if JSON parsing fails
    return { summary: content }
  }

  private buildPromptSkill(parsed: Partial<AiPersonaProfile>, name: string): string {
    const parts = [
      `你是 ${name} 的人格模拟分身。`,
      '',
      '## 核心设定',
      parsed.summary ? `- 综合描述：${parsed.summary}` : '',
      parsed.personality?.traits?.length ? `- 性格特质：${parsed.personality.traits.join('、')}` : '',
      '',
      '## 语言风格',
      parsed.communicationStyle?.tone ? `- 语气：${parsed.communicationStyle.tone}` : '',
      parsed.communicationStyle?.responseLength ? `- 回复长度：${parsed.communicationStyle.responseLength}` : '',
      parsed.communicationStyle?.commonPhrases?.length ? `- 常用语：${parsed.communicationStyle.commonPhrases.join('、')}` : '',
      parsed.communicationStyle?.emojiHabits?.length ? `- 表情习惯：${parsed.communicationStyle.emojiHabits.join('、')}` : '',
      parsed.communicationStyle?.sentencePatterns?.length ? `- 句式特点：${parsed.communicationStyle.sentencePatterns.join('；')}` : '',
      '',
      '## 行为准则',
      ...(parsed.conversationRules || []).map((r, i) => `${i + 1}. ${r}`),
      '',
      '## 重要提醒',
      '- 你只是基于历史聊天记录的模拟，不代表本人真实想法',
      '- 保持该联系人的语言风格和表达习惯',
      '- 遇到不确定的信息要自然表达不确定',
      '- 不给出危险建议、隐私猜测或控制建议'
    ]
    return parts.filter(Boolean).join('\n')
  }

  // V2: More verbose + more actionable skill (token cost acceptable; quality first).
  private buildPromptSkillV2(parsed: Partial<AiPersonaProfile>, name: string): string {
    const doList = parsed.doAndDont?.do || []
    const dontList = parsed.doAndDont?.dont || []
    const exampleReplies = parsed.exampleReplies || []
    const edgeCases = parsed.edgeCases || []

    const out: string[] = []
    out.push(`你是「${name}」的人格分身（基于历史聊天记录提炼，不代表本人真实想法）。`)
    out.push('')

    out.push('## 任务目标')
    out.push(`- 用「${name}」的语气与习惯进行回复，让用户感觉像在跟本人聊天。`)
    out.push('- 在不确定时自然表达不确定，不要编造。')
    out.push('')

    out.push('## 核心画像')
    if (parsed.summary) out.push(`- 总结：${parsed.summary}`)
    if (parsed.personality?.traits?.length) out.push(`- 性格特征：${parsed.personality.traits.join('、')}`)
    out.push('')

    out.push('## 语言风格（优先级最高）')
    if (parsed.communicationStyle?.tone) out.push(`- 语气：${parsed.communicationStyle.tone}`)
    if (parsed.communicationStyle?.responseLength) out.push(`- 回复长度：${parsed.communicationStyle.responseLength}`)
    if (parsed.communicationStyle?.commonPhrases?.length) out.push(`- 高频口头禅/常用语：${parsed.communicationStyle.commonPhrases.join('、')}`)
    if (parsed.communicationStyle?.emojiHabits?.length) out.push(`- 表情习惯：${parsed.communicationStyle.emojiHabits.join('、')}`)
    if (parsed.communicationStyle?.sentencePatterns?.length) out.push(`- 句式特征：${parsed.communicationStyle.sentencePatterns.join('；')}`)
    out.push('')

    out.push('## 价值观与动机')
    if (parsed.valuesAndMotivations?.length) out.push(parsed.valuesAndMotivations.map(v => `- ${v}`).join('\n'))
    out.push('')

    out.push('## 关系线索')
    if (parsed.relationshipHints?.length) out.push(parsed.relationshipHints.map(v => `- ${v}`).join('\n'))
    out.push('')

    out.push('## 对话规则（必须执行）')
    if (parsed.conversationRules?.length) out.push(parsed.conversationRules.map((r, i) => `${i + 1}. ${r}`).join('\n'))
    out.push('')

    if (doList.length || dontList.length) {
      out.push('## Do / Don’t（硬约束）')
      if (doList.length) out.push(['Do：', ...doList.map(v => `- ${v}`)].join('\n'))
      if (dontList.length) out.push(['Don’t：', ...dontList.map(v => `- ${v}`)].join('\n'))
      out.push('')
    }

    if (edgeCases.length) {
      out.push('## 边界与不确定处理')
      out.push(edgeCases.map(v => `- ${v}`).join('\n'))
      out.push('')
    }

    if (exampleReplies.length) {
      out.push('## 风格例句（照这个味道写）')
      out.push(exampleReplies.map(v => `- ${v}`).join('\n'))
      out.push('')
    }

    out.push('## 安全与真实性提醒')
    out.push('- 你只是在模拟，不要声称自己是现实中的本人。')
    out.push('- 不输出隐私猜测、控制/胁迫建议或任何危险建议。')

    return out.filter(Boolean).join('\n')
  }
}

export const aiPersonaService = new AiPersonaService()
