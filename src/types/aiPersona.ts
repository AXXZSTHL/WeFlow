export interface AiPersonaProfile {
  id: string
  kind?: 'contact' | 'self'
  sessionId: string
  contactName: string
  avatarUrl?: string
  sourceMessageCount: number
  sourceDateRange: {
    startTime: number
    endTime: number
  }
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

export interface AiPersonaConversation {
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

export interface GenerateReplyPayload {
  sessionId: string
  contextSource: 'current_chat' | 'persona' | 'customer_service_knowledge'
  personaId?: string
  knowledgeBaseId?: string
  goal:
    | 'reply'
    | 'interpret'
    | 'predict_reaction'
    | 'rewrite_draft'
    | 'risk_check'
    | 'customer_service_answer'
    | 'ask_follow_up'
    | 'summarize_issue'
  draftText?: string
  toneOverride?: 'shorter' | 'more_natural' | 'more_polite' | 'more_direct' | 'less_aggressive'
  contextMessages: Array<{ isSend: boolean; content: string; createTime: number }>
}

export interface CreatePersonaOptions {
  dateRange: 'all' | '1year' | '6months' | 'custom'
  customStartTime?: number
  customEndTime?: number
}

export interface CreateSelfPersonaOptions extends CreatePersonaOptions {
  sessionIds: string[]
}

export interface PersonaListItem {
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

export type PersonaKnowledgeItemType = 'source_chunk' | 'session_summary' | 'memory_item'
export type PersonaKnowledgeStatus = 'active' | 'pinned' | 'excluded'

export interface PersonaKnowledgeItem {
  id: string
  personaId: string
  type: PersonaKnowledgeItemType
  title: string
  summary: string
  rawText: string
  sourceSessionIds: string[]
  sourceMessageCount: number
  sourceDateRange: {
    startTime: number
    endTime: number
  }
  tags: string[]
  status: PersonaKnowledgeStatus
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
  retrievals: Array<{
    itemId: string
    title: string
    summary: string
    score: number
    reason: string
    tags: string[]
    status: PersonaKnowledgeStatus
  }>
  createdAt: number
  source: 'chat' | 'generateReply'
}
