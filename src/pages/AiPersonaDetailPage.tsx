import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  MessageSquare,
  FileText,
  Send,
  Loader2,
  AlertCircle,
  User,
  Clock,
  RefreshCw,
  Trash2,
  ArrowLeft,
  Edit3,
  Check,
  X,
  Copy,
  Tag,
  Search
} from 'lucide-react'
import type { AiPersonaConversation, AiPersonaProfile, PersonaAnswerTrace, PersonaKnowledgeItem } from '../types/aiPersona'
import './AiPersonaDetailPage.scss'

function AiPersonaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const chatEndRef = useRef<HTMLDivElement>(null)

  const [persona, setPersona] = useState<AiPersonaProfile | null>(null)
  const [conversation, setConversation] = useState<AiPersonaConversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'chat' | 'profile' | 'knowledge'>(searchParams.get('tab') === 'profile' ? 'profile' : searchParams.get('tab') === 'knowledge' ? 'knowledge' : 'chat')
  const [messageInput, setMessageInput] = useState('')
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [editingSkill, setEditingSkill] = useState(false)
  const [skillDraft, setSkillDraft] = useState('')
  const [savingSkill, setSavingSkill] = useState(false)
  const [skillSaved, setSkillSaved] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [knowledgeItems, setKnowledgeItems] = useState<PersonaKnowledgeItem[]>([])
  const [answerTraces, setAnswerTraces] = useState<PersonaAnswerTrace[]>([])
  const [knowledgeLoading, setKnowledgeLoading] = useState(false)
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null)
  const [knowledgeQuery, setKnowledgeQuery] = useState('')
  const [knowledgeStatusFilter, setKnowledgeStatusFilter] = useState<'all' | 'active' | 'pinned' | 'excluded'>('all')

  const copyText = async (text: string, key: string) => {
    const value = String(text || '').trim()
    if (!value) return

    const markCopied = () => {
      setCopiedKey(key)
      window.setTimeout(() => {
        setCopiedKey(current => (current === key ? null : current))
      }, 1600)
    }

    try {
      await navigator.clipboard.writeText(value)
      markCopied()
      return
    } catch {
      try {
        const textarea = document.createElement('textarea')
        textarea.value = value
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        textarea.style.top = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        markCopied()
      } catch (fallbackError: any) {
        alert(fallbackError.message || '复制失败')
      }
    }
  }

  const buildPersonaExport = () => {
    if (!persona) return ''

    return JSON.stringify(
      {
        contactName: persona.contactName,
        kind: persona.kind,
        summary: persona.summary,
        personality: persona.personality,
        communicationStyle: persona.communicationStyle,
        valuesAndMotivations: persona.valuesAndMotivations,
        relationshipHints: persona.relationshipHints,
        conversationRules: persona.conversationRules,
        doAndDont: persona.doAndDont,
        exampleReplies: persona.exampleReplies,
        edgeCases: persona.edgeCases,
        promptSkill: persona.promptSkill
      },
      null,
      2
    )
  }

  const buildConversationExport = () => {
    const messages = conversation?.messages || []
    if (messages.length === 0) return ''

    return messages
      .map(msg => msg.content)
      .join('\n\n')
  }

  const handleStartEditSkill = () => {
    if (!persona) return
    setSkillDraft(persona.promptSkill || '')
    setEditingSkill(true)
  }

  const handleCancelEditSkill = () => {
    setEditingSkill(false)
    setSkillDraft('')
  }

  const handleSaveSkill = async () => {
    if (!id || !persona || savingSkill) return
    setSavingSkill(true)
    try {
      const result = await window.electronAPI.aiPersona.updatePromptSkill({ id, promptSkill: skillDraft })
      if (result.success && result.data) {
        setPersona(result.data)
        setEditingSkill(false)
        setSkillSaved(true)
        window.setTimeout(() => setSkillSaved(false), 1600)
      } else {
        alert(result.error || '保存失败')
      }
    } catch (e: any) {
      alert(e.message || '保存失败')
    } finally {
      setSavingSkill(false)
    }
  }

  useEffect(() => {
    if (!id) return

    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [personaResult, convResult] = await Promise.all([
          window.electronAPI.aiPersona.get(id),
          window.electronAPI.aiPersona.getConversation(id)
        ])

        if (cancelled) return

        if (personaResult.success && personaResult.data) {
          setPersona(personaResult.data)
        } else {
          setError(personaResult.error || '加载分身失败')
          return
        }

        if (convResult.success && convResult.data) {
          setConversation(convResult.data)
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conversation?.messages])

  const loadKnowledge = useCallback(async () => {
    if (!id) return
    setKnowledgeLoading(true)
    setKnowledgeError(null)
    try {
      const [knowledgeResult, traceResult] = await Promise.all([
        window.electronAPI.aiPersona.listKnowledge(id),
        window.electronAPI.aiPersona.listAnswerTraces(id)
      ])

      if (knowledgeResult.success && knowledgeResult.data) {
        setKnowledgeItems(knowledgeResult.data)
      } else {
        setKnowledgeError(knowledgeResult.error || '加载知识库失败')
      }

      if (traceResult.success && traceResult.data) {
        setAnswerTraces(traceResult.data)
      }
    } catch (e: any) {
      setKnowledgeError(e.message || '加载知识库失败')
    } finally {
      setKnowledgeLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (activeTab === 'knowledge') {
      loadKnowledge()
    }
  }, [activeTab, loadKnowledge])

  const handleSend = useCallback(async () => {
    if (!messageInput.trim() || !id || sending) return

    const msg = messageInput.trim()
    setMessageInput('')
    setSending(true)
    setChatError(null)

    const optimisticMsg = {
      id: `opt-${Date.now()}`,
      role: 'user' as const,
      content: msg,
      createdAt: Date.now()
    }

    setConversation(prev => (prev ? { ...prev, messages: [...prev.messages, optimisticMsg] } : null))

    try {
      const result = await window.electronAPI.aiPersona.chat({ personaId: id, message: msg })
      if (result.success && result.data) {
        const assistantMsg = {
          id: `opt-${Date.now() + 1}`,
          role: 'assistant' as const,
          content: result.data.content,
          createdAt: Date.now()
        }

        setConversation(prev =>
          prev
            ? {
                ...prev,
                messages: [...prev.messages.filter(m => m.id !== optimisticMsg.id), optimisticMsg, assistantMsg],
                updatedAt: Date.now()
              }
            : null
        )
      } else {
        setChatError(result.error || '回复失败')
        setConversation(prev =>
          prev
            ? {
                ...prev,
                messages: prev.messages.filter(m => m.id !== optimisticMsg.id)
              }
            : null
        )
      }
    } catch (e: any) {
      setChatError(e.message || '回复失败')
      setConversation(prev =>
        prev
          ? {
              ...prev,
              messages: prev.messages.filter(m => m.id !== optimisticMsg.id)
            }
          : null
      )
    } finally {
      setSending(false)
    }
  }, [messageInput, id, sending])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleRefresh = async () => {
    if (!id) return
    try {
      const result = await window.electronAPI.aiPersona.update({ id, options: { dateRange: '1year' } })
      if (result.success && result.data) {
        setPersona(result.data)
      } else {
        alert(result.error || '更新失败')
      }
    } catch (e: any) {
      alert(e.message || '更新失败')
    }
  }

  const handleKnowledgePatch = async (itemId: string, patch: Partial<Pick<PersonaKnowledgeItem, 'title' | 'summary' | 'rawText' | 'tags' | 'status' | 'importance' | 'confidence'>>) => {
    if (!id) return
    try {
      const result = await window.electronAPI.aiPersona.updateKnowledgeItem({ personaId: id, itemId, patch })
      if (result.success && result.data) {
        setKnowledgeItems(prev => prev.map(item => (item.id === itemId ? result.data! : item)))
      } else {
        alert(result.error || '更新知识库失败')
      }
    } catch (e: any) {
      alert(e.message || '更新知识库失败')
    }
  }

  const handleDelete = async () => {
    if (!id) return
    try {
      const result = await window.electronAPI.aiPersona.delete(id)
      if (result.success) {
        navigate('/ai-persona', { replace: true })
      } else {
        alert(result.error || '删除失败')
      }
    } catch (e: any) {
      alert(e.message || '删除失败')
    }
  }

  const filteredKnowledge = useMemo(() => {
    const keyword = knowledgeQuery.trim().toLowerCase()
    return knowledgeItems.filter(item => {
      if (knowledgeStatusFilter !== 'all' && item.status !== knowledgeStatusFilter) return false
      if (!keyword) return true
      const haystack = [
        item.title,
        item.summary,
        item.rawText,
        item.tags.join(' '),
        item.sourceSessionIds.join(' ')
      ].join(' ').toLowerCase()
      return haystack.includes(keyword)
    })
  }, [knowledgeItems, knowledgeQuery, knowledgeStatusFilter])

  const formatTime = (ts: number): string => {
    const d = new Date(ts)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="persona-detail-page">
        <div className="persona-detail-loading">
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
          <p>加载中...</p>
        </div>
      </div>
    )
  }

  if (error || !persona) {
    return (
      <div className="persona-detail-page">
        <div className="persona-detail-error">
          <button type="button" className="persona-back-btn" onClick={() => navigate('/ai-persona')}>
            <ArrowLeft size={18} /> 返回列表
          </button>
          <div className="error-content">
            <AlertCircle size={32} />
            <p>{error || '分身不存在'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="persona-detail-page">
      <div className="persona-detail-header">
        <button type="button" className="persona-back-btn" onClick={() => navigate('/ai-persona')}>
          <ArrowLeft size={18} /> 返回
        </button>

        <div className="persona-detail-header-info">
          <div className="persona-detail-avatar">
            {persona.avatarUrl ? <img src={persona.avatarUrl} alt="" /> : <User size={24} />}
          </div>
          <div className="persona-detail-name">
            <h2>{persona.kind === 'self' ? '我的 AI 分身' : persona.contactName}</h2>
            <span>{persona.kind === 'self' ? '基于我自己的发言生成的分身' : 'TA 的人格档案'}</span>
          </div>
        </div>

        <div className="persona-detail-header-actions">
          <button type="button" className="persona-detail-action" onClick={handleRefresh} title="增量更新">
            <RefreshCw size={14} />
            <span>更新</span>
          </button>
          <button type="button" className="persona-detail-action" onClick={() => copyText(buildPersonaExport(), 'export')} title="复制完整画像">
            <Copy size={14} />
            <span>{copiedKey === 'export' ? '已复制完整画像' : '复制完整画像'}</span>
          </button>
          <button type="button" className="persona-detail-action persona-detail-action-danger" onClick={() => setShowDeleteConfirm(true)} title="删除">
            <Trash2 size={14} />
            <span>删除</span>
          </button>
        </div>
      </div>

      <div className="persona-detail-tabs">
        <button
          type="button"
          className={`persona-detail-tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquare size={16} />
          <span>和 TA 对话</span>
        </button>
        <button
          type="button"
          className={`persona-detail-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <FileText size={16} />
          <span>人格档案</span>
        </button>
        <button
          type="button"
          className={`persona-detail-tab ${activeTab === 'knowledge' ? 'active' : ''}`}
          onClick={() => setActiveTab('knowledge')}
        >
          <Tag size={16} />
          <span>知识库</span>
        </button>
      </div>

      <div className="persona-detail-content">
        {activeTab === 'chat' && (
          <div className="persona-chat-panel">
            <div className="persona-chat-warning">
              <AlertCircle size={12} />
              <span>AI 分身基于历史聊天记录生成，仅用于沟通演练和关系理解，不代表本人真实想法。</span>
            </div>

            <div className="persona-chat-toolbar">
              <button
                type="button"
                className="persona-chat-copy-all-btn"
                onClick={() => copyText(buildConversationExport(), 'chat-all')}
                disabled={!conversation || conversation.messages.length === 0}
                title="复制整段对话"
              >
                <Copy size={14} />
              </button>
            </div>

            <div className="persona-chat-messages">
              {(!conversation || conversation.messages.length === 0) && (
                <div className="persona-chat-empty">
                  <p>和 TA 的 AI 分身聊聊...</p>
                  <span>试试说一句“你好”，开始一场模拟对话。</span>
                </div>
              )}

              {conversation?.messages.map(msg => (
                <div key={msg.id} className={`persona-chat-message ${msg.role}`}>
                  <div className="persona-chat-message-avatar">
                    {msg.role === 'user' ? <User size={16} /> : persona.avatarUrl ? <img src={persona.avatarUrl} alt="" /> : <User size={16} />}
                  </div>
                  <div className="persona-chat-message-content">
                    <div className="persona-chat-message-name">{msg.role === 'user' ? '我' : persona.contactName}</div>
                    <div className="persona-chat-message-text">{msg.content}</div>
                    <div className="persona-chat-message-meta">
                      <div className="persona-chat-message-time">{formatTime(msg.createdAt)}</div>
                      <button
                        type="button"
                        className="persona-chat-message-copy-btn"
                        onClick={() => copyText(msg.content, `msg-${msg.id}`)}
                        title="复制这条消息"
                      >
                        <Copy size={10} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {sending && (
                <div className="persona-chat-message assistant">
                  <div className="persona-chat-message-avatar">
                    {persona.avatarUrl ? <img src={persona.avatarUrl} alt="" /> : <User size={16} />}
                  </div>
                  <div className="persona-chat-message-content">
                    <div className="persona-chat-message-name">{persona.contactName}</div>
                    <div className="persona-chat-message-text typing">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {chatError && (
              <div className="persona-chat-error">
                <AlertCircle size={14} />
                <span>{chatError}</span>
              </div>
            )}

            <div className="persona-chat-input-area">
              <textarea
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="和 TA 的 AI 分身聊聊..."
                rows={2}
                disabled={sending}
              />
              <button
                type="button"
                className="persona-chat-send-btn"
                onClick={handleSend}
                disabled={!messageInput.trim() || sending}
              >
                {sending ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={16} />}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div className="persona-knowledge-panel">
            <div className="persona-knowledge-toolbar">
              <div className="persona-knowledge-search">
                <Search size={16} />
                <input
                  type="text"
                  value={knowledgeQuery}
                  onChange={e => setKnowledgeQuery(e.target.value)}
                  placeholder="搜索知识库标题、摘要或原文"
                />
              </div>
              <div className="persona-knowledge-filters">
                {(['all', 'active', 'pinned', 'excluded'] as const).map(status => (
                  <button
                    key={status}
                    type="button"
                    className={`persona-knowledge-filter ${knowledgeStatusFilter === status ? 'active' : ''}`}
                    onClick={() => setKnowledgeStatusFilter(status)}
                  >
                    {status === 'all' ? '全部' : status === 'active' ? '启用' : status === 'pinned' ? '置顶' : '排除'}
                  </button>
                ))}
              </div>
            </div>

            {knowledgeLoading && (
              <div className="persona-knowledge-loading">
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                <span>加载知识库中...</span>
              </div>
            )}

            {knowledgeError && (
              <div className="persona-knowledge-error">
                <AlertCircle size={14} />
                <span>{knowledgeError}</span>
                <button type="button" onClick={loadKnowledge}>重试</button>
              </div>
            )}

            {!knowledgeLoading && !knowledgeError && filteredKnowledge.length === 0 && (
              <div className="persona-knowledge-empty">
                <Tag size={28} />
                <p>暂无可显示的知识项</p>
                <span>分身会在后续增量更新时自动补充知识库。</span>
              </div>
            )}

            <div className="persona-knowledge-list">
              {filteredKnowledge.map(item => (
                <div key={item.id} className={`persona-knowledge-item ${item.status}`}>
                  <div className="persona-knowledge-item-header">
                    <div>
                      <h3>{item.title}</h3>
                      <div className="persona-knowledge-meta">
                        <span>{item.type === 'memory_item' ? '长期记忆' : item.type === 'session_summary' ? '会话摘要' : '原始片段'}</span>
                        <span>{item.sourceMessageCount} 条消息</span>
                        <span>{formatTime(item.sourceDateRange.startTime)} - {formatTime(item.sourceDateRange.endTime)}</span>
                      </div>
                    </div>
                    <div className="persona-knowledge-actions">
                      <button type="button" onClick={() => copyText(item.summary, `knowledge-summary-${item.id}`)}>复制摘要</button>
                      <button type="button" onClick={() => copyText(item.rawText, `knowledge-raw-${item.id}`)}>复制原文</button>
                      <button type="button" onClick={() => handleKnowledgePatch(item.id, { status: item.status === 'pinned' ? 'active' : 'pinned' })}>
                        {item.status === 'pinned' ? '取消置顶' : '置顶'}
                      </button>
                      <button type="button" onClick={() => handleKnowledgePatch(item.id, { status: item.status === 'excluded' ? 'active' : 'excluded' })}>
                        {item.status === 'excluded' ? '恢复' : '排除'}
                      </button>
                    </div>
                  </div>

                  <p className="persona-knowledge-summary">{item.summary}</p>
                  <pre className="persona-knowledge-raw">{item.rawText}</pre>

                  {item.tags.length > 0 && (
                    <div className="persona-knowledge-tags">
                      {item.tags.map(tag => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="persona-answer-trace-section">
              <h3>回答证据</h3>
              {answerTraces.length === 0 ? (
                <div className="persona-answer-trace-empty">暂时还没有回答证据，等你发起几次对话后这里会显示引用来源。</div>
              ) : (
                <div className="persona-answer-trace-list">
                  {answerTraces.slice(0, 20).map(trace => (
                    <div key={trace.id} className="persona-answer-trace-item">
                      <div className="trace-question">{trace.question}</div>
                      <div className="trace-answer">{trace.answer}</div>
                      <div className="trace-retrievals">
                        {trace.retrievals.map(r => (
                          <span key={r.itemId}>{r.title}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="persona-profile-panel">
            <div className="profile-copy-bar">
              <button type="button" className="profile-copy-action" onClick={() => copyText(persona.promptSkill, 'skill')}>
                <Copy size={14} />
                <span>{copiedKey === 'skill' ? '已复制 Skill' : '复制 Skill'}</span>
              </button>
              <button type="button" className="profile-copy-action" onClick={() => copyText(buildPersonaExport(), 'export')}>
                <Copy size={14} />
                <span>{copiedKey === 'export' ? '已复制完整画像' : '复制完整画像'}</span>
              </button>
            </div>

            <div className="profile-meta-bar">
              <div className="profile-meta-item">
                <Clock size={14} />
                <span>生成时间：{formatTime(persona.createdAt)}</span>
              </div>
              <div className="profile-meta-item">
                <span>版本：{persona.version}</span>
              </div>
              <div className="profile-meta-item">
                <span>来源：{persona.sourceMessageCount} 条消息</span>
              </div>
              <div className="profile-meta-item">
                <span>
                  时间范围：{formatTime(persona.sourceDateRange.startTime)} - {formatTime(persona.sourceDateRange.endTime)}
                </span>
              </div>
            </div>

            <div className="profile-section">
              <div className="profile-section-header">
                <h3>综合画像</h3>
                <button type="button" className="profile-copy-inline" onClick={() => copyText(persona.summary, 'summary')}>
                  <Copy size={12} />
                  <span>{copiedKey === 'summary' ? '已复制' : '复制摘要'}</span>
                </button>
              </div>
              <p className="profile-summary">{persona.summary}</p>
            </div>

            <div className="profile-section">
              <h3>性格特质</h3>
              <div className="profile-tags">
                {persona.personality.traits.map(trait => (
                  <span key={trait} className="profile-tag">
                    {trait}
                  </span>
                ))}
              </div>

              {persona.personality.ocean && (
                <div className="profile-ocean">
                  {([
                    ['开放性', persona.personality.ocean.openness],
                    ['尽责性', persona.personality.ocean.conscientiousness],
                    ['外向性', persona.personality.ocean.extraversion],
                    ['宜人性', persona.personality.ocean.agreeableness],
                    ['神经质', persona.personality.ocean.neuroticism]
                  ] as const).map(([label, value]) => (
                    <div key={label} className="ocean-bar">
                      <div className="ocean-label">{label}</div>
                      <div className="ocean-track">
                        <div className="ocean-fill" style={{ width: `${(value * 100).toFixed(0)}%` }} />
                      </div>
                      <div className="ocean-value">{(value * 100).toFixed(0)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="profile-section">
              <h3>语言习惯</h3>
              <div className="profile-comm-style">
                <div className="comm-item">
                  <span className="comm-label">语气</span>
                  <span className="comm-value">{persona.communicationStyle.tone || '未分析'}</span>
                </div>
                <div className="comm-item">
                  <span className="comm-label">回复长度</span>
                  <span className="comm-value">{persona.communicationStyle.responseLength || '未分析'}</span>
                </div>
              </div>

              {persona.communicationStyle.sentencePatterns.length > 0 && (
                <div className="profile-subsection">
                  <h4>句式特点</h4>
                  <ul>
                    {persona.communicationStyle.sentencePatterns.map((pattern, index) => (
                      <li key={index}>{pattern}</li>
                    ))}
                  </ul>
                </div>
              )}

              {persona.communicationStyle.emojiHabits.length > 0 && (
                <div className="profile-subsection">
                  <h4>表情习惯</h4>
                  <div className="profile-tags">
                    {persona.communicationStyle.emojiHabits.map(emoji => (
                      <span key={emoji} className="profile-tag">
                        {emoji}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {persona.communicationStyle.commonPhrases.length > 0 && (
                <div className="profile-subsection">
                  <h4>高频用语</h4>
                  <div className="profile-tags">
                    {persona.communicationStyle.commonPhrases.map(phrase => (
                      <span key={phrase} className="profile-tag">
                        {phrase}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {persona.valuesAndMotivations.length > 0 && (
              <div className="profile-section">
                <h3>价值观与动机</h3>
                <div className="profile-tags">
                  {persona.valuesAndMotivations.map(value => (
                    <span key={value} className="profile-tag profile-tag-value">
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {persona.relationshipHints.length > 0 && (
              <div className="profile-section">
                <h3>关系提示</h3>
                <ul>
                  {persona.relationshipHints.map((hint, index) => (
                    <li key={index}>{hint}</li>
                  ))}
                </ul>
              </div>
            )}

            {persona.conversationRules.length > 0 && (
              <div className="profile-section">
                <div className="profile-section-header">
                  <h3>对话规则</h3>
                  <button type="button" className="profile-copy-inline" onClick={() => copyText(persona.conversationRules.join('\n'), 'rules')}>
                    <Copy size={12} />
                    <span>{copiedKey === 'rules' ? '已复制' : '复制规则'}</span>
                  </button>
                </div>
                <ul>
                  {persona.conversationRules.map((rule, index) => (
                    <li key={index}>{rule}</li>
                  ))}
                </ul>
              </div>
            )}

            {persona.doAndDont && (
              <div className="profile-section">
                <h3>Do / Don't</h3>
                <div className="profile-subsection">
                  <h4>应该做</h4>
                  <ul>
                    {persona.doAndDont.do.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="profile-subsection">
                  <h4>不要做</h4>
                  <ul>
                    {persona.doAndDont.dont.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {persona.exampleReplies && persona.exampleReplies.length > 0 && (
              <div className="profile-section">
                <h3>示例回复</h3>
                <ul>
                  {persona.exampleReplies.map((reply, index) => (
                    <li key={index}>{reply}</li>
                  ))}
                </ul>
              </div>
            )}

            {persona.edgeCases && persona.edgeCases.length > 0 && (
              <div className="profile-section">
                <h3>边界情况</h3>
                <ul>
                  {persona.edgeCases.map((edge, index) => (
                    <li key={index}>{edge}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="profile-section">
              <div className="profile-skill-header">
                <h3>模拟对话 Skill</h3>
                {!editingSkill && (
                  <>
                    <button type="button" className="profile-skill-edit-btn" onClick={handleStartEditSkill}>
                      <Edit3 size={14} /> 编辑
                    </button>
                    <button type="button" className="profile-skill-copy-btn" onClick={() => copyText(persona.promptSkill, 'skill-panel')}>
                      <Copy size={14} />
                      <span>{copiedKey === 'skill-panel' ? '已复制' : '复制'}</span>
                    </button>
                  </>
                )}
                {skillSaved && <span className="profile-skill-saved">已保存</span>}
              </div>

              {editingSkill ? (
                <div className="profile-skill-editor">
                  <textarea
                    className="profile-skill-textarea"
                    value={skillDraft}
                    onChange={e => setSkillDraft(e.target.value)}
                    rows={16}
                    placeholder="输入模拟对话的系统提示词..."
                  />
                  <div className="profile-skill-editor-hint">
                    <AlertCircle size={12} />
                    <span>Skill 决定分身在对话中的语气、边界和回复规则。</span>
                  </div>
                  <div className="profile-skill-editor-actions">
                    <button type="button" className="profile-skill-cancel-btn" onClick={handleCancelEditSkill} disabled={savingSkill}>
                      <X size={14} /> 取消
                    </button>
                    <button type="button" className="profile-skill-save-btn" onClick={handleSaveSkill} disabled={savingSkill}>
                      {savingSkill ? (
                        <>
                          <Loader2 size={14} className="spin" /> 保存中...
                        </>
                      ) : (
                        <>
                          <Check size={14} /> 保存
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="profile-skill-preview">
                  <pre>{persona.promptSkill || '（暂无 Skill 内容）'}</pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="persona-delete-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="persona-delete-dialog" onClick={e => e.stopPropagation()}>
            <h3>确认删除</h3>
            <p>确定要删除“{persona.contactName}”的 AI 分身吗？此操作不会影响原始聊天记录。</p>
            <div className="persona-delete-actions">
              <button type="button" onClick={() => setShowDeleteConfirm(false)}>
                取消
              </button>
              <button type="button" className="btn-danger" onClick={handleDelete}>
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AiPersonaDetailPage
