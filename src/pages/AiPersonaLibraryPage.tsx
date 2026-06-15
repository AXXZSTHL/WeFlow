import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Clock, FileText, Loader2, MessageSquare, Plus, RefreshCw, Search, Tag, Trash2, User } from 'lucide-react'
import type { ChatSession } from '../types/models'
import type { PersonaListItem } from '../types/aiPersona'
import './AiPersonaLibraryPage.scss'

function AiPersonaLibraryPage() {
  const navigate = useNavigate()
  const [personas, setPersonas] = useState<PersonaListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const [showSelfModal, setShowSelfModal] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [selfError, setSelfError] = useState<string | null>(null)
  const [selfQuery, setSelfQuery] = useState('')
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([])
  const [creatingSelf, setCreatingSelf] = useState(false)

  const loadPersonas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.electronAPI.aiPersona.list()
      if (result.success && result.data) {
        setPersonas(result.data)
      } else {
        setError(result.error || '加载失败')
      }
    } catch (e: any) {
      setError(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true)
    setSelfError(null)
    try {
      const result = await window.electronAPI.chat.getSessions()
      if (result.success && result.sessions) {
        const usable = result.sessions.filter(session => {
          const username = String(session.username || '').trim()
          if (!username) return false
          if (username === 'official_accounts_virtual') return false
          if (username.startsWith('gh_')) return false
          return true
        })
        usable.sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0))
        setSessions(usable)
      } else {
        setSelfError(result.error || '加载会话失败')
      }
    } catch (e: any) {
      setSelfError(e.message || '加载会话失败')
    } finally {
      setLoadingSessions(false)
    }
  }, [])

  useEffect(() => {
    loadPersonas()
  }, [loadPersonas])

  useEffect(() => {
    if (!showSelfModal) return
    loadSessions()
  }, [loadSessions, showSelfModal])

  const handleDelete = async (id: string) => {
    try {
      const result = await window.electronAPI.aiPersona.delete(id)
      if (result.success) {
        setPersonas(prev => prev.filter(p => p.id !== id))
        setDeleteConfirmId(null)
      } else {
        alert(result.error || '删除失败')
      }
    } catch (e: any) {
      alert(e.message || '删除失败')
    }
  }

  const handleRefresh = async (id: string) => {
    try {
      const result = await window.electronAPI.aiPersona.update({ id, options: { dateRange: '1year' } })
      if (result.success) {
        await loadPersonas()
      } else {
        alert(result.error || '更新失败')
      }
    } catch (e: any) {
      alert(e.message || '更新失败')
    }
  }

  const openSelfPersonaModal = () => {
    setSelfQuery('')
    setSelfError(null)
    setSelectedSessionIds([])
    setShowSelfModal(true)
  }

  const visibleSessions = useMemo(() => {
    const keyword = selfQuery.trim().toLowerCase()
    if (!keyword) return sessions
    return sessions.filter(session => {
      const name = String(session.displayName || session.username || '').toLowerCase()
      const username = String(session.username || '').toLowerCase()
      return name.includes(keyword) || username.includes(keyword)
    })
  }, [selfQuery, sessions])

  const toggleSession = (sessionId: string) => {
    setSelectedSessionIds(prev => (
      prev.includes(sessionId)
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId]
    ))
  }

  const selectVisible = () => {
    setSelectedSessionIds(prev => {
      const next = new Set(prev)
      for (const session of visibleSessions) next.add(session.username)
      return Array.from(next)
    })
  }

  const clearVisible = () => {
    const visible = new Set(visibleSessions.map(session => session.username))
    setSelectedSessionIds(prev => prev.filter(id => !visible.has(id)))
  }

  const createSelfPersona = async () => {
    if (!selectedSessionIds.length || creatingSelf) return
    setCreatingSelf(true)
    setSelfError(null)
    try {
      const result = await window.electronAPI.aiPersona.createSelf({
        sessionIds: selectedSessionIds,
        options: { dateRange: 'all' }
      })
      if (result.success && result.data) {
        setShowSelfModal(false)
        await loadPersonas()
        navigate(`/ai-persona/${result.data.id}`)
      } else {
        setSelfError(result.error || '生成失败')
      }
    } catch (e: any) {
      setSelfError(e.message || '生成失败')
    } finally {
      setCreatingSelf(false)
    }
  }

  const filtered = searchQuery.trim()
    ? personas.filter(p =>
        String(p.contactName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.kind === 'self' && '我的ai分身'.includes(searchQuery.toLowerCase()))
      )
    : personas

  const formatTime = (ts: number): string => {
    const d = new Date(ts)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="persona-library-page">
        <div className="persona-library-loading">
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
          <p>加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="persona-library-page">
      <div className="persona-library-header">
        <div className="persona-library-title">
          <h1>我的 AI 分身</h1>
          <span className="persona-count">{personas.length} 个分身</span>
        </div>
        <div className="persona-library-header-actions">
          {personas.length > 0 && (
            <div className="persona-library-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="搜索分身名称或标签..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          )}
          <button className="btn-go-chat persona-create-self-btn" onClick={openSelfPersonaModal}>
            <Plus size={16} />
            <span>生成我的AI分身</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="persona-library-error">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={loadPersonas}>重试</button>
        </div>
      )}

      {!loading && !error && personas.length === 0 && (
        <div className="persona-library-empty">
          <div className="empty-illustration">
            <User size={48} />
          </div>
          <h2>还没有 AI 分身</h2>
          <p>可以先生成一个联系人分身，或者直接创建“我的 AI 分身”。</p>
          <button className="btn-go-chat" onClick={openSelfPersonaModal}>
            <Plus size={16} />
            生成我的AI分身
          </button>
        </div>
      )}

      {filtered.length === 0 && personas.length > 0 && (
        <div className="persona-library-empty">
          <div className="empty-illustration">
            <Search size={48} />
          </div>
          <h2>没有找到匹配的分身</h2>
          <p>试试用不同的关键词搜索。</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="persona-library-grid">
          {filtered.map(persona => (
            <div
              key={persona.id}
              className="persona-card"
              onClick={() => navigate(`/ai-persona/${persona.id}`)}
            >
              <div className="persona-card-header">
                <div className="persona-card-avatar">
                  {persona.avatarUrl ? (
                    <img src={persona.avatarUrl} alt="" />
                  ) : (
                    <span>{persona.kind === 'self' ? '我' : (persona.contactName?.[0] || '?')}</span>
                  )}
                </div>
                <div className="persona-card-info">
                  <div className="persona-card-name">
                    {persona.kind === 'self' ? '我的 AI 分身' : persona.contactName}
                  </div>
                  <div className="persona-card-time">
                    <Clock size={12} />
                    {formatTime(persona.updatedAt)}
                  </div>
                </div>
                <div className="persona-card-completeness">
                  <div className="completeness-ring" style={{ '--percent': persona.profileCompleteness } as React.CSSProperties}>
                    <span>{persona.profileCompleteness}%</span>
                  </div>
                </div>
              </div>

              <div className="persona-card-tags">
                {persona.kind === 'self' && <span className="persona-tag"><Tag size={10} />我的</span>}
                {persona.tags.map(tag => (
                  <span key={tag} className="persona-tag"><Tag size={10} />{tag}</span>
                ))}
              </div>

              <div className="persona-card-meta">
                <span>来源：{persona.sourceMessageCount} 条消息</span>
              </div>

              <div className="persona-card-actions" onClick={e => e.stopPropagation()}>
                <button
                  className="persona-action-btn"
                  title="开始对话"
                  onClick={() => navigate(`/ai-persona/${persona.id}?tab=chat`)}
                >
                  <MessageSquare size={14} />
                  <span>对话</span>
                </button>
                <button
                  className="persona-action-btn"
                  title="查看档案"
                  onClick={() => navigate(`/ai-persona/${persona.id}?tab=profile`)}
                >
                  <FileText size={14} />
                  <span>档案</span>
                </button>
                <button
                  className="persona-action-btn"
                  title="重新生成"
                  onClick={() => handleRefresh(persona.id)}
                >
                  <RefreshCw size={14} />
                  <span>更新</span>
                </button>
                <button
                  className="persona-action-btn persona-action-btn-danger"
                  title="删除"
                  onClick={() => setDeleteConfirmId(persona.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {deleteConfirmId === persona.id && (
                <div className="persona-card-delete-confirm" onClick={e => e.stopPropagation()}>
                  <span>确认删除「{persona.kind === 'self' ? '我的 AI 分身' : persona.contactName}」吗？</span>
                  <div className="delete-confirm-actions">
                    <button onClick={() => setDeleteConfirmId(null)}>取消</button>
                    <button className="btn-danger" onClick={() => handleDelete(persona.id)}>删除</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="persona-library-footer-hint">
        <AlertCircle size={12} />
        <span>AI 分身基于历史聊天记录生成，仅用于沟通演练与关系理解，不代表本人真实想法。</span>
      </div>

      {showSelfModal && createPortal(
        <div className="persona-modal-overlay" onClick={() => !creatingSelf && setShowSelfModal(false)}>
          <div className="persona-modal-card" onClick={e => e.stopPropagation()}>
            <div className="persona-modal-header">
              <div>
                <h3>生成我的 AI 分身</h3>
                <p>选择多个私聊或群聊，系统会只提取“我发出的消息”来生成分身。</p>
              </div>
              <button className="persona-modal-close" onClick={() => !creatingSelf && setShowSelfModal(false)}>×</button>
            </div>

            <div className="persona-modal-toolbar">
              <div className="persona-library-search persona-modal-search">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="搜索会话..."
                  value={selfQuery}
                  onChange={e => setSelfQuery(e.target.value)}
                />
              </div>
              <div className="persona-modal-toolbar-actions">
                <button type="button" onClick={selectVisible}>全选可见</button>
                <button type="button" onClick={clearVisible}>清除可见</button>
              </div>
            </div>

            {selfError && (
              <div className="persona-library-error persona-modal-error">
                <AlertCircle size={16} />
                <span>{selfError}</span>
              </div>
            )}

            <div className="persona-session-list">
              {loadingSessions ? (
                <div className="persona-library-loading" style={{ padding: '36px 0' }}>
                  <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                  <p>正在加载会话...</p>
                </div>
              ) : visibleSessions.length === 0 ? (
                <div className="persona-session-empty">没有可用会话</div>
              ) : (
                visibleSessions.map(session => {
                  const checked = selectedSessionIds.includes(session.username)
                  const isGroup = session.username.endsWith('@chatroom')
                  return (
                    <label key={session.username} className={`persona-session-item ${checked ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSession(session.username)}
                      />
                      <div className="persona-session-avatar">
                        {session.avatarUrl ? <img src={session.avatarUrl} alt="" /> : <span>{(session.displayName || session.username || '?')[0]}</span>}
                      </div>
                      <div className="persona-session-meta">
                        <div className="persona-session-name">{session.displayName || session.username}</div>
                        <div className="persona-session-subtitle">
                          {isGroup ? '群聊' : '私聊'} · {session.summary || '暂无摘要'}
                        </div>
                      </div>
                    </label>
                  )
                })
              )}
            </div>

            <div className="persona-modal-footer">
              <span className="persona-modal-count">已选择 {selectedSessionIds.length} 个会话</span>
              <div className="persona-modal-footer-actions">
                <button type="button" onClick={() => setShowSelfModal(false)} disabled={creatingSelf}>取消</button>
                <button
                  type="button"
                  className="btn-go-chat"
                  onClick={createSelfPersona}
                  disabled={creatingSelf || selectedSessionIds.length === 0}
                >
                  {creatingSelf ? '生成中...' : '开始生成'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default AiPersonaLibraryPage
