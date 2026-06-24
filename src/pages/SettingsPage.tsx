import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import { useChatStore } from '../stores/chatStore'
import { useThemeStore, themes } from '../stores/themeStore'
import { useAnalyticsStore } from '../stores/analyticsStore'
import { dialog } from '../services/ipc'
import * as configService from '../services/config'
import type { ChatSession, ContactInfo } from '../types/models'
import {
  Eye, EyeOff, FolderSearch, FolderOpen, Search, Copy,
  RotateCcw, Trash2, Plug, Check, Sun, Moon, Monitor,
  Palette, Database, HardDrive, Info, RefreshCw, ChevronDown, Download, Mic,
  ShieldCheck, Fingerprint, Lock, KeyRound, Bell, Globe, BarChart2, X, UserRound,
  Sparkles, Loader2, CheckCircle2, XCircle
} from 'lucide-react'
import { Avatar } from '../components/Avatar'
import './SettingsPage.scss'

type SettingsTab =
  | 'appearance'
  | 'notification'
  | 'antiRevoke'
  | 'database'
  | 'models'
  | 'cache'
  | 'api'
  | 'obsidian'
  | 'updates'
  | 'security'
  | 'about'
  | 'analytics'
  | 'aiCommon'
  | 'insight'
  | 'aiFootprint'
  | 'insightPrompt'
  | 'personaPrompt'
  | 'topicsPrompt'
  | 'replyPrompt'
  | 'autoDownload'

const tabs: { id: Exclude<SettingsTab, 'insight' | 'aiFootprint'>; label: string; icon: React.ElementType }[] = [
  { id: 'appearance', label: '外观', icon: Palette },
  { id: 'notification', label: '通知', icon: Bell },
  { id: 'antiRevoke', label: '防撤回', icon: RotateCcw },
  { id: 'database', label: '数据库连接', icon: Database },
  { id: 'models', label: '模型管理', icon: Mic },
  { id: 'autoDownload', label: '自动下载', icon: Download },
  { id: 'cache', label: '缓存', icon: HardDrive },
  { id: 'api', label: 'API 服务', icon: Globe },
  { id: 'obsidian', label: 'Obsidian', icon: Plug },
  { id: 'analytics', label: '分析', icon: BarChart2 },
  { id: 'security', label: '安全', icon: ShieldCheck },
  { id: 'updates', label: '版本更新', icon: RefreshCw },
  { id: 'about', label: '关于', icon: Info }
]

const filteredTabs = tabs.filter(tab => {
  if (tab.id === 'autoDownload') {
    const p = (window as any).electronAPI.process
    return (p.platform === 'win32' && p.arch === 'x64') || p.platform === 'darwin'
  }
  return true
})

const aiTabs: Array<{ id: Extract<SettingsTab, 'aiCommon' | 'insight' | 'aiFootprint' | 'insightPrompt' | 'personaPrompt' | 'topicsPrompt' | 'replyPrompt'>; label: string }> = [
  { id: 'aiCommon', label: '基础配置' },
  { id: 'insight', label: 'AI 见解' },
  { id: 'aiFootprint', label: 'AI 足迹' },
  { id: 'insightPrompt', label: '洞察分析提示词' },
  { id: 'personaPrompt', label: '人物画像提示词' },
  { id: 'topicsPrompt', label: '话题分析提示词' },
  { id: 'replyPrompt', label: 'AI回复提示词' }
]

const isMac = navigator.userAgent.toLowerCase().includes('mac')
const isLinux = navigator.userAgent.toLowerCase().includes('linux')
const isWindows = !isMac && !isLinux
const MAC_KEY_FAQ_URL = 'https://github.com/AXXZSTHL/WeFlow/blob/main/docs/MAC-KEY-FAQ.md'

const dbDirName = isMac ? '2.0b4.0.9 目录' : 'xwechat_files 目录'
const dbPathPlaceholder = isMac
    ? '例如: ~/Library/Containers/com.tencent.xinWeChat/Data/Library/Application Support/com.tencent.xinWeChat/2.0b4.0.9'
    : isLinux
        ? '例如: ~/.local/share/WeChat/xwechat_files 或者 ~/Documents/xwechat_files'
        : '例如: C:\\Users\\xxx\\Documents\\xwechat_files'


interface WxidOption {
  wxid: string
  modifiedTime: number
  nickname?: string
  avatarUrl?: string
}

type SessionFilterType = configService.MessagePushSessionType
type SessionFilterTypeValue = 'all' | SessionFilterType
type SessionFilterMode = 'all' | 'whitelist' | 'blacklist'
type InsightSessionFilterTypeValue = 'all' | 'private' | 'group' | 'official'

interface SessionFilterOption {
  username: string
  displayName: string
  avatarUrl?: string
  type: SessionFilterType
}

const sessionFilterTypeOptions: Array<{ value: SessionFilterTypeValue; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'private', label: '私聊' },
  { value: 'group', label: '群聊' },
  { value: 'official', label: '订阅号/服务号' },
  { value: 'other', label: '其他/非好友' }
]

const insightFilterTypeOptions: Array<{ value: InsightSessionFilterTypeValue; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'private', label: '私聊' },
  { value: 'group', label: '群聊' },
  { value: 'official', label: '订阅号/服务号' }
]

interface SettingsPageProps {
  onClose?: () => void
}

function SettingsPage({ onClose }: SettingsPageProps = {}) {
  const location = useLocation()
  const {
    isDbConnected,
    setDbConnected,
    setLoading,
    reset,
    updateInfo,
    setUpdateInfo,
    isDownloading,
    setIsDownloading,
    downloadProgress,
    setDownloadProgress,
    showUpdateDialog,
    setShowUpdateDialog,
  } = useAppStore()

  const chatSessions = useChatStore((state) => state.sessions)
  const setChatSessions = useChatStore((state) => state.setSessions)
  const resetChatStore = useChatStore((state) => state.reset)
  const { currentTheme, themeMode, setTheme, setThemeMode } = useThemeStore()
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  const effectiveMode = themeMode === 'system' ? (systemDark ? 'dark' : 'light') : themeMode
  const clearAnalyticsStoreCache = useAnalyticsStore((state) => state.clearCache)

  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance')
  const [aiGroupExpanded, setAiGroupExpanded] = useState(false)
  const [decryptKey, setDecryptKey] = useState('')
  const [imageXorKey, setImageXorKey] = useState('')
  const [imageAesKey, setImageAesKey] = useState('')
  const [dbPath, setDbPath] = useState('')
  const [wxid, setWxid] = useState('')
  const [wxidOptions, setWxidOptions] = useState<WxidOption[]>([])
  const [showWxidSelect, setShowWxidSelect] = useState(false)
  const [cachePath, setCachePath] = useState('')
  const [imageKeyProgress, setImageKeyProgress] = useState(0)
  const [imageKeyPercent, setImageKeyPercent] = useState<number | null>(null)

  const [logEnabled, setLogEnabled] = useState(false)
  const [autoDownloadHighRes, setAutoDownloadHighRes] = useState(false)
  const [whisperModelName, setWhisperModelName] = useState('base')
  const [whisperModelDir, setWhisperModelDir] = useState('')
  const [isWhisperDownloading, setIsWhisperDownloading] = useState(false)
  const [whisperDownloadProgress, setWhisperDownloadProgress] = useState(0)
  const [whisperProgressData, setWhisperProgressData] = useState<{ downloaded: number; total: number; speed: number }>({ downloaded: 0, total: 0, speed: 0 })
  const [whisperModelStatus, setWhisperModelStatus] = useState<{ exists: boolean; modelPath?: string; tokensPath?: string } | null>(null)

  const [httpApiToken, setHttpApiToken] = useState('')

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const generateRandomToken = async () => {
    // 生成 32 字符的十六进制随机字符串 (16 bytes)
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    const token = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')

    setHttpApiToken(token)
    await configService.setHttpApiToken(token)
    showMessage('已生成并保存新的 Access Token', true)
  }

  const clearApiToken = async () => {
    setHttpApiToken('')
    await configService.setHttpApiToken('')
    showMessage('已清除 Access Token，API 将允许无鉴权访问', true)
  }



  const [autoTranscribeVoice, setAutoTranscribeVoice] = useState(false)
  const [transcribeLanguages, setTranscribeLanguages] = useState<string[]>(['zh'])

  const [notificationEnabled, setNotificationEnabled] = useState(true)
  const [notificationPosition, setNotificationPosition] = useState<'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center'>('top-right')
  const [notificationFilterMode, setNotificationFilterMode] = useState<'all' | 'whitelist' | 'blacklist'>('all')
  const [notificationFilterList, setNotificationFilterList] = useState<string[]>([])
  const [launchAtStartup, setLaunchAtStartup] = useState(false)
  const [launchAtStartupSupported, setLaunchAtStartupSupported] = useState(isWindows || isMac)
  const [launchAtStartupReason, setLaunchAtStartupReason] = useState('')
  const [silentStartup, setSilentStartup] = useState(false)
  const [windowCloseBehavior, setWindowCloseBehavior] = useState<configService.WindowCloseBehavior>('ask')
  const [quoteLayout, setQuoteLayout] = useState<configService.QuoteLayout>('quote-top')
  const [updateChannel, setUpdateChannel] = useState<configService.UpdateChannel>('stable')
  const [filterSearchKeyword, setFilterSearchKeyword] = useState('')
  const [notificationTypeFilter, setNotificationTypeFilter] = useState<SessionFilterTypeValue>('all')
  const [filterModeDropdownOpen, setFilterModeDropdownOpen] = useState(false)
  const [positionDropdownOpen, setPositionDropdownOpen] = useState(false)
  const [closeBehaviorDropdownOpen, setCloseBehaviorDropdownOpen] = useState(false)
  const [insightFilterModeDropdownOpen, setInsightFilterModeDropdownOpen] = useState(false)

  const [wordCloudExcludeWords, setWordCloudExcludeWords] = useState<string[]>([])
  const [excludeWordsInput, setExcludeWordsInput] = useState('')

  // 数据收集同意状态
  const [analyticsConsent, setAnalyticsConsent] = useState<boolean>(false)





  const [isLoading, setIsLoadingState] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isDetectingPath, setIsDetectingPath] = useState(false)
  const [isFetchingDbKey, setIsFetchingDbKey] = useState(false)
  const [isFetchingImageKey, setIsFetchingImageKey] = useState(false)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [isUpdatingLaunchAtStartup, setIsUpdatingLaunchAtStartup] = useState(false)
  const [isUpdatingSilentStartup, setIsUpdatingSilentStartup] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null)
  const [showDecryptKey, setShowDecryptKey] = useState(false)
  const [dbKeyStatus, setDbKeyStatus] = useState('')
  const [dbKeyError, setDbKeyError] = useState('')
  const [imageKeyStatus, setImageKeyStatus] = useState('')
  const [isManualStartPrompt, setIsManualStartPrompt] = useState(false)
  const [isClearingAnalyticsCache, setIsClearingAnalyticsCache] = useState(false)
  const [isClearingImageCache, setIsClearingImageCache] = useState(false)
  const [isClearingAllCache, setIsClearingAllCache] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // 安全设置 state
  const [authEnabled, setAuthEnabled] = useState(false)
  const [authUseHello, setAuthUseHello] = useState(false)
  const [helloAvailable, setHelloAvailable] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [helloPassword, setHelloPassword] = useState('')
  const [disableLockPassword, setDisableLockPassword] = useState('')
  const [showDisableLockInput, setShowDisableLockInput] = useState(false)
  const [isLockMode, setIsLockMode] = useState(false)
  const [isSettingHello, setIsSettingHello] = useState(false)

  // HTTP API 设置 state
  const [httpApiEnabled, setHttpApiEnabled] = useState(false)
  const [httpApiPort, setHttpApiPort] = useState(5031)
  const [httpApiHost, setHttpApiHost] = useState('127.0.0.1')
  const [httpApiRunning, setHttpApiRunning] = useState(false)
  const [httpApiMediaExportPath, setHttpApiMediaExportPath] = useState('')
  const [obsidianVaultPath, setObsidianVaultPath] = useState('')
  const [isTogglingApi, setIsTogglingApi] = useState(false)
  const [showApiWarning, setShowApiWarning] = useState(false)
  const [messagePushEnabled, setMessagePushEnabled] = useState(false)
  const [messagePushFilterMode, setMessagePushFilterMode] = useState<configService.MessagePushFilterMode>('all')
  const [messagePushFilterList, setMessagePushFilterList] = useState<string[]>([])
  const [messagePushFilterDropdownOpen, setMessagePushFilterDropdownOpen] = useState(false)
  const [messagePushFilterSearchKeyword, setMessagePushFilterSearchKeyword] = useState('')
  const [messagePushTypeFilter, setMessagePushTypeFilter] = useState<SessionFilterTypeValue>('all')
  const [messagePushContactOptions, setMessagePushContactOptions] = useState<ContactInfo[]>([])
  const [antiRevokeSessions, setAntiRevokeSessions] = useState<ChatSession[]>([])
  const [antiRevokeSearchKeyword, setAntiRevokeSearchKeyword] = useState('')
  const [antiRevokeSelectedIds, setAntiRevokeSelectedIds] = useState<Set<string>>(new Set())
  const [antiRevokeStatusMap, setAntiRevokeStatusMap] = useState<Record<string, { installed?: boolean; loading?: boolean; error?: string }>>({})
  const [isAntiRevokeRefreshing, setIsAntiRevokeRefreshing] = useState(false)
  const [isAntiRevokeInstalling, setIsAntiRevokeInstalling] = useState(false)
  const [isAntiRevokeUninstalling, setIsAntiRevokeUninstalling] = useState(false)
  const [antiRevokeSummary, setAntiRevokeSummary] = useState<{ action: 'refresh' | 'install' | 'uninstall'; success: number; failed: number } | null>(null)

  const isClearingCache = isClearingAnalyticsCache || isClearingImageCache || isClearingAllCache

  // AI 见解 state
  const [aiInsightEnabled, setAiInsightEnabled] = useState(false)
  const [aiModelApiBaseUrl, setAiModelApiBaseUrl] = useState('')
  const [aiModelApiKey, setAiModelApiKey] = useState('')
  const [aiModelApiModel, setAiModelApiModel] = useState('gpt-4o-mini')
  const [aiModelApiMaxTokens, setAiModelApiMaxTokens] = useState(200)
  const [aiInsightSilenceDays, setAiInsightSilenceDays] = useState(3)
  const [aiInsightAllowContext, setAiInsightAllowContext] = useState(false)
  const [aiInsightAllowMomentsContext, setAiInsightAllowMomentsContext] = useState(false)
  const [aiInsightMomentsContextCount, setAiInsightMomentsContextCount] = useState(5)
  const [aiInsightMomentsBindings, setAiInsightMomentsBindings] = useState<Record<string, configService.AiInsightMomentsBinding>>({})
  const [isTestingInsight, setIsTestingInsight] = useState(false)
  const [insightTestResult, setInsightTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showInsightApiKey, setShowInsightApiKey] = useState(false)
  const [isTriggeringInsightTest, setIsTriggeringInsightTest] = useState(false)
  const [insightTriggerResult, setInsightTriggerResult] = useState<{ success: boolean; message: string } | null>(null)
  const [aiInsightFilterMode, setAiInsightFilterMode] = useState<configService.AiInsightFilterMode>('whitelist')
  const [aiInsightFilterList, setAiInsightFilterList] = useState<Set<string>>(new Set())
  const [insightFilterType, setInsightFilterType] = useState<InsightSessionFilterTypeValue>('all')
  const [insightWhitelistSearch, setInsightWhitelistSearch] = useState('')
  const [aiInsightCooldownMinutes, setAiInsightCooldownMinutes] = useState(120)
  const [aiInsightScanIntervalHours, setAiInsightScanIntervalHours] = useState(4)
  const [aiInsightContextCount, setAiInsightContextCount] = useState(40)
  const [aiInsightSystemPrompt, setAiInsightSystemPrompt] = useState('')
  const [aiInsightAnalysisPrompt, setAiInsightAnalysisPrompt] = useState('')
  const [aiPersonaAnalysisPrompt, setAiPersonaAnalysisPrompt] = useState('')
  const [aiTopicsAnalysisPrompt, setAiTopicsAnalysisPrompt] = useState('')
  const [aiReplyPrompt, setAiReplyPrompt] = useState('')
  const [aiReplyRoles, setAiReplyRoles] = useState<Array<{ id: string; label: string; icon: string; prompt: string }>>([])
  const [aiInsightTelegramEnabled, setAiInsightTelegramEnabled] = useState(false)
  const [aiInsightTelegramToken, setAiInsightTelegramToken] = useState('')
  const [aiInsightTelegramChatIds, setAiInsightTelegramChatIds] = useState('')
  const [aiInsightAllowSocialContext, setAiInsightAllowSocialContext] = useState(false)
  const [aiInsightSocialContextCount, setAiInsightSocialContextCount] = useState(3)
  const [aiInsightWeiboCookie, setAiInsightWeiboCookie] = useState('')
  const [aiInsightWeiboBindings, setAiInsightWeiboBindings] = useState<Record<string, configService.AiInsightWeiboBinding>>({})
  const [showWeiboCookieModal, setShowWeiboCookieModal] = useState(false)
  const [weiboCookieDraft, setWeiboCookieDraft] = useState('')
  const [weiboCookieError, setWeiboCookieError] = useState('')
  const [isSavingWeiboCookie, setIsSavingWeiboCookie] = useState(false)
  const [weiboBindingDrafts, setWeiboBindingDrafts] = useState<Record<string, string>>({})
  const [weiboBindingErrors, setWeiboBindingErrors] = useState<Record<string, string>>({})
  const [weiboBindingLoadingSessionId, setWeiboBindingLoadingSessionId] = useState<string | null>(null)
  const [aiFootprintEnabled, setAiFootprintEnabled] = useState(false)
  const [aiFootprintSystemPrompt, setAiFootprintSystemPrompt] = useState('')
  const [aiInsightDebugLogEnabled, setAiInsightDebugLogEnabled] = useState(false)

  // 自动下载图片
  const [autoDownloadStatus, setAutoDownloadStatus] = useState<{ isHooked: boolean; pid: number | null; supported: boolean } | null>(null)
  const [autoDownloadSelectedIds, setAutoDownloadSelectedIds] = useState<Set<string>>(new Set())
  const [autoDownloadSearchKeyword, setAutoDownloadSearchKeyword] = useState('')

  // 检查 Hello 可用性
  useEffect(() => {
    setHelloAvailable(isWindows)
  }, [])

  // 检查 HTTP API 服务状态
  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        const status = await window.electronAPI.http.status()
        setHttpApiRunning(status.running)
        if (status.port) {
          setHttpApiPort(status.port)
        }
        if (status.mediaExportPath) {
          setHttpApiMediaExportPath(status.mediaExportPath)
        }
      } catch (e) {
        console.error('检查 API 状态失败:', e)
      }
    }
    checkApiStatus()
  }, [])

  useEffect(() => {
    loadConfig()
    loadAppVersion()
    return () => {
      Object.values(saveTimersRef.current).forEach((timer) => clearTimeout(timer))
    }
  }, [])

  useEffect(() => {
    const initialTab = (location.state as { initialTab?: SettingsTab } | null)?.initialTab
    if (!initialTab) return
    setActiveTab(initialTab)
  }, [location.state])

  useEffect(() => {
    if (activeTab === 'aiCommon' || activeTab === 'insight' || activeTab === 'aiFootprint' || activeTab === 'insightPrompt' || activeTab === 'personaPrompt' || activeTab === 'topicsPrompt' || activeTab === 'replyPrompt') {
      setAiGroupExpanded(true)
    }
  }, [activeTab])

  useEffect(() => {
    if (!onClose) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    const removeDb = window.electronAPI.key.onDbKeyStatus((payload: { message: string; level: number }) => {
      setDbKeyStatus(payload.message)
    })

    const removeImage = window.electronAPI.key.onImageKeyStatus((payload: { message: string, percent?: number }) => {
      let msg = payload.message;
      let pct = payload.percent;

      // 如果后端没有显式传 percent，则用正则从字符串中提取如 "(12.5%)"
      if (pct === undefined) {
        const match = msg.match(/\(([\d.]+)%\)/);
        if (match) {
          pct = parseFloat(match[1]);
          // 将百分比从文本中剥离，让 UI 更清爽
          msg = msg.replace(/\s*\([\d.]+%\)/, '');
        }
      }

      setImageKeyStatus(msg);
      if (pct !== undefined) {
        setImageKeyPercent(pct);
      } else if (msg.includes('启动多核') || msg.includes('定位') || msg.includes('准备')) {
        // 预热阶段
        setImageKeyPercent(0);
      }
    })
    return () => {
      removeDb?.()
      removeImage?.()
    }
  }, [])

  // 点击外部关闭自定义下拉框
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.custom-select')) {
        setFilterModeDropdownOpen(false)
        setPositionDropdownOpen(false)
        setCloseBehaviorDropdownOpen(false)
        setMessagePushFilterDropdownOpen(false)
        setInsightFilterModeDropdownOpen(false)
      }
    }
    if (filterModeDropdownOpen || positionDropdownOpen || closeBehaviorDropdownOpen || messagePushFilterDropdownOpen || insightFilterModeDropdownOpen) {
      document.addEventListener('click', handleClickOutside)
    }
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [closeBehaviorDropdownOpen, filterModeDropdownOpen, insightFilterModeDropdownOpen, messagePushFilterDropdownOpen, positionDropdownOpen])


  const loadConfig = async () => {
    try {
      const savedKey = await configService.getDecryptKey()
      const savedPath = await configService.getDbPath()
      const savedWxid = await configService.getMyWxid()
      const savedCachePath = await configService.getCachePath()

      const savedExportPath = await configService.getExportPath()
      const savedLogEnabled = await configService.getLogEnabled()
      const savedImageXorKey = await configService.getImageXorKey()
      const savedImageAesKey = await configService.getImageAesKey()
      const savedWhisperModelName = await configService.getWhisperModelName()
      const savedWhisperModelDir = await configService.getWhisperModelDir()
      const savedAutoTranscribe = await configService.getAutoTranscribeVoice()
      const savedTranscribeLanguages = await configService.getTranscribeLanguages()
      const savedNotificationEnabled = await configService.getNotificationEnabled()
      const savedNotificationPosition = await configService.getNotificationPosition()
      const savedNotificationFilterMode = await configService.getNotificationFilterMode()
      const savedNotificationFilterList = await configService.getNotificationFilterList()
      const savedMessagePushEnabled = await configService.getMessagePushEnabled()
      const savedMessagePushFilterMode = await configService.getMessagePushFilterMode()
      const savedMessagePushFilterList = await configService.getMessagePushFilterList()
      const contactsResult = await window.electronAPI.chat.getContacts({ lite: true })
      const savedLaunchAtStartupStatus = await window.electronAPI.app.getLaunchAtStartupStatus()
      const savedSilentStartup = await configService.getSilentStartup()
      const savedWindowCloseBehavior = await configService.getWindowCloseBehavior()
      const savedQuoteLayout = await configService.getQuoteLayout()
      const savedUpdateChannel = await configService.getUpdateChannel()

      const savedAuthEnabled = await window.electronAPI.auth.verifyEnabled()
      const savedAuthUseHello = await configService.getAuthUseHello()
      const savedIsLockMode = await window.electronAPI.auth.isLockMode()

      const savedHttpApiToken = await configService.getHttpApiToken()
      if (savedHttpApiToken) setHttpApiToken(savedHttpApiToken)

      const savedApiPort = await configService.getHttpApiPort()
      if (savedApiPort) setHttpApiPort(savedApiPort)

      const savedApiHost = await configService.getHttpApiHost()
      if (savedApiHost) setHttpApiHost(savedApiHost)

      const savedObsidianVaultPath = await configService.getObsidianVaultPath()
      if (savedObsidianVaultPath) setObsidianVaultPath(savedObsidianVaultPath)

      setAuthEnabled(savedAuthEnabled)
      setAuthUseHello(savedAuthUseHello)
      setIsLockMode(savedIsLockMode)

      if (savedPath) setDbPath(savedPath)
      if (savedWxid) setWxid(savedWxid)
      if (savedCachePath) setCachePath(savedCachePath)


      const wxidConfig = savedWxid ? await configService.getWxidConfig(savedWxid) : null
      const decryptKeyToUse = wxidConfig?.decryptKey ?? savedKey ?? ''
      const imageXorKeyToUse = typeof wxidConfig?.imageXorKey === 'number'
        ? wxidConfig.imageXorKey
        : savedImageXorKey
      const imageAesKeyToUse = wxidConfig?.imageAesKey ?? savedImageAesKey ?? ''

      setDecryptKey(decryptKeyToUse)
      if (typeof imageXorKeyToUse === 'number') {
        setImageXorKey(`0x${imageXorKeyToUse.toString(16).toUpperCase().padStart(2, '0')}`)
      } else {
        setImageXorKey('')
      }
      setImageAesKey(imageAesKeyToUse)
      setLogEnabled(savedLogEnabled)
      setAutoTranscribeVoice(savedAutoTranscribe)
      setTranscribeLanguages(savedTranscribeLanguages)

      setNotificationEnabled(savedNotificationEnabled)
      setNotificationPosition(savedNotificationPosition)
      setNotificationFilterMode(savedNotificationFilterMode)
      setNotificationFilterList(savedNotificationFilterList)
      setMessagePushEnabled(savedMessagePushEnabled)
      setMessagePushFilterMode(savedMessagePushFilterMode)
      setMessagePushFilterList(savedMessagePushFilterList)
      if (contactsResult.success && Array.isArray(contactsResult.contacts)) {
        setMessagePushContactOptions(contactsResult.contacts as ContactInfo[])
      }
      setLaunchAtStartup(savedLaunchAtStartupStatus.enabled)
      setLaunchAtStartupSupported(savedLaunchAtStartupStatus.supported)
      setLaunchAtStartupReason(savedLaunchAtStartupStatus.reason || '')
      setSilentStartup(savedSilentStartup)
      setWindowCloseBehavior(savedWindowCloseBehavior)
      setQuoteLayout(savedQuoteLayout)
      if (savedUpdateChannel) {
        setUpdateChannel(savedUpdateChannel)
      } else {
        const currentVersion = await window.electronAPI.app.getVersion()
        if (/^0\.\d{2}\.\d+$/i.test(currentVersion) || /-preview\.\d+\.\d+$/i.test(currentVersion)) {
          setUpdateChannel('preview')
        } else if (/^\d{2}\.\d{1,2}\.\d{1,2}$/i.test(currentVersion) || /-dev\.\d+\.\d+\.\d+$/i.test(currentVersion) || /(alpha|beta|rc)/i.test(currentVersion)) {
          setUpdateChannel('dev')
        } else {
          setUpdateChannel('stable')
        }
      }

      const savedExcludeWords = await configService.getWordCloudExcludeWords()
      setWordCloudExcludeWords(savedExcludeWords)
      setExcludeWordsInput(savedExcludeWords.join('\n'))

      const savedAutoDownloadHighRes = await configService.getAutoDownloadHighRes()
      const savedAutoDownloadWhitelist = await configService.getAutoDownloadWhitelist()
      const savedAnalyticsConsent = await configService.getAnalyticsConsent()
      setAnalyticsConsent(savedAnalyticsConsent ?? false)
      setAutoDownloadHighRes(savedAutoDownloadHighRes)
      setAutoDownloadSelectedIds(new Set(savedAutoDownloadWhitelist))


      // 如果语言列表为空，保存默认值
      if (!savedTranscribeLanguages || savedTranscribeLanguages.length === 0) {
        const defaultLanguages = ['zh']
        setTranscribeLanguages(defaultLanguages)
        await configService.setTranscribeLanguages(defaultLanguages)
      }


      if (savedWhisperModelDir) setWhisperModelDir(savedWhisperModelDir)

      // 加载 AI 见解配置
      const savedAiInsightEnabled = await configService.getAiInsightEnabled()
      const savedAiModelApiBaseUrl = await configService.getAiModelApiBaseUrl()
      const savedAiModelApiKey = await configService.getAiModelApiKey()
      const savedAiModelApiModel = await configService.getAiModelApiModel()
      const savedAiModelApiMaxTokens = await configService.getAiModelApiMaxTokens()
      const savedAiInsightSilenceDays = await configService.getAiInsightSilenceDays()
      const savedAiInsightAllowContext = await configService.getAiInsightAllowContext()
      const savedAiInsightAllowMomentsContext = await configService.getAiInsightAllowMomentsContext()
      const savedAiInsightMomentsContextCount = await configService.getAiInsightMomentsContextCount()
      const savedAiInsightMomentsBindings = await configService.getAiInsightMomentsBindings()
      const savedAiInsightFilterMode = await configService.getAiInsightFilterMode()
      const savedAiInsightFilterList = await configService.getAiInsightFilterList()
      const savedAiInsightCooldownMinutes = await configService.getAiInsightCooldownMinutes()
      const savedAiInsightScanIntervalHours = await configService.getAiInsightScanIntervalHours()
      const savedAiInsightContextCount = await configService.getAiInsightContextCount()
      const savedAiInsightSystemPrompt = await configService.getAiInsightSystemPrompt()
      const savedAiInsightTelegramEnabled = await configService.getAiInsightTelegramEnabled()
      const savedAiInsightTelegramToken = await configService.getAiInsightTelegramToken()
      const savedAiInsightTelegramChatIds = await configService.getAiInsightTelegramChatIds()
      const savedAiInsightAllowSocialContext = await configService.getAiInsightAllowSocialContext()
      const savedAiInsightSocialContextCount = await configService.getAiInsightSocialContextCount()
      const savedAiInsightWeiboCookie = await configService.getAiInsightWeiboCookie()
      const savedAiInsightWeiboBindings = await configService.getAiInsightWeiboBindings()
      const savedAiFootprintEnabled = await configService.getAiFootprintEnabled()
      const savedAiFootprintSystemPrompt = await configService.getAiFootprintSystemPrompt()
      const savedAiInsightDebugLogEnabled = await configService.getAiInsightDebugLogEnabled()

      setAiInsightEnabled(savedAiInsightEnabled)
      setAiModelApiBaseUrl(savedAiModelApiBaseUrl)
      setAiModelApiKey(savedAiModelApiKey)
      setAiModelApiModel(savedAiModelApiModel)
      setAiModelApiMaxTokens(savedAiModelApiMaxTokens)
      setAiInsightSilenceDays(savedAiInsightSilenceDays)
      setAiInsightAllowContext(savedAiInsightAllowContext)
      setAiInsightAllowMomentsContext(savedAiInsightAllowMomentsContext)
      setAiInsightMomentsContextCount(savedAiInsightMomentsContextCount)
      setAiInsightMomentsBindings(savedAiInsightMomentsBindings)
      setAiInsightFilterMode(savedAiInsightFilterMode)
      setAiInsightFilterList(new Set(savedAiInsightFilterList))
      setAiInsightCooldownMinutes(savedAiInsightCooldownMinutes)
      setAiInsightScanIntervalHours(savedAiInsightScanIntervalHours)
      setAiInsightContextCount(savedAiInsightContextCount)
      setAiInsightSystemPrompt(savedAiInsightSystemPrompt)
      setAiInsightAnalysisPrompt(await configService.getAiInsightAnalysisPrompt())
      setAiPersonaAnalysisPrompt(await configService.getAiPersonaAnalysisPrompt())
      setAiTopicsAnalysisPrompt(await configService.getAiTopicsAnalysisPrompt())
      setAiReplyPrompt(await configService.getAiReplyPrompt())
      setAiReplyRoles(await configService.getAiReplyRoles())
      setAiInsightTelegramEnabled(savedAiInsightTelegramEnabled)
      setAiInsightTelegramToken(savedAiInsightTelegramToken)
      setAiInsightTelegramChatIds(savedAiInsightTelegramChatIds)
      setAiInsightAllowSocialContext(savedAiInsightAllowSocialContext)
      setAiInsightSocialContextCount(savedAiInsightSocialContextCount)
      setAiInsightWeiboCookie(savedAiInsightWeiboCookie)
      setAiInsightWeiboBindings(savedAiInsightWeiboBindings)
      setAiFootprintEnabled(savedAiFootprintEnabled)
      setAiFootprintSystemPrompt(savedAiFootprintSystemPrompt)
      setAiInsightDebugLogEnabled(savedAiInsightDebugLogEnabled)

    } catch (e: any) {
      console.error('加载配置失败:', e)
    }
  }



  const handleLaunchAtStartupChange = async (enabled: boolean) => {
    if (isUpdatingLaunchAtStartup) return

    try {
      setIsUpdatingLaunchAtStartup(true)
      const result = await window.electronAPI.app.setLaunchAtStartup(enabled)
      setLaunchAtStartup(result.enabled)
      setLaunchAtStartupSupported(result.supported)
      setLaunchAtStartupReason(result.reason || '')

      if (result.success) {
        showMessage(enabled ? '已开启开机自启动' : '已关闭开机自启动', true)
        return
      }

      showMessage(result.error || result.reason || '设置开机自启动失败', false)
    } catch (e: any) {
      showMessage(`设置开机自启动失败: ${e?.message || String(e)}`, false)
    } finally {
      setIsUpdatingLaunchAtStartup(false)
    }
  }

  const handleSilentStartupChange = async (enabled: boolean) => {
    if (isUpdatingSilentStartup) return

    try {
      setIsUpdatingSilentStartup(true)
      await configService.setSilentStartup(enabled)
      setSilentStartup(enabled)
      showMessage(enabled ? '已开启静默启动' : '已关闭静默启动', true)
    } catch (e: any) {
      showMessage(`设置静默启动失败: ${e?.message || String(e)}`, false)
    } finally {
      setIsUpdatingSilentStartup(false)
    }
  }

  const refreshWhisperStatus = async (modelDirValue = whisperModelDir) => {
    try {
      const result = await window.electronAPI.whisper?.getModelStatus()
      if (result?.success) {
        setWhisperModelStatus({
          exists: Boolean(result.exists),
          modelPath: result.modelPath,
          tokensPath: result.tokensPath
        })
      }
    } catch {
      setWhisperModelStatus(null)
    }
  }

  const loadAppVersion = async () => {
    try {
      const version = await window.electronAPI.app.getVersion()
      setAppVersion(version)
    } catch (e: any) {
      console.error('获取版本号失败:', e)
    }
  }

  // 监听下载进度
  useEffect(() => {
    const removeListener = window.electronAPI.app.onDownloadProgress?.((progress: any) => {
      setDownloadProgress(progress)
    })
    return () => removeListener?.()
  }, [])

  useEffect(() => {
    const removeListener = window.electronAPI.whisper?.onDownloadProgress?.((payload: { modelName: string; downloadedBytes: number; totalBytes?: number; percent?: number; speed?: number }) => {
      setWhisperProgressData({
        downloaded: payload.downloadedBytes,
        total: payload.totalBytes || 0,
        speed: payload.speed || 0
      })
      if (typeof payload.percent === 'number') {
        setWhisperDownloadProgress(payload.percent)
      }
    })
    return () => removeListener?.()
  }, [])

  useEffect(() => {
    void refreshWhisperStatus(whisperModelDir)
  }, [whisperModelDir])

  useEffect(() => {
    if (activeTab === 'autoDownload') {
      fetchAutoDownloadStatus()

      let interval: ReturnType<typeof setInterval> | undefined
      if (autoDownloadHighRes) {
        interval = setInterval(fetchAutoDownloadStatus, 2000)
      }

      return () => {
        if (interval) clearInterval(interval)
      }
    }
  }, [activeTab, autoDownloadHighRes])

  const getErrorMessage = (error: any): string => {
    const raw = typeof error?.message === 'string' ? error.message : String(error ?? '')
    const normalized = raw.replace(/^Error:\s*/i, '').trim()
    return normalized || '未知错误'
  }

  const handleCheckUpdate = async () => {
    if (isCheckingUpdate) return
    setIsCheckingUpdate(true)
    setUpdateInfo(null)
    try {
      const result = await window.electronAPI.app.checkForUpdates()
      if (result.hasUpdate) {
        setUpdateInfo(result)
        setShowUpdateDialog(true)
        showMessage(`发现新版：${result.version}`, true)
      } else {
        showMessage('当前已是最新版', true)
      }
    } catch (e: any) {
      showMessage(`检查更新失败: ${getErrorMessage(e)}`, false)
    } finally {
      setIsCheckingUpdate(false)
    }
  }

  const handleUpdateNow = async () => {
    setShowUpdateDialog(false)

    setIsDownloading(true)
    setDownloadProgress({ percent: 0 })
    try {
      showMessage('正在下载更新...', true)
      await window.electronAPI.app.downloadAndInstall()
    } catch (e: any) {
      showMessage(`更新失败: ${getErrorMessage(e)}`, false)
      setIsDownloading(false)
    }
  }

  const handleIgnoreUpdate = async () => {
    if (!updateInfo || !updateInfo.version) return

    try {
      await window.electronAPI.app.ignoreUpdate(updateInfo.version)
      setShowUpdateDialog(false)
      setUpdateInfo(null)
      showMessage(`已忽略版本 ${updateInfo.version}`, true)
    } catch (e: any) {
      showMessage(`操作失败: ${e}`, false)
    }
  }

  const handleUpdateChannelChange = async (channel: configService.UpdateChannel) => {
    if (channel === updateChannel) return

    try {
      setUpdateChannel(channel)
      await configService.setUpdateChannel(channel)
      await configService.setIgnoredUpdateVersion('')
      setUpdateInfo(null)
      setShowUpdateDialog(false)
      const channelLabel = channel === 'stable' ? '稳定版' : channel === 'preview' ? '预览版' : '开发版'
      showMessage(`已切换到${channelLabel}更新渠道，正在检查更新`, true)
      await handleCheckUpdate()
    } catch (e: any) {
      showMessage(`切换更新渠道失败: ${e}`, false)
    }
  }

  const showMessage = (text: string, success: boolean) => {
    setMessage({ text, success })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleClose = () => {
    if (!onClose) return
    setIsClosing(true)
    setTimeout(() => {
      onClose()
    }, 200)
  }

  const normalizeSessionIds = (sessionIds: string[]): string[] =>
    Array.from(new Set((sessionIds || []).map((id) => String(id || '').trim()).filter(Boolean)))

  const getCurrentAntiRevokeSessionIds = (): string[] =>
    normalizeSessionIds(antiRevokeSessions.map((session) => session.username))

  const ensureChatSessionsLoaded = async (): Promise<string[]> => {
    const current = normalizeSessionIds(chatSessions.map((session) => session.username))
    if (current.length > 0) return current
    const sessionsResult = await window.electronAPI.chat.getSessions()
    if (!sessionsResult.success || !sessionsResult.sessions) {
      throw new Error(sessionsResult.error || '加载会话失败')
    }
    setChatSessions(sessionsResult.sessions)
    return normalizeSessionIds(sessionsResult.sessions.map((session) => session.username))
  }

  const ensureAntiRevokeSessionsLoaded = async (): Promise<string[]> => {
    const current = getCurrentAntiRevokeSessionIds()
    if (current.length > 0) return current
    const sessionsResult = await window.electronAPI.chat.getAntiRevokeSessions()
    if (!sessionsResult.success || !sessionsResult.sessions) {
      throw new Error(sessionsResult.error || '加载会话失败')
    }
    const nextSessions = sessionsResult.sessions
    const nextIds = normalizeSessionIds(nextSessions.map((session) => session.username))
    setAntiRevokeSessions(nextSessions)
    setAntiRevokeSelectedIds((prev) => {
      const allowed = new Set(nextIds)
      return new Set(Array.from(prev).filter((sessionId) => allowed.has(sessionId)))
    })
    setAntiRevokeStatusMap((prev) => {
      const allowed = new Set(nextIds)
      return Object.fromEntries(Object.entries(prev).filter(([sessionId]) => allowed.has(sessionId)))
    })
    return nextIds
  }

  const markAntiRevokeRowsLoading = (sessionIds: string[]) => {
    setAntiRevokeStatusMap((prev) => {
      const next = { ...prev }
      for (const sessionId of sessionIds) {
        next[sessionId] = {
          ...(next[sessionId] || {}),
          loading: true,
          error: undefined
        }
      }
      return next
    })
  }

  const handleRefreshAntiRevokeStatus = async (sessionIds?: string[]) => {
    if (isAntiRevokeRefreshing || isAntiRevokeInstalling || isAntiRevokeUninstalling) return
    setAntiRevokeSummary(null)
    setIsAntiRevokeRefreshing(true)
    try {
      const targetIds = normalizeSessionIds(
        sessionIds && sessionIds.length > 0
          ? sessionIds
          : await ensureAntiRevokeSessionsLoaded()
      )
      if (targetIds.length === 0) {
        setAntiRevokeStatusMap({})
        showMessage('暂无可检查的会话', true)
        return
      }
      markAntiRevokeRowsLoading(targetIds)

      const result = await window.electronAPI.chat.checkAntiRevokeTriggers(targetIds)
      if (!result.success || !result.rows) {
        const errorText = result.error || '防撤回状态检查失败'
        setAntiRevokeStatusMap((prev) => {
          const next = { ...prev }
          for (const sessionId of targetIds) {
            next[sessionId] = {
              ...(next[sessionId] || {}),
              loading: false,
              error: errorText
            }
          }
          return next
        })
        showMessage(errorText, false)
        return
      }

      const rowMap = new Map<string, { sessionId: string; success: boolean; installed?: boolean; error?: string }>()
      for (const row of result.rows || []) {
        const sessionId = String(row.sessionId || '').trim()
        if (!sessionId) continue
        rowMap.set(sessionId, row)
      }
      const mergedRows = targetIds.map((sessionId) => (
        rowMap.get(sessionId) || { sessionId, success: false, error: '状态查询未返回结果' }
      ))
      const successCount = mergedRows.filter((row) => row.success).length
      const failedCount = mergedRows.length - successCount
      setAntiRevokeStatusMap((prev) => {
        const next = { ...prev }
        for (const row of mergedRows) {
          const sessionId = String(row.sessionId || '').trim()
          if (!sessionId) continue
          next[sessionId] = {
            installed: row.installed === true,
            loading: false,
            error: row.success ? undefined : (row.error || '状态查询失败')
          }
        }
        return next
      })
      setAntiRevokeSummary({ action: 'refresh', success: successCount, failed: failedCount })
      showMessage(`状态刷新完成：成功 ${successCount}，失败 ${failedCount}`, failedCount === 0)
    } catch (e: any) {
      showMessage(`防撤回状态刷新失败: ${e?.message || String(e)}`, false)
    } finally {
      setIsAntiRevokeRefreshing(false)
    }
  }

  const handleInstallAntiRevokeTriggers = async () => {
    if (isAntiRevokeRefreshing || isAntiRevokeInstalling || isAntiRevokeUninstalling) return
    const sessionIds = normalizeSessionIds(Array.from(antiRevokeSelectedIds))
    if (sessionIds.length === 0) {
      showMessage('请先选择至少一个会话', false)
      return
    }
    setAntiRevokeSummary(null)
    setIsAntiRevokeInstalling(true)
    try {
      markAntiRevokeRowsLoading(sessionIds)
      const result = await window.electronAPI.chat.installAntiRevokeTriggers(sessionIds)
      if (!result.success || !result.rows) {
        const errorText = result.error || '批量安装失败'
        setAntiRevokeStatusMap((prev) => {
          const next = { ...prev }
          for (const sessionId of sessionIds) {
            next[sessionId] = {
              ...(next[sessionId] || {}),
              loading: false,
              error: errorText
            }
          }
          return next
        })
        showMessage(errorText, false)
        return
      }

      const rowMap = new Map<string, { sessionId: string; success: boolean; alreadyInstalled?: boolean; error?: string }>()
      for (const row of result.rows || []) {
        const sessionId = String(row.sessionId || '').trim()
        if (!sessionId) continue
        rowMap.set(sessionId, row)
      }
      const mergedRows = sessionIds.map((sessionId) => (
        rowMap.get(sessionId) || { sessionId, success: false, error: '安装未返回结果' }
      ))
      const successCount = mergedRows.filter((row) => row.success).length
      const failedCount = mergedRows.length - successCount
      setAntiRevokeStatusMap((prev) => {
        const next = { ...prev }
        for (const row of mergedRows) {
          const sessionId = String(row.sessionId || '').trim()
          if (!sessionId) continue
          next[sessionId] = {
            installed: row.success ? true : next[sessionId]?.installed,
            loading: false,
            error: row.success ? undefined : (row.error || '安装失败')
          }
        }
        return next
      })
      setAntiRevokeSummary({ action: 'install', success: successCount, failed: failedCount })
      showMessage(`批量安装完成：成功 ${successCount}，失败 ${failedCount}`, failedCount === 0)
    } catch (e: any) {
      showMessage(`批量安装失败: ${e?.message || String(e)}`, false)
    } finally {
      setIsAntiRevokeInstalling(false)
    }
  }

  const handleUninstallAntiRevokeTriggers = async () => {
    if (isAntiRevokeRefreshing || isAntiRevokeInstalling || isAntiRevokeUninstalling) return
    const sessionIds = normalizeSessionIds(Array.from(antiRevokeSelectedIds))
    if (sessionIds.length === 0) {
      showMessage('请先选择至少一个会话', false)
      return
    }
    setAntiRevokeSummary(null)
    setIsAntiRevokeUninstalling(true)
    try {
      markAntiRevokeRowsLoading(sessionIds)
      const result = await window.electronAPI.chat.uninstallAntiRevokeTriggers(sessionIds)
      if (!result.success || !result.rows) {
        const errorText = result.error || '批量卸载失败'
        setAntiRevokeStatusMap((prev) => {
          const next = { ...prev }
          for (const sessionId of sessionIds) {
            next[sessionId] = {
              ...(next[sessionId] || {}),
              loading: false,
              error: errorText
            }
          }
          return next
        })
        showMessage(errorText, false)
        return
      }

      const rowMap = new Map<string, { sessionId: string; success: boolean; error?: string }>()
      for (const row of result.rows || []) {
        const sessionId = String(row.sessionId || '').trim()
        if (!sessionId) continue
        rowMap.set(sessionId, row)
      }
      const mergedRows = sessionIds.map((sessionId) => (
        rowMap.get(sessionId) || { sessionId, success: false, error: '卸载未返回结果' }
      ))
      const successCount = mergedRows.filter((row) => row.success).length
      const failedCount = mergedRows.length - successCount
      setAntiRevokeStatusMap((prev) => {
        const next = { ...prev }
        for (const row of mergedRows) {
          const sessionId = String(row.sessionId || '').trim()
          if (!sessionId) continue
          next[sessionId] = {
            installed: row.success ? false : next[sessionId]?.installed,
            loading: false,
            error: row.success ? undefined : (row.error || '卸载失败')
          }
        }
        return next
      })
      setAntiRevokeSummary({ action: 'uninstall', success: successCount, failed: failedCount })
      showMessage(`批量卸载完成：成功 ${successCount}，失败 ${failedCount}`, failedCount === 0)
    } catch (e: any) {
      showMessage(`批量卸载失败: ${e?.message || String(e)}`, false)
    } finally {
      setIsAntiRevokeUninstalling(false)
    }
  }

  useEffect(() => {
    if (activeTab !== 'antiRevoke' && activeTab !== 'insight' && activeTab !== 'autoDownload') return
    let canceled = false
    ;(async () => {
      try {
        if (activeTab === 'antiRevoke' || activeTab === 'autoDownload') {
          await ensureAntiRevokeSessionsLoaded()
        } else {
          await ensureChatSessionsLoaded()
        }
      } catch (e: any) {
        if (!canceled) {
          showMessage(`加载会话失败: ${e?.message || String(e)}`, false)
        }
      }
    })()
    return () => {
      canceled = true
    }
  }, [activeTab])

  type WxidKeys = {
    decryptKey: string
    imageXorKey: number | null
    imageAesKey: string
  }

  const formatImageXorKey = (value: number) => `0x${value.toString(16).toUpperCase().padStart(2, '0')}`

  const parseImageXorKey = (value: string) => {
    if (!value) return null
    const parsed = parseInt(value.replace(/^0x/i, ''), 16)
    return Number.isNaN(parsed) ? null : parsed
  }

  const buildKeysFromState = (): WxidKeys => ({
    decryptKey: decryptKey || '',
    imageXorKey: parseImageXorKey(imageXorKey),
    imageAesKey: imageAesKey || ''
  })

  const buildKeysFromInputs = (overrides?: { decryptKey?: string; imageXorKey?: string; imageAesKey?: string }): WxidKeys => ({
    decryptKey: overrides?.decryptKey ?? decryptKey ?? '',
    imageXorKey: parseImageXorKey(overrides?.imageXorKey ?? imageXorKey),
    imageAesKey: overrides?.imageAesKey ?? imageAesKey ?? ''
  })

  const buildKeysFromConfig = (wxidConfig: configService.WxidConfig | null): WxidKeys => ({
    decryptKey: wxidConfig?.decryptKey || '',
    imageXorKey: typeof wxidConfig?.imageXorKey === 'number' ? wxidConfig.imageXorKey : null,
    imageAesKey: wxidConfig?.imageAesKey || ''
  })

  const applyKeysToState = (keys: WxidKeys) => {
    setDecryptKey(keys.decryptKey)
    if (typeof keys.imageXorKey === 'number') {
      setImageXorKey(formatImageXorKey(keys.imageXorKey))
    } else {
      setImageXorKey('')
    }
    setImageAesKey(keys.imageAesKey)
  }

  const syncKeysToConfig = async (keys: WxidKeys) => {
    await configService.setDecryptKey(keys.decryptKey)
    await configService.setImageXorKey(typeof keys.imageXorKey === 'number' ? keys.imageXorKey : 0)
    await configService.setImageAesKey(keys.imageAesKey)
  }

  const applyWxidSelection = async (
    selectedWxid: string,
    options?: { preferCurrentKeys?: boolean; showToast?: boolean; toastText?: string; keysOverride?: WxidKeys }
  ) => {
    if (!selectedWxid) return

    const currentWxid = wxid
    const isSameWxid = currentWxid === selectedWxid
    if (currentWxid && currentWxid !== selectedWxid) {
      const currentKeys = buildKeysFromState()
      await configService.setWxidConfig(currentWxid, {
        decryptKey: currentKeys.decryptKey,
        imageXorKey: typeof currentKeys.imageXorKey === 'number' ? currentKeys.imageXorKey : 0,
        imageAesKey: currentKeys.imageAesKey
      })
    }

    const preferCurrentKeys = options?.preferCurrentKeys ?? false
    const keys = options?.keysOverride ?? (preferCurrentKeys
      ? buildKeysFromState()
      : buildKeysFromConfig(await configService.getWxidConfig(selectedWxid)))

    setWxid(selectedWxid)
    applyKeysToState(keys)
    await configService.setMyWxid(selectedWxid)
    await syncKeysToConfig(keys)
    await configService.setWxidConfig(selectedWxid, {
      decryptKey: keys.decryptKey,
      imageXorKey: typeof keys.imageXorKey === 'number' ? keys.imageXorKey : 0,
      imageAesKey: keys.imageAesKey
    })
    setShowWxidSelect(false)
    if (isDbConnected) {
      try {
        await window.electronAPI.chat.close()
        const result = await window.electronAPI.chat.connect()
        setDbConnected(result.success, dbPath || undefined)
        if (!result.success && result.error) {
          showMessage(result.error, false)
        }
      } catch (e: any) {
        showMessage(`切换账号后重新连接失败: ${e}`, false)
        setDbConnected(false)
      }
    }
    if (!isSameWxid) {
      clearAnalyticsStoreCache()
      resetChatStore()
      window.dispatchEvent(new CustomEvent('wxid-changed', { detail: { wxid: selectedWxid } }))
    }
    if (options?.showToast ?? true) {
      showMessage(options?.toastText || `已选择账号：${selectedWxid}`, true)
    }
  }

  const validatePath = (path: string): string | null => {
    if (!path) return null
    if (/[\u4e00-\u9fa5]/.test(path)) {
      return '路径包含中文字符，请迁移至全英文目录'
    }
    return null
  }

  const handleAutoDetectPath = async () => {
    if (isDetectingPath) return
    setIsDetectingPath(true)
    try {
      const result = await window.electronAPI.dbPath.autoDetect()
      if (result.success && result.path) {
        const validationError = validatePath(result.path)
        if (validationError) {
          showMessage(validationError, false)
        } else {
          setDbPath(result.path)
          await configService.setDbPath(result.path)
          showMessage(`自动检测成功：${result.path}`, true)

          const wxids = await window.electronAPI.dbPath.scanWxids(result.path)
          setWxidOptions(wxids)
          if (wxids.length === 1) {
            await applyWxidSelection(wxids[0].wxid, {
              toastText: `已检测到账号：${wxids[0].wxid}`
            })
          } else if (wxids.length > 1) {
            setShowWxidSelect(true)
          }
        }
      } else {
        showMessage(result.error || '未能自动检测到数据库目录', false)
      }
    } catch (e: any) {
      showMessage(`自动检测失败: ${e}`, false)
    } finally {
      setIsDetectingPath(false)
    }
  }

  const handleSelectDbPath = async () => {
    try {
      const result = await dialog.openFile({ title: '选择微信数据库根目录', properties: ['openDirectory'] })
      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0]
        const validationError = validatePath(selectedPath)
        if (validationError) {
          showMessage(validationError, false)
        } else {
          setDbPath(selectedPath)
          await configService.setDbPath(selectedPath)
          showMessage('已选择数据库目录', true)
        }
      }
    } catch (e: any) {
      showMessage('选择目录失败', false)
    }
  }

  const handleScanWxid = async (
    silent = false,
    options?: { preferCurrentKeys?: boolean; showDialog?: boolean; keysOverride?: WxidKeys }
  ) => {
    if (!dbPath) {
      if (!silent) showMessage('请先选择数据库目录', false)
      return
    }
    try {
      const wxids = await window.electronAPI.dbPath.scanWxids(dbPath)
      setWxidOptions(wxids)
      const allowDialog = options?.showDialog ?? !silent
      if (wxids.length === 1) {
        await applyWxidSelection(wxids[0].wxid, {
          preferCurrentKeys: options?.preferCurrentKeys ?? false,
          showToast: !silent,
          toastText: `已检测到账号：${wxids[0].wxid}`,
          keysOverride: options?.keysOverride
        })
      } else if (wxids.length > 1 && allowDialog) {
        setShowWxidSelect(true)
      } else {
        if (!silent) showMessage('未检测到账号目录，请检查路径', false)
      }
    } catch (e: any) {
      if (!silent) showMessage(`扫描失败: ${e}`, false)
    }
  }

  const handleSelectWxid = async (selectedWxid: string) => {
    await applyWxidSelection(selectedWxid)
  }


  const handleSelectCachePath = async () => {
    try {
      const result = await dialog.openFile({ title: '选择缓存目录', properties: ['openDirectory'] })
      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0]
        setCachePath(selectedPath)
        await configService.setCachePath(selectedPath)
        showMessage('已选择缓存目录', true)
      }
    } catch (e: any) {
      showMessage('选择目录失败', false)
    }
  }



  const handleSelectWhisperModelDir = async () => {
    try {
      const result = await dialog.openFile({ title: '选择 Whisper 模型下载目录', properties: ['openDirectory'] })
      if (!result.canceled && result.filePaths.length > 0) {
        const dir = result.filePaths[0]
        setWhisperModelDir(dir)
        await configService.setWhisperModelDir(dir)
        showMessage('已选择 Whisper 模型目录', true)
      }
    } catch (e: any) {
      showMessage('选择目录失败', false)
    }
  }

  const handleWhisperModelChange = async (value: string) => {
    setWhisperModelName(value)
    setWhisperDownloadProgress(0)
    await configService.setWhisperModelName(value)
  }

  const handleDownloadWhisperModel = async () => {
    if (isWhisperDownloading) return
    setIsWhisperDownloading(true)
    setWhisperDownloadProgress(0)
    try {
      const result = await window.electronAPI.whisper.downloadModel()
      if (result.success) {
        setWhisperDownloadProgress(100)
        showMessage('SenseVoiceSmall 模型下载完成', true)
        await refreshWhisperStatus(whisperModelDir)
      } else {
        showMessage(result.error || '模型下载失败', false)
      }
    } catch (e: any) {
      showMessage(`模型下载失败: ${e}`, false)
    } finally {
      setIsWhisperDownloading(false)
    }
  }

  const handleResetWhisperModelDir = async () => {
    setWhisperModelDir('')
    await configService.setWhisperModelDir('')
  }

  const handleAutoGetDbKey = async () => {
    if (isFetchingDbKey) return
    setIsFetchingDbKey(true)
    setIsManualStartPrompt(false)
    setDbKeyError('')
    setDbKeyStatus('正在连接微信进程...')
    try {
      const result = await window.electronAPI.key.autoGetDbKey()
      if (result.success && result.key) {
        setDecryptKey(result.key)
        setDbKeyStatus('密钥获取成功')
        setDbKeyError('')
        showMessage('已自动获取解密密钥', true)
        await syncCurrentKeys({ decryptKey: result.key, wxid })
        const keysOverride = buildKeysFromInputs({ decryptKey: result.key })
        await handleScanWxid(true, { preferCurrentKeys: true, showDialog: false, keysOverride })
      } else {
        if (
          result.error?.includes('未找到微信安装路径') ||
          result.error?.includes('启动微信失败') ||
          result.error?.includes('未能自动启动微信') ||
          result.error?.includes('未找到微信进程') ||
          result.error?.includes('微信进程未运行')
        ) {
          setIsManualStartPrompt(true)
          setDbKeyStatus('需要手动启动微信')
          setDbKeyError('')
        } else {
          const failureMessage = result.error || '自动获取密钥失败'
          setDbKeyError(failureMessage)
          showMessage(failureMessage, false)
        }
      }
    } catch (e: any) {
      const failureMessage = `自动获取密钥失败: ${e}`
      setDbKeyError(failureMessage)
      showMessage(failureMessage, false)
    } finally {
      setIsFetchingDbKey(false)
    }
  }

  const openMacKeyFaq = () => {
    void window.electronAPI.shell.openExternal(MAC_KEY_FAQ_URL)
  }

  const handleManualConfirm = async () => {
    setIsManualStartPrompt(false)
    handleAutoGetDbKey()
  }

  // Debounce config writes to avoid excessive disk IO
  const scheduleConfigSave = (key: string, task: () => Promise<void> | void, delay = 300) => {
    const timers = saveTimersRef.current
    if (timers[key]) {
      clearTimeout(timers[key])
    }
    timers[key] = setTimeout(() => {
      Promise.resolve(task()).catch((e) => {
        console.error('保存配置失败:', e)
      })
    }, delay)
  }

  const syncCurrentKeys = async (options?: { decryptKey?: string; imageXorKey?: string; imageAesKey?: string; wxid?: string }) => {
    const keys = buildKeysFromInputs(options)
    await syncKeysToConfig(keys)
    const wxidToUse = options?.wxid ?? wxid
    if (wxidToUse) {
      await configService.setWxidConfig(wxidToUse, {
        decryptKey: keys.decryptKey,
        imageXorKey: typeof keys.imageXorKey === 'number' ? keys.imageXorKey : 0,
        imageAesKey: keys.imageAesKey
      })
    }
  }

  const handleAutoGetImageKey = async () => {
    if (isFetchingImageKey) return;
    if (!dbPath) { showMessage('请先选择数据库目录', false); return; }
    setIsFetchingImageKey(true);
    setImageKeyPercent(0)
    setImageKeyStatus('正在初始化...');
    setImageKeyProgress(0);

    try {
      const accountPath = wxid ? `${dbPath}/${wxid}` : dbPath;
      const result = await window.electronAPI.key.autoGetImageKey(accountPath, wxid)
      if (result.success && result.aesKey) {
        if (typeof result.xorKey === 'number') setImageXorKey(`0x${result.xorKey.toString(16).toUpperCase().padStart(2, '0')}`)
        setImageAesKey(result.aesKey)
        setImageKeyStatus('已获取图片密钥')
        showMessage('已自动获取图片密钥', true)
        const newXorKey = typeof result.xorKey === 'number' ? result.xorKey : 0
        const newAesKey = result.aesKey
        await configService.setImageXorKey(newXorKey)
        await configService.setImageAesKey(newAesKey)
        if (wxid) await configService.setWxidConfig(wxid, { decryptKey, imageXorKey: newXorKey, imageAesKey: newAesKey })
      } else {
        showMessage(result.error || '自动获取图片密钥失败', false)
      }
    } catch (e: any) {
      showMessage(`自动获取图片密钥失败: ${e}`, false)
    } finally {
      setIsFetchingImageKey(false)
    }
  }

  const handleScanImageKeyFromMemory = async () => {
    if (isFetchingImageKey) return;
    if (!dbPath) { showMessage('请先选择数据库目录', false); return; }
    setIsFetchingImageKey(true);
    setImageKeyPercent(0)
    setImageKeyStatus('正在扫描内存...');

    try {
      const accountPath = wxid ? `${dbPath}/${wxid}` : dbPath;
      const result = await window.electronAPI.key.scanImageKeyFromMemory(accountPath)
      if (result.success && result.aesKey) {
        if (typeof result.xorKey === 'number') setImageXorKey(`0x${result.xorKey.toString(16).toUpperCase().padStart(2, '0')}`)
        setImageAesKey(result.aesKey)
        setImageKeyStatus('内存扫描成功，已获取图片密钥')
        showMessage('内存扫描成功，已获取图片密钥', true)
        const newXorKey = typeof result.xorKey === 'number' ? result.xorKey : 0
        const newAesKey = result.aesKey
        await configService.setImageXorKey(newXorKey)
        await configService.setImageAesKey(newAesKey)
        if (wxid) await configService.setWxidConfig(wxid, { decryptKey, imageXorKey: newXorKey, imageAesKey: newAesKey })
      } else {
        showMessage(result.error || '内存扫描获取图片密钥失败', false)
      }
    } catch (e: any) {
      showMessage(`内存扫描失败: ${e}`, false)
    } finally {
      setIsFetchingImageKey(false)
    }
  }



  const handleTestConnection = async () => {
    if (!dbPath) { showMessage('请先选择数据库目录', false); return }
    if (!decryptKey) { showMessage('请先输入解密密钥', false); return }
    if (decryptKey.length !== 64) { showMessage('密钥长度必须为64个字符', false); return }
    if (!wxid) { showMessage('请先输入或扫描 wxid', false); return }

    setIsTesting(true)
    try {
      const result = await window.electronAPI.wcdb.testConnection(dbPath, decryptKey, wxid)
      if (result.success) {
        showMessage('连接测试成功！数据库可正常访问', true)
      } else {
        showMessage(result.error || '连接测试失败', false)
      }
    } catch (e: any) {
      showMessage(`连接测试失败: ${e}`, false)
    } finally {
      setIsTesting(false)
    }
  }

  // Removed manual save config function


  const handleClearConfig = async () => {
    const confirmed = window.confirm('确定要清除当前配置吗？清除后需要重新完成首次配置？')
    if (!confirmed) return
    setIsLoadingState(true)
    setLoading(true, '正在清除配置...')
    try {
      await window.electronAPI.wcdb.close()
      await configService.clearConfig()
      reset()
      setDecryptKey('')
      setImageXorKey('')
      setImageAesKey('')
      setDbPath('')
      setWxid('')
      setCachePath('')
      setLogEnabled(false)
      setAutoTranscribeVoice(false)
      setTranscribeLanguages(['zh'])
      setWhisperModelDir('')
      setWhisperModelStatus(null)
      setWhisperDownloadProgress(0)
      setIsWhisperDownloading(false)
      setDbConnected(false)
      await window.electronAPI.window.openOnboardingWindow()
    } catch (e: any) {
      showMessage(`清除配置失败: ${e}`, false)
    } finally {
      setIsLoadingState(false)
      setLoading(false)
    }
  }

  const handleOpenLog = async () => {
    try {
      const logPath = await window.electronAPI.log.getPath()
      await window.electronAPI.shell.openPath(logPath)
    } catch (e: any) {
      showMessage(`打开日志失败: ${e}`, false)
    }
  }

  const handleCopyLog = async () => {
    try {
      const result = await window.electronAPI.log.read()
      if (!result.success) {
        showMessage(result.error || '读取日志失败', false)
        return
      }
      await navigator.clipboard.writeText(result.content || '')
      showMessage('日志已复制到剪贴板', true)
    } catch (e: any) {
      showMessage(`复制日志失败: ${e}`, false)
    }
  }

  const handleClearLog = async () => {
    const confirmed = window.confirm('确定清空 wcdb.log 吗？')
    if (!confirmed) return
    try {
      const result = await window.electronAPI.log.clear()
      if (!result.success) {
        showMessage(result.error || '清空日志失败', false)
        return
      }
      showMessage('日志已清空', true)
    } catch (e: any) {
      showMessage(`清空日志失败: ${e}`, false)
    }
  }

  const handleClearAnalyticsCache = async () => {
    if (isClearingCache) return
    setIsClearingAnalyticsCache(true)
    try {
      const result = await window.electronAPI.cache.clearAnalytics()
      if (result.success) {
        clearAnalyticsStoreCache()
        showMessage('已清除分析缓存', true)
      } else {
        showMessage(`清除分析缓存失败: ${result.error || '未知错误'}`, false)
      }
    } catch (e: any) {
      showMessage(`清除分析缓存失败: ${e}`, false)
    } finally {
      setIsClearingAnalyticsCache(false)
    }
  }

  const handleClearImageCache = async () => {
    if (isClearingCache) return
    setIsClearingImageCache(true)
    try {
      const result = await window.electronAPI.cache.clearImages()
      if (result.success) {
        showMessage('已清除图片缓存', true)
      } else {
        showMessage(`清除图片缓存失败: ${result.error || '未知错误'}`, false)
      }
    } catch (e: any) {
      showMessage(`清除图片缓存失败: ${e}`, false)
    } finally {
      setIsClearingImageCache(false)
    }
  }

  const handleClearAllCache = async () => {
    if (isClearingCache) return
    setIsClearingAllCache(true)
    try {
      const result = await window.electronAPI.cache.clearAll()
      if (result.success) {
        clearAnalyticsStoreCache()
        showMessage('已清除所有缓存', true)
      } else {
        showMessage(`清除所有缓存失败: ${result.error || '未知错误'}`, false)
      }
    } catch (e: any) {
      showMessage(`清除所有缓存失败: ${e}`, false)
    } finally {
      setIsClearingAllCache(false)
    }
  }

  const fetchAutoDownloadStatus = async () => {
    try {
      const status = await (window as any).electronAPI.image.getAutoDownloadStatus()
      setAutoDownloadStatus(status)
    } catch (error) {
      console.error('获取自动下载状态失败:', error)
    }
  }

  const renderAppearanceTab = () => (
    <div className="tab-content">
      <div className="theme-mode-toggle">
        <button className={`mode-btn ${themeMode === 'light' ? 'active' : ''}`} onClick={() => setThemeMode('light')}>
          <Sun size={16} /> 浅色
        </button>
        <button className={`mode-btn ${themeMode === 'dark' ? 'active' : ''}`} onClick={() => setThemeMode('dark')}>
          <Moon size={16} /> 深色
        </button>
        <button className={`mode-btn ${themeMode === 'system' ? 'active' : ''}`} onClick={() => setThemeMode('system')}>
          <Monitor size={16} /> 跟随系统
        </button>
      </div>
      <div className="theme-grid">
        {themes.map((theme) => (
          <div key={theme.id} className={`theme-card ${currentTheme === theme.id ? 'active' : ''}`} onClick={() => setTheme(theme.id)}>
            <div className="theme-preview" style={{
              background: effectiveMode === 'dark'
                ? (theme.id === 'blossom-dream' ? 'linear-gradient(150deg, #151316 0%, #1A1620 50%, #131018 100%)'
                  : theme.id === 'geist' ? 'linear-gradient(135deg, #1a1a1a 0%, #222222 100%)'
                  : 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)')
                : (theme.id === 'blossom-dream' ? `linear-gradient(150deg, ${theme.bgColor} 0%, #F8F2F8 45%, #F2F6FB 100%)`
                  : theme.id === 'geist' ? 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)'
                  : `linear-gradient(135deg, ${theme.bgColor} 0%, ${theme.bgColor}dd 100%)`)
            }}>
              <div className="theme-accent" style={{
                background: theme.accentColor
                  ? `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.accentColor} 100%)`
                  : theme.primaryColor
              }} />
            </div>
            <div className="theme-info">
              <span className="theme-name">{theme.name}</span>
              <span className="theme-desc">{theme.description}</span>
            </div>
            {currentTheme === theme.id && <div className="theme-check"><Check size={14} /></div>}
          </div>
        ))}
      </div>

      <div className="form-group quote-layout-group">
        <label>引用消息样式</label>
        <span className="form-hint">选择聊天中引用消息与正文的上下顺序，下方预览会同步展示布局差异。</span>
        <div className="quote-layout-picker" role="radiogroup" aria-label="引用样式选择">
          {[
            {
              value: 'quote-top' as const,
              label: '引用在上',
              successMessage: '已切换为引用在上样式'
            },
            {
              value: 'quote-bottom' as const,
              label: '正文在上',
              successMessage: '已切换为正文在上样式'
            }
          ].map(option => {
            const selected = quoteLayout === option.value
            const isQuoteBottom = option.value === 'quote-bottom'

            return (
              <button
                key={option.value}
                type="button"
                className={`quote-layout-card ${selected ? 'active' : ''}`}
                onClick={async () => {
                  if (selected) return
                  setQuoteLayout(option.value)
                  await configService.setQuoteLayout(option.value)
                  showMessage(option.successMessage, true)
                }}
                role="radio"
                aria-checked={selected}
              >
                <span className={`quote-layout-card-check ${selected ? 'active' : ''}`} aria-hidden="true" />
                <div className="quote-layout-preview-shell">
                  <div className="quote-layout-preview-chat">
                    <div className="message-bubble sent">
                      <div className={`bubble-content ${isQuoteBottom ? 'quote-layout-bottom' : 'quote-layout-top'}`}>
                        {isQuoteBottom ? (
                          <>
                            <div className="message-text">拍得真不错!</div>
                            <div className="quoted-message">
                              <span className="quoted-sender">张三</span>
                              <span className="quoted-text">那天去爬山的照片...</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="quoted-message">
                              <span className="quoted-sender">张三</span>
                              <span className="quoted-text">那天去爬山的照片...</span>
                            </div>
                            <div className="message-text">拍得真不错!</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="quote-layout-card-footer">
                  <div className="quote-layout-card-title-group">
                    <span className="quote-layout-card-title">{option.label}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="divider" />

      <div className="form-group">
        <label>开机自启动</label>
        <span className="form-hint">
          {launchAtStartupSupported
            ? '开启后，登录系统时会自动启动 WeFlow。'
            : launchAtStartupReason || '当前环境暂不支持开机自启动。'}
        </span>
        <div className="log-toggle-line">
          <span className="log-status">
            {isUpdatingLaunchAtStartup
              ? '保存中...'
              : launchAtStartupSupported
                ? (launchAtStartup ? '已开启' : '已关闭')
                : '当前不可用'}
          </span>
          <label className="switch" htmlFor="launch-at-startup-toggle">
            <input
              id="launch-at-startup-toggle"
              className="switch-input"
              type="checkbox"
              checked={launchAtStartup}
              disabled={!launchAtStartupSupported || isUpdatingLaunchAtStartup}
              onChange={(e) => {
                void handleLaunchAtStartupChange(e.target.checked)
              }}
            />
            <span className="switch-slider" />
          </label>
        </div>
      </div>

      <div className="divider" />

      <div className="form-group">
        <label>静默启动</label>
        <span className="form-hint">
          开启后，无论手动启动还是开机自启动，都会先驻留到系统托盘，不主动显示主窗口。
        </span>
        <div className="log-toggle-line">
          <span className="log-status">
            {isUpdatingSilentStartup
              ? '保存中...'
              : (silentStartup ? '已开启' : '已关闭')}
          </span>
          <label className="switch" htmlFor="silent-startup-toggle">
            <input
              id="silent-startup-toggle"
              className="switch-input"
              type="checkbox"
              checked={silentStartup}
              disabled={isUpdatingSilentStartup}
              onChange={(e) => {
                void handleSilentStartupChange(e.target.checked)
              }}
            />
            <span className="switch-slider" />
          </label>
        </div>
      </div>

      <div className="divider" />

      <div className="form-group">
        <label>关闭主窗口时</label>
        <span className="form-hint">设置点击关闭按钮后的默认行为；选择“每次询问”时会弹出关闭确认。</span>
        <div className="custom-select">
          <div
            className={`custom-select-trigger ${closeBehaviorDropdownOpen ? 'open' : ''}`}
            onClick={() => setCloseBehaviorDropdownOpen(!closeBehaviorDropdownOpen)}
          >
            <span className="custom-select-value">
              {windowCloseBehavior === 'tray'
                ? '最小化到系统托盘'
                : windowCloseBehavior === 'quit'
                  ? '完全关闭'
                  : '每次询问'}
            </span>
            <ChevronDown size={14} className={`custom-select-arrow ${closeBehaviorDropdownOpen ? 'rotate' : ''}`} />
          </div>
          <div className={`custom-select-dropdown ${closeBehaviorDropdownOpen ? 'open' : ''}`}>
            {[
              {
                value: 'ask' as const,
                label: '每次询问',
                successMessage: '已恢复关闭确认弹窗'
              },
              {
                value: 'tray' as const,
                label: '最小化到系统托盘',
                successMessage: '关闭按钮已改为最小化到托盘'
              },
              {
                value: 'quit' as const,
                label: '完全关闭',
                successMessage: '关闭按钮已改为完全关闭'
              }
            ].map(option => (
              <div
                key={option.value}
                className={`custom-select-option ${windowCloseBehavior === option.value ? 'selected' : ''}`}
                onClick={async () => {
                  setWindowCloseBehavior(option.value)
                  setCloseBehaviorDropdownOpen(false)
                  await configService.setWindowCloseBehavior(option.value)
                  showMessage(option.successMessage, true)
                }}
              >
                {option.label}
                {windowCloseBehavior === option.value && <Check size={14} />}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )

  const renderNotificationTab = () => {
    // 添加会话到过滤列表
    const handleAddToFilterList = async (username: string) => {
      if (notificationFilterList.includes(username)) return
      const newList = [...notificationFilterList, username]
      setNotificationFilterList(newList)
      await configService.setNotificationFilterList(newList)
      showMessage('已添加到过滤列表', true)
    }

    // 从过滤列表移除会话
    const handleRemoveFromFilterList = async (username: string) => {
      const newList = notificationFilterList.filter(u => u !== username)
      setNotificationFilterList(newList)
      await configService.setNotificationFilterList(newList)
      showMessage('已从过滤列表移除', true)
    }

    return (
      <div className="tab-content">
        <div className="form-group">
          <label>新消息通知</label>
          <span className="form-hint">开启后，收到新消息时将显示桌面弹窗通知</span>
          <div className="log-toggle-line">
            <span className="log-status">{notificationEnabled ? '已开启' : '已关闭'}</span>
            <label className="switch" htmlFor="notification-enabled-toggle">
              <input
                id="notification-enabled-toggle"
                className="switch-input"
                type="checkbox"
                checked={notificationEnabled}
                onChange={async (e) => {
                  const val = e.target.checked
                  setNotificationEnabled(val)
                  await configService.setNotificationEnabled(val)
                  showMessage(val ? '已开启通知' : '已关闭通知', true)
                }}
              />
              <span className="switch-slider" />
            </label>
          </div>
        </div>

        <div className="form-group">
          <label>通知显示位置</label>
          <span className="form-hint">选择通知弹窗在屏幕上的显示位置</span>
          <div className="custom-select">
            <div
              className={`custom-select-trigger ${positionDropdownOpen ? 'open' : ''}`}
              onClick={() => setPositionDropdownOpen(!positionDropdownOpen)}
            >
              <span className="custom-select-value">
                {notificationPosition === 'top-right' ? '右上角' :
                  notificationPosition === 'bottom-right' ? '右下角' :
                    notificationPosition === 'top-left' ? '左上角' :
                      notificationPosition === 'top-center' ? '中间上方' : '左下角'}
              </span>
              <ChevronDown size={14} className={`custom-select-arrow ${positionDropdownOpen ? 'rotate' : ''}`} />
            </div>
            <div className={`custom-select-dropdown ${positionDropdownOpen ? 'open' : ''}`}>
              {[
                { value: 'top-center', label: '中间上方' },
                { value: 'top-right', label: '右上角' },
                { value: 'bottom-right', label: '右下角' },
                { value: 'top-left', label: '左上角' },
                { value: 'bottom-left', label: '左下角' }
              ].map(option => (
                <div
                  key={option.value}
                  className={`custom-select-option ${notificationPosition === option.value ? 'selected' : ''}`}
                  onClick={async () => {
                    const val = option.value as 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center'
                    setNotificationPosition(val)
                    setPositionDropdownOpen(false)
                    await configService.setNotificationPosition(val)
                    showMessage('通知位置已更新', true)
                  }}
                >
                  {option.label}
                  {notificationPosition === option.value && <Check size={14} />}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="form-group">
          <label>会话过滤</label>
          <span className="form-hint">选择只接收特定会话的通知，或屏蔽特定会话的通知</span>
          <div className="custom-select">
            <div
              className={`custom-select-trigger ${filterModeDropdownOpen ? 'open' : ''}`}
              onClick={() => setFilterModeDropdownOpen(!filterModeDropdownOpen)}
            >
              <span className="custom-select-value">
                {notificationFilterMode === 'all' ? '接收所有通知' :
                  notificationFilterMode === 'whitelist' ? '仅接收白名单' : '屏蔽黑名单'}
              </span>
              <ChevronDown size={14} className={`custom-select-arrow ${filterModeDropdownOpen ? 'rotate' : ''}`} />
            </div>
            <div className={`custom-select-dropdown ${filterModeDropdownOpen ? 'open' : ''}`}>
              {[
                { value: 'all', label: '接收所有通知' },
                { value: 'whitelist', label: '仅接收白名单' },
                { value: 'blacklist', label: '屏蔽黑名单' }
              ].map(option => (
                <div
                  key={option.value}
                  className={`custom-select-option ${notificationFilterMode === option.value ? 'selected' : ''}`}
                  onClick={() => { void handleSetNotificationFilterMode(option.value as SessionFilterMode) }}
                >
                  {option.label}
                  {notificationFilterMode === option.value && <Check size={14} />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {notificationFilterMode !== 'all' && (
          <div className="form-group">
            <label>{notificationFilterMode === 'whitelist' ? '白名单会话' : '黑名单会话'}</label>
            <span className="form-hint">
              {notificationFilterMode === 'whitelist'
                ? '点击左侧会话添加到白名单，点击右侧会话从白名单移除'
                : '点击左侧会话添加到黑名单，点击右侧会话从黑名单移除'}
            </span>

            <div className="push-filter-type-tabs">
              {sessionFilterTypeOptions.map(option => (
                <button
                  key={option.value}
                  type="button"
                  className={`push-filter-type-tab ${notificationTypeFilter === option.value ? 'active' : ''}`}
                  onClick={() => setNotificationTypeFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="notification-filter-container">
              {/* 可选会话列表 */}
              <div className="filter-panel">
                <div className="filter-panel-header">
                  <span>可选会话</span>
                  {notificationAvailableSessions.length > 0 && (
                    <button
                      type="button"
                      className="filter-panel-action"
                      onClick={() => { void handleAddAllNotificationFilterSessions() }}
                    >
                      全选当前
                    </button>
                  )}
                  <div className="filter-search-box">
                    <Search size={14} />
                    <input
                      type="text"
                      placeholder="搜索会话..."
                      value={filterSearchKeyword}
                      onChange={(e) => setFilterSearchKeyword(e.target.value)}
                    />
                  </div>
                </div>
                <div className="filter-panel-list">
                  {notificationAvailableSessions.length > 0 ? (
                    notificationAvailableSessions.map(session => (
                      <div
                        key={session.username}
                        className="filter-panel-item"
                        onClick={() => handleAddToFilterList(session.username)}
                      >
                        <Avatar
                          src={session.avatarUrl}
                          name={session.displayName || session.username}
                          size={28}
                        />
                        <span className="filter-item-name">{session.displayName || session.username}</span>
                        <span className="filter-item-type">{getSessionFilterTypeLabel(session.type)}</span>
                        <span className="filter-item-action">+</span>
                      </div>
                    ))
                  ) : (
                    <div className="filter-panel-empty">
                      {filterSearchKeyword || notificationTypeFilter !== 'all' ? '没有匹配的会话' : '暂无可添加的会话'}
                    </div>
                  )}
                </div>
              </div>

              {/* 已选会话列表 */}
              <div className="filter-panel">
                <div className="filter-panel-header">
                  <span>{notificationFilterMode === 'whitelist' ? '白名单' : '黑名单'}</span>
                  {notificationFilterList.length > 0 && (
                    <span className="filter-panel-count">{notificationFilterList.length}</span>
                  )}
                  {notificationFilterList.length > 0 && (
                    <button
                      type="button"
                      className="filter-panel-action"
                      onClick={() => { void handleRemoveAllNotificationFilterSessions() }}
                    >
                      全不选
                    </button>
                  )}
                </div>
                <div className="filter-panel-list">
                  {notificationFilterList.length > 0 ? (
                    notificationFilterList.map(username => {
                      const info = getSessionFilterOptionInfo(username)
                      return (
                        <div
                          key={username}
                          className="filter-panel-item selected"
                          onClick={() => handleRemoveFromFilterList(username)}
                        >
                          <Avatar
                            src={info.avatarUrl}
                            name={info.displayName}
                            size={28}
                          />
                          <span className="filter-item-name">{info.displayName}</span>
                          <span className="filter-item-type">{getSessionFilterTypeLabel(info.type)}</span>
                          <span className="filter-item-action">×</span>
                        </div>
                      )
                    })
                  ) : (
                    <div className="filter-panel-empty">尚未添加任何会话</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderAntiRevokeTab = () => {
    const sortedSessions = [...antiRevokeSessions].sort((a, b) => (b.sortTimestamp || 0) - (a.sortTimestamp || 0))
    const keyword = antiRevokeSearchKeyword.trim().toLowerCase()
    const filteredSessions = sortedSessions.filter((session) => {
      if (!keyword) return true
      const displayName = String(session.displayName || '').toLowerCase()
      const username = String(session.username || '').toLowerCase()
      return displayName.includes(keyword) || username.includes(keyword)
    })
    const filteredSessionIds = filteredSessions.map((session) => session.username)
    const selectedCount = antiRevokeSelectedIds.size
    const selectedInFilteredCount = filteredSessionIds.filter((sessionId) => antiRevokeSelectedIds.has(sessionId)).length
    const allFilteredSelected = filteredSessionIds.length > 0 && selectedInFilteredCount === filteredSessionIds.length
    const busy = isAntiRevokeRefreshing || isAntiRevokeInstalling || isAntiRevokeUninstalling
    const statusStats = filteredSessions.reduce(
      (acc, session) => {
        const rowState = antiRevokeStatusMap[session.username]
        if (rowState?.error) acc.failed += 1
        else if (rowState?.installed === true) acc.installed += 1
        else if (rowState?.installed === false) acc.notInstalled += 1
        return acc
      },
      { installed: 0, notInstalled: 0, failed: 0 }
    )

    const toggleSelected = (sessionId: string) => {
      setAntiRevokeSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(sessionId)) next.delete(sessionId)
        else next.add(sessionId)
        return next
      })
    }

    const selectAllFiltered = () => {
      if (filteredSessionIds.length === 0) return
      setAntiRevokeSelectedIds((prev) => {
        const next = new Set(prev)
        for (const sessionId of filteredSessionIds) {
          next.add(sessionId)
        }
        return next
      })
    }

    const clearSelection = () => {
      setAntiRevokeSelectedIds(new Set())
    }

    return (
      <div className="tab-content anti-revoke-tab">
        <div className="anti-revoke-hero">
          <div className="anti-revoke-hero-main">
            <h3>防撤回</h3>
            <p>你可以根据会话进行防撤回部署，安装后无需保持 WeFlow 运行即可实现防撤回</p>
          </div>
          <div className="anti-revoke-metrics">
            <div className="anti-revoke-metric is-total">
              <span className="label">筛选会话</span>
              <span className="value">{filteredSessionIds.length}</span>
            </div>
            <div className="anti-revoke-metric is-installed">
              <span className="label">已安装</span>
              <span className="value">{statusStats.installed}</span>
            </div>
            <div className="anti-revoke-metric is-pending">
              <span className="label">未安装</span>
              <span className="value">{statusStats.notInstalled}</span>
            </div>
            <div className="anti-revoke-metric is-error">
              <span className="label">异常</span>
              <span className="value">{statusStats.failed}</span>
            </div>
          </div>
        </div>

        <div className="anti-revoke-control-card">
          <div className="anti-revoke-toolbar">
            <div className="filter-search-box anti-revoke-search">
              <Search size={14} />
              <input
                type="text"
                placeholder="搜索会话..."
                value={antiRevokeSearchKeyword}
                onChange={(e) => setAntiRevokeSearchKeyword(e.target.value)}
              />
            </div>
            <div className="anti-revoke-toolbar-actions">
              <div className="anti-revoke-btn-group">
                <button className="btn btn-secondary btn-sm" onClick={() => void handleRefreshAntiRevokeStatus()} disabled={busy}>
                  <RefreshCw size={14} /> {isAntiRevokeRefreshing ? '刷新中...' : '刷新状态'}
                </button>
              </div>
              <div className="anti-revoke-btn-group">
                <button className="btn btn-secondary btn-sm" onClick={selectAllFiltered} disabled={busy || filteredSessionIds.length === 0 || allFilteredSelected}>
                  全选
                </button>
                <button className="btn btn-secondary btn-sm" onClick={clearSelection} disabled={busy || selectedCount === 0}>
                  清空选择
                </button>
              </div>
            </div>
          </div>

          <div className="anti-revoke-batch-actions">
            <div className="anti-revoke-btn-group anti-revoke-batch-btns">
              <button className="btn btn-primary btn-sm" onClick={() => void handleInstallAntiRevokeTriggers()} disabled={busy || selectedCount === 0}>
                {isAntiRevokeInstalling ? '安装中...' : '批量安装'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => void handleUninstallAntiRevokeTriggers()} disabled={busy || selectedCount === 0}>
                {isAntiRevokeUninstalling ? '卸载中...' : '批量卸载'}
              </button>
            </div>
            <div className="anti-revoke-selected-count">
              <span>已选 <strong>{selectedCount}</strong> 个会话</span>
              <span>筛选命中 <strong>{selectedInFilteredCount}</strong> / {filteredSessionIds.length}</span>
            </div>
          </div>
        </div>

        {antiRevokeSummary && (
          <div className={`anti-revoke-summary ${antiRevokeSummary.failed > 0 ? 'error' : 'success'}`}>
            {antiRevokeSummary.action === 'refresh' ? '刷新' : antiRevokeSummary.action === 'install' ? '安装' : '卸载'}
            完成：成功 {antiRevokeSummary.success}，失败 {antiRevokeSummary.failed}
          </div>
        )}

        <div className="anti-revoke-list">
          {filteredSessions.length === 0 ? (
            <div className="anti-revoke-empty">{antiRevokeSearchKeyword ? '没有匹配的会话' : '暂无会话可配置'}</div>
          ) : (
            <>
              <div className="anti-revoke-list-header">
                <span>会话（{filteredSessions.length}）</span>
                <span>状态</span>
              </div>
              {filteredSessions.map((session) => {
                const rowState = antiRevokeStatusMap[session.username]
                let statusClass = 'unknown'
                let statusLabel = '未检查'
                if (rowState?.loading) {
                  statusClass = 'checking'
                  statusLabel = '检查中'
                } else if (rowState?.error) {
                  statusClass = 'error'
                  statusLabel = '失败'
                } else if (rowState?.installed === true) {
                  statusClass = 'installed'
                  statusLabel = '已安装'
                } else if (rowState?.installed === false) {
                  statusClass = 'not-installed'
                  statusLabel = '未安装'
                }
                return (
                  <div key={session.username} className={`anti-revoke-row ${antiRevokeSelectedIds.has(session.username) ? 'selected' : ''}`}>
                    <label className="anti-revoke-row-main">
                      <span className="anti-revoke-check">
                        <input
                          type="checkbox"
                          checked={antiRevokeSelectedIds.has(session.username)}
                          onChange={() => toggleSelected(session.username)}
                          disabled={busy}
                        />
                        <span className="check-indicator" aria-hidden="true">
                          <Check size={12} />
                        </span>
                      </span>
                      <Avatar
                        src={session.avatarUrl}
                        name={session.displayName || session.username}
                        size={30}
                      />
                      <div className="anti-revoke-row-text">
                        <span className="name">{session.displayName || session.username}</span>
                      </div>
                    </label>
                    <div className="anti-revoke-row-status">
                      <span className={`status-badge ${statusClass}`}>
                        <i className="status-dot" aria-hidden="true" />
                        {statusLabel}
                      </span>
                      {rowState?.error && <span className="status-error">{rowState.error}</span>}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>
    )
  }

  const renderDatabaseTab = () => (
    <div className="tab-content">
      <div className="form-group">
        <label>连接测试</label>
        <span className="form-hint">检测当前数据库配置是否可用</span>
        <button className="btn btn-secondary" onClick={handleTestConnection} disabled={isLoading || isTesting}>
          <Plug size={16} /> {isTesting ? '测试中...' : '测试连接'}
        </button>
      </div>

      <div className="divider" />

      <div className="form-group">
        <label>解密密钥</label>
        <span className="form-hint">64位十六进制密钥</span>
        <div className="input-with-toggle">
          <input
            type={showDecryptKey ? 'text' : 'password'}
            placeholder="例如: a1b2c3d4e5f6..."
            value={decryptKey}
            onChange={(e) => {
              const value = e.target.value
              setDecryptKey(value)
              if (value && value.length === 64) {
                scheduleConfigSave('keys', () => syncCurrentKeys({ decryptKey: value, wxid }))
                // showMessage('解密密钥已保存', true)
              }
            }}
          />
          <button type="button" className="toggle-visibility" onClick={() => setShowDecryptKey(!showDecryptKey)}>
            {showDecryptKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {isManualStartPrompt ? (
          <div className="manual-prompt">
            <p className="prompt-text">未能自动启动微信，请手动启动微信，看到登录窗口后点击下方确认</p>
            <button className="btn btn-primary btn-sm" onClick={handleManualConfirm}>
              我已看到登录窗口，继续检测
            </button>
          </div>
        ) : (
          <button className="btn btn-secondary btn-sm" onClick={handleAutoGetDbKey} disabled={isFetchingDbKey}>
            <Plug size={14} /> {isFetchingDbKey ? '获取中...' : '自动获取密钥'}
          </button>
        )}
        {dbKeyStatus && <div className="form-hint status-text">{dbKeyStatus}</div>}
        {isMac && dbKeyError && (
          <button type="button" className="mac-key-faq-link" onClick={openMacKeyFaq}>
            查看 macOS 获取密钥排障指引
          </button>
        )}
      </div>

      <div className="form-group">
        <label>数据库根目录</label>
        <span className="form-hint">xwechat_files 目录</span>
        <input
          type="text"
          placeholder={dbPathPlaceholder}
          value={dbPath}
          onChange={(e) => {
            const value = e.target.value
            setDbPath(value)
            scheduleConfigSave('dbPath', async () => {
              if (value) {
                await configService.setDbPath(value)
              }
            })
          }}
        />
        <div className="btn-row">
          <button className="btn btn-primary" onClick={handleAutoDetectPath} disabled={isDetectingPath}>
            <FolderSearch size={16} /> {isDetectingPath ? '检测中...' : '自动检测'}
          </button>
          <button className="btn btn-secondary" onClick={handleSelectDbPath}><FolderOpen size={16} /> 浏览选择</button>
        </div>
      </div>



      <div className="form-group">
        <label>账号 wxid</label>
        <span className="form-hint">微信账号标识</span>
        <div className="wxid-input-wrapper">
          <input
            type="text"
            placeholder="例如: wxid_xxxxxx"
            value={wxid}
            onChange={(e) => {
              const value = e.target.value
              const previousWxid = wxid
              setWxid(value)
              scheduleConfigSave('wxid', async () => {
                if (previousWxid && previousWxid !== value) {
                  const currentKeys = buildKeysFromState()
                  await configService.setWxidConfig(previousWxid, {
                    decryptKey: currentKeys.decryptKey,
                    imageXorKey: typeof currentKeys.imageXorKey === 'number' ? currentKeys.imageXorKey : 0,
                    imageAesKey: currentKeys.imageAesKey
                  })
                }
                if (value) {
                  await configService.setMyWxid(value)
                  await syncCurrentKeys({ wxid: value }) // Sync keys to the new wxid entry
                }

                if (value && previousWxid !== value) {
                  if (isDbConnected) {
                    try {
                      await window.electronAPI.chat.close()
                      const result = await window.electronAPI.chat.connect()
                      setDbConnected(result.success, dbPath || undefined)
                      if (!result.success && result.error) {
                        showMessage(result.error, false)
                      }
                    } catch (e: any) {
                      showMessage(`切换账号后重新连接失败: ${e}`, false)
                      setDbConnected(false)
                    }
                  }
                  clearAnalyticsStoreCache()
                  resetChatStore()
                  window.dispatchEvent(new CustomEvent('wxid-changed', { detail: { wxid: value } }))
                }
              })
            }}
          />
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => handleScanWxid()}><Search size={14} /> 扫描 wxid</button>
      </div>

      <div className="form-group">
        <label>图片 XOR 密钥 <span className="optional">(可选)</span></label>
        <span className="form-hint">用于解密图片缓存</span>
        <input
          type="text"
          placeholder="例如: 0xA4"
          value={imageXorKey}
          onChange={(e) => {
            const value = e.target.value
            setImageXorKey(value)
            const parsed = parseImageXorKey(value)
            if (value === '' || parsed !== null) {
              scheduleConfigSave('keys', () => syncCurrentKeys({ imageXorKey: value, wxid }))
            }
          }}
        />
      </div>

      <div className="form-group">
        <label>图片 AES 密钥 <span className="optional">(可选)</span></label>
        <span className="form-hint">16 位密钥</span>
        <input
          type="text"
          placeholder="16 位 AES 密钥"
          value={imageAesKey}
          onChange={(e) => {
            const value = e.target.value
            setImageAesKey(value)
            scheduleConfigSave('keys', () => syncCurrentKeys({ imageAesKey: value, wxid }))
          }}
        />
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button className="btn btn-primary btn-sm" onClick={handleAutoGetImageKey} disabled={isFetchingImageKey} title="从本地缓存快速计算">
            <Plug size={14} /> {isFetchingImageKey ? '获取中...' : '缓存计算（推荐）'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleScanImageKeyFromMemory} disabled={isFetchingImageKey} title="扫描微信进程内存">
            {isFetchingImageKey ? '扫描中...' : '内存扫描'}
          </button>
        </div>
        {isFetchingImageKey ? (
          <div className="brute-force-progress">
            <div className="status-header">
              <span className="status-text">{imageKeyStatus || '正在启动...'}</span>
            </div>
          </div>
        ) : (
          imageKeyStatus && <div className="form-hint status-text" style={{ marginTop: '8px' }}>{imageKeyStatus}</div>
        )}
        <span className="form-hint">优先推荐缓存计算方案。若图片无法解密，可使用内存扫描（需微信运行并打开 2-3 张图片大图）</span>
      </div>

      <div className="form-group">
        <label>调试日志</label>
        <span className="form-hint">开启后写入 WCDB 调试日志，便于排查连接问题</span>
        <div className="log-toggle-line">
          <span className="log-status">{logEnabled ? '已开启' : '已关闭'}</span>
          <label className="switch" htmlFor="log-enabled-toggle">
            <input
              id="log-enabled-toggle"
              className="switch-input"
              type="checkbox"
              checked={logEnabled}
              onChange={async (e) => {
                const enabled = e.target.checked
                setLogEnabled(enabled)
                await configService.setLogEnabled(enabled)
                showMessage(enabled ? '已开启日志' : '已关闭日志', true)
              }}
            />
            <span className="switch-slider" />
          </label>
        </div>
        <div className="log-actions">
          <button className="btn btn-secondary" onClick={handleOpenLog}>
            <FolderOpen size={16} /> 打开日志文件
          </button>
          <button className="btn btn-secondary" onClick={handleCopyLog}>
            <Copy size={16} /> 复制日志内容
          </button>
          <button className="btn btn-secondary" onClick={handleClearLog}>
            <Trash2 size={16} /> 清空日志
          </button>
        </div>
      </div>

    </div>
  )
  const resolvedWhisperModelPath = whisperModelDir || whisperModelStatus?.modelPath || ''

  const renderModelsTab = () => (
    <div className="tab-content">
      <div className="form-group">
        <label>模型管理</label>
        <span className="form-hint">管理语音识别模型</span>
      </div>

      <div className="form-group">
        <label>语音识别模型 (Whisper)</label>
        <span className="form-hint">用于语音消息转文字功能</span>

        <div className="setting-control vertical has-border">
          <div className="model-status-card">
            <div className="model-info">
              <div className="model-name-row">
                <div className="model-name">SenseVoiceSmall</div>
                <span className="model-size">245 MB</span>
              </div>
              <div className="model-meta">
                {whisperModelStatus?.exists ? (
                  <span className="status-indicator success"><Check size={14} /> 已安装</span>
                ) : (
                  <span className="status-indicator warning">未安装</span>
                )}
                {resolvedWhisperModelPath && (
                  <div className="model-path-block">
                    <span className="path-label">模型目录</span>
                    <div className="path-text" title={resolvedWhisperModelPath}>{resolvedWhisperModelPath}</div>
                  </div>
                )}
              </div>
            </div>
            {(!whisperModelStatus?.exists || isWhisperDownloading) && (
              <div className="model-actions">
                {!whisperModelStatus?.exists && !isWhisperDownloading && (
                  <button
                    className="btn-download"
                    onClick={handleDownloadWhisperModel}
                  >
                    <Download size={16} /> 下载模型
                  </button>
                )}
                {isWhisperDownloading && (
                  <div className="download-status">
                    <div className="status-header">
                      <span className="percent">{Math.round(whisperDownloadProgress)}%</span>
                      {whisperProgressData.total > 0 && (
                        <span className="details">
                          {formatBytes(whisperProgressData.downloaded)} / {formatBytes(whisperProgressData.total)}
                          <span className="speed">({formatBytes(whisperProgressData.speed)}/s)</span>
                        </span>
                      )}
                    </div>
                    <div className="progress-bar-mini">
                      <div className="fill" style={{ width: `${whisperDownloadProgress}%` }}></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="sub-setting">
            <div className="sub-label">自定义模型目录</div>
            <div className="path-selector">
              <input
                type="text"
                value={whisperModelDir}
                readOnly
                placeholder="默认目录"
              />
              <button className="btn-icon" onClick={handleSelectWhisperModelDir} title="选择目录">
                <FolderOpen size={18} />
              </button>
              {whisperModelDir && (
                <button className="btn-icon danger" onClick={handleResetWhisperModelDir} title="重置为默认">
                  <RotateCcw size={18} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="form-group">
        <label>自动转文字</label>
        <span className="form-hint">收到语音消息时自动转换为文字</span>
        <div className="log-toggle-line">
          <span className="log-status">{autoTranscribeVoice ? '已开启' : '已关闭'}</span>
          <label className="switch">
            <input
              type="checkbox"
              className="switch-input"
              checked={autoTranscribeVoice}
              onChange={(e) => {
                setAutoTranscribeVoice(e.target.checked)
                configService.setAutoTranscribeVoice(e.target.checked)
              }}
            />
            <span className="switch-slider"></span>
          </label>
        </div>
      </div>

    </div>
  )

  const renderCacheTab = () => (
      <div className="tab-content">
        <p className="section-desc">管理应用缓存数据</p>
        <div className="form-group">
          <label>缓存目录 <span className="optional">(可选)</span></label>
          <span className="form-hint">留空使用默认目录</span>
          <input
              type="text"
              placeholder="留空使用默认目录"
              value={cachePath}
              onChange={(e) => {
                const value = e.target.value
                setCachePath(value)
                scheduleConfigSave('cachePath', () => configService.setCachePath(value))
              }}
          />

          <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            当前缓存位置：
            <code style={{
              background: 'var(--bg-secondary)',
              padding: '3px 6px',
              borderRadius: '4px',
              userSelect: 'all',
              wordBreak: 'break-all',
              marginLeft: '4px'
            }}>
              {cachePath || (isMac ? '~/Documents/WeFlow' : isLinux ? '~/Documents/WeFlow' : '系统 文档\\WeFlow 目录')}
            </code>
          </div>

          <div className="btn-row" style={{ marginTop: '12px' }}>
            <button className="btn btn-secondary" onClick={handleSelectCachePath}><FolderOpen size={16} /> 浏览选择</button>
            <button
                className="btn btn-secondary"
                onClick={async () => {
                  setCachePath('')
                  await configService.setCachePath('')
                }}
            >
              <RotateCcw size={16} /> 恢复默认
            </button>
          </div>
        </div>

      <div className="btn-row">
        <button className="btn btn-secondary" onClick={handleClearAnalyticsCache} disabled={isClearingCache}>
          <Trash2 size={16} /> 清除分析缓存
        </button>
        <button className="btn btn-secondary" onClick={handleClearImageCache} disabled={isClearingCache}>
          <Trash2 size={16} /> 清除图片缓存
        </button>
        <button className="btn btn-danger" onClick={handleClearAllCache} disabled={isClearingCache}>
          <Trash2 size={16} /> 清除所有缓存</button>
      </div>
      <div className="divider" />
      <p className="section-desc">清除当前配置并重新开始首次引导</p>
      <div className="btn-row">
        <button className="btn btn-danger" onClick={handleClearConfig}>
          <RefreshCw size={16} /> 清除当前配置
        </button>
      </div>
    </div>
  )

  // HTTP API 服务控制
  const handleToggleApi = async () => {
    if (isTogglingApi) return

    // 启动时显示警告弹窗
    if (!httpApiRunning) {
      setShowApiWarning(true)
      return
    }

    setIsTogglingApi(true)
    try {
      await window.electronAPI.http.stop()
      setHttpApiRunning(false)
      await configService.setHttpApiEnabled(false)
      showMessage('API 服务已停止', true)
    } catch (e: any) {
      showMessage(`操作失败: ${e}`, false)
    } finally {
      setIsTogglingApi(false)
    }
  }

  // 确认启动 API 服务
  const confirmStartApi = async () => {
    setShowApiWarning(false)
    setIsTogglingApi(true)
    try {
      const result = await window.electronAPI.http.start(httpApiPort, httpApiHost)
      if (result.success) {
        setHttpApiRunning(true)
        if (result.port) setHttpApiPort(result.port)

        await configService.setHttpApiEnabled(true)
        await configService.setHttpApiPort(result.port || httpApiPort)

        showMessage(`API 服务已启动，端口 ${result.port}`, true)
      } else {
        showMessage(`启动失败: ${result.error}`, false)
      }
    } catch (e: any) {
      showMessage(`操作失败: ${e}`, false)
    } finally {
      setIsTogglingApi(false)
    }
  }

  const handleCopyApiUrl = () => {
    const url = `http://${httpApiHost}:${httpApiPort}`
    navigator.clipboard.writeText(url)
    showMessage('已复制 API 地址', true)
  }

  const handleToggleMessagePush = async (enabled: boolean) => {
    setMessagePushEnabled(enabled)
    await configService.setMessagePushEnabled(enabled)
    showMessage(enabled ? '已开启主动推送' : '已关闭主动推送', true)
  }

  const getSessionFilterType = (session: { username: string; type?: ContactInfo['type'] | number }): SessionFilterType => {
    const username = String(session.username || '').trim()
    if (username.endsWith('@chatroom')) return 'group'
    if (username.startsWith('gh_') || session.type === 'official') return 'official'
    if (username.toLowerCase().includes('placeholder_foldgroup')) return 'other'
    if (session.type === 'former_friend' || session.type === 'other') return 'other'
    return 'private'
  }

  const getSessionFilterTypeLabel = (type: SessionFilterType) => {
    switch (type) {
      case 'private': return '私聊'
      case 'group': return '群聊'
      case 'official': return '订阅号/服务号'
      default: return '其他/非好友'
    }
  }

  const handleSetMessagePushFilterMode = async (mode: configService.MessagePushFilterMode) => {
    setMessagePushFilterMode(mode)
    setMessagePushFilterDropdownOpen(false)
    await configService.setMessagePushFilterMode(mode)
    showMessage(
      mode === 'all' ? '主动推送已设为接收所有会话' :
        mode === 'whitelist' ? '主动推送已设为仅推送白名单' : '主动推送已设为屏蔽黑名单',
      true
    )
  }

  const handleAddMessagePushFilterSession = async (username: string) => {
    if (messagePushFilterList.includes(username)) return
    const next = [...messagePushFilterList, username]
    setMessagePushFilterList(next)
    await configService.setMessagePushFilterList(next)
    showMessage('已添加到主动推送过滤列表', true)
  }

  const handleRemoveMessagePushFilterSession = async (username: string) => {
    const next = messagePushFilterList.filter(item => item !== username)
    setMessagePushFilterList(next)
    await configService.setMessagePushFilterList(next)
    showMessage('已从主动推送过滤列表移除', true)
  }

  const handleAddAllMessagePushFilterSessions = async () => {
    const usernames = messagePushAvailableSessions.map(session => session.username)
    if (usernames.length === 0) return
    const next = Array.from(new Set([...messagePushFilterList, ...usernames]))
    setMessagePushFilterList(next)
    await configService.setMessagePushFilterList(next)
    showMessage(`已添加 ${usernames.length} 个会话`, true)
  }

  const handleRemoveAllMessagePushFilterSessions = async () => {
    if (messagePushFilterList.length === 0) return
    setMessagePushFilterList([])
    await configService.setMessagePushFilterList([])
    showMessage('已清空主动推送过滤列表', true)
  }

  const sessionFilterOptionMap = new Map<string, SessionFilterOption>()

  for (const session of chatSessions) {
    if (session.username.toLowerCase().includes('placeholder_foldgroup')) continue
    sessionFilterOptionMap.set(session.username, {
      username: session.username,
      displayName: session.displayName || session.username,
      avatarUrl: session.avatarUrl,
      type: getSessionFilterType(session)
    })
  }

  for (const contact of messagePushContactOptions) {
    if (!contact.username) continue
    if (contact.type !== 'friend' && contact.type !== 'group' && contact.type !== 'official' && contact.type !== 'former_friend') continue
    const existing = sessionFilterOptionMap.get(contact.username)
    sessionFilterOptionMap.set(contact.username, {
      username: contact.username,
      displayName: existing?.displayName || contact.displayName || contact.remark || contact.nickname || contact.username,
      avatarUrl: existing?.avatarUrl || contact.avatarUrl,
      type: getSessionFilterType(contact)
    })
  }

  const sessionFilterOptions = Array.from(sessionFilterOptionMap.values())
    .sort((a, b) => {
      const aSession = chatSessions.find(session => session.username === a.username)
      const bSession = chatSessions.find(session => session.username === b.username)
      return Number(bSession?.sortTimestamp || bSession?.lastTimestamp || 0) -
        Number(aSession?.sortTimestamp || aSession?.lastTimestamp || 0)
    })

  const getSessionFilterOptionInfo = (username: string) => {
    return sessionFilterOptionMap.get(username) || {
      username,
      displayName: username,
      avatarUrl: undefined,
      type: 'other' as SessionFilterType
    }
  }

  const getAvailableSessionFilterOptions = (
    selectedList: string[],
    typeFilter: SessionFilterTypeValue,
    searchKeyword: string
  ) => {
    const keyword = searchKeyword.trim().toLowerCase()
    return sessionFilterOptions.filter(session => {
      if (selectedList.includes(session.username)) return false
      if (typeFilter !== 'all' && session.type !== typeFilter) return false
      if (keyword) {
        return String(session.displayName || '').toLowerCase().includes(keyword) ||
          session.username.toLowerCase().includes(keyword)
      }
      return true
    })
  }

  const notificationAvailableSessions = getAvailableSessionFilterOptions(
    notificationFilterList,
    notificationTypeFilter,
    filterSearchKeyword
  )

  const messagePushAvailableSessions = getAvailableSessionFilterOptions(
    messagePushFilterList,
    messagePushTypeFilter,
    messagePushFilterSearchKeyword
  )

  const handleAddAllNotificationFilterSessions = async () => {
    const usernames = notificationAvailableSessions.map(session => session.username)
    if (usernames.length === 0) return
    const next = Array.from(new Set([...notificationFilterList, ...usernames]))
    setNotificationFilterList(next)
    await configService.setNotificationFilterList(next)
    showMessage(`已添加 ${usernames.length} 个会话`, true)
  }

  const handleRemoveAllNotificationFilterSessions = async () => {
    if (notificationFilterList.length === 0) return
    setNotificationFilterList([])
    await configService.setNotificationFilterList([])
    showMessage('已清空通知过滤列表', true)
  }

  const handleSetNotificationFilterMode = async (mode: SessionFilterMode) => {
    setNotificationFilterMode(mode)
    setFilterModeDropdownOpen(false)
    await configService.setNotificationFilterMode(mode)
    showMessage(
      mode === 'all' ? '已设为接收所有通知' :
        mode === 'whitelist' ? '已设为仅接收白名单通知' : '已设为屏蔽黑名单通知',
      true
    )
  }

  const handleTestInsightConnection = async () => {
    setIsTestingInsight(true)
    setInsightTestResult(null)
    try {
      const result = await window.electronAPI.insight.testConnection()
      setInsightTestResult(result)
    } catch (e: any) {
      setInsightTestResult({ success: false, message: `调用失败：${e?.message || String(e)}` })
    } finally {
      setIsTestingInsight(false)
    }
  }

  const renderAiCommonTab = () => (
    <div className="tab-content">
      <div className="form-group">
        <label>通用 API 地址</label>
        <span className="form-hint">
          这是「AI 见解」与「AI 足迹总结」共享的模型接入配置。填写 OpenAI 兼容接口的 <strong>Base URL</strong>，末尾<strong>不要加斜杠</strong>。
          程序会自动拼接 <code>/chat/completions</code>。
          <br />
          示例：<code>https://api.ohmygpt.com/v1</code> 或 <code>https://api.openai.com/v1</code>
        </span>
        <input
          type="text"
          className="field-input"
          value={aiModelApiBaseUrl}
          placeholder="https://api.ohmygpt.com/v1"
          onChange={(e) => {
            const val = e.target.value
            setAiModelApiBaseUrl(val)
            scheduleConfigSave('aiModelApiBaseUrl', () => configService.setAiModelApiBaseUrl(val))
          }}
        />
      </div>

      <div className="form-group">
        <label>通用 API Key</label>
        <span className="form-hint">
          你的 API Key，保存后经过系统加密存储，不会明文写入磁盘。
        </span>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input
            type={showInsightApiKey ? 'text' : 'password'}
            className="field-input"
            value={aiModelApiKey}
            placeholder="sk-..."
            onChange={(e) => {
              const val = e.target.value
              setAiModelApiKey(val)
              scheduleConfigSave('aiModelApiKey', () => configService.setAiModelApiKey(val))
            }}
            style={{ flex: 1 }}
          />
          <button
            className="btn btn-secondary"
            onClick={() => setShowInsightApiKey(!showInsightApiKey)}
            title={showInsightApiKey ? '隐藏' : '显示'}
          >
            {showInsightApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          {aiModelApiKey && (
            <button
              className="btn btn-danger"
              onClick={async () => {
                setAiModelApiKey('')
                await configService.setAiModelApiKey('')
              }}
              title="清除 Key"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="form-group">
        <label>通用模型名称</label>
        <span className="form-hint">
          填写你的 API 提供商支持的模型名，将同时用于见解和足迹模块。
          <br />
          常用示例：<code>gpt-4o-mini</code>、<code>gpt-4o</code>、<code>deepseek-chat</code>、<code>claude-3-5-haiku-20241022</code>
        </span>
        <input
          type="text"
          className="field-input"
          value={aiModelApiModel}
          placeholder="gpt-4o-mini"
          onChange={(e) => {
            const val = e.target.value.trim() || 'gpt-4o-mini'
            setAiModelApiModel(val)
            scheduleConfigSave('aiModelApiModel', () => configService.setAiModelApiModel(val))
          }}
          style={{ width: 260 }}
        />
      </div>

      <div className="form-group">
        <label>通用 Max Tokens</label>
        <span className="form-hint">
          设置单次请求的最大输出 token 数量，见解与足迹共享该值。默认 <code>200</code>。
        </span>
        <input
          type="number"
          className="field-input"
          value={aiModelApiMaxTokens}
          min={1}
          max={65535}
          step={1}
          onChange={(e) => {
            const parsed = parseInt(e.target.value, 10)
            const val = Math.min(65535, Math.max(1, Number.isFinite(parsed) ? parsed : 200))
            setAiModelApiMaxTokens(val)
            scheduleConfigSave('aiModelApiMaxTokens', () => configService.setAiModelApiMaxTokens(val))
          }}
          style={{ width: 260 }}
        />
      </div>

      <div className="form-group">
        <label>连接测试</label>
        <span className="form-hint">
          测试通用模型连接，见解与足迹都会使用这套配置。
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '10px' }}>
          <button
            className="btn btn-secondary"
            onClick={handleTestInsightConnection}
            disabled={isTestingInsight || !aiModelApiBaseUrl || !aiModelApiKey}
          >
            {isTestingInsight ? (
              <><Loader2 size={14} style={{ marginRight: 4, animation: 'spin 1s linear infinite' }} />测试中...</>
            ) : (
              <>测试 API 连接</>
            )}
          </button>
          {insightTestResult && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: insightTestResult.success ? 'var(--color-success, #22c55e)' : 'var(--color-danger, #ef4444)' }}>
              {insightTestResult.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              {insightTestResult.message}
            </span>
          )}
        </div>
      </div>

    </div>
  )

  const withAsyncTimeout = async <T,>(task: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null
    try {
      return await Promise.race([
        task,
        new Promise<T>((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
        })
      ])
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle)
    }
  }

  const hasWeiboCookieConfigured = aiInsightWeiboCookie.trim().length > 0

  const openWeiboCookieModal = () => {
    setWeiboCookieDraft(aiInsightWeiboCookie)
    setWeiboCookieError('')
    setShowWeiboCookieModal(true)
  }

  const persistWeiboCookieDraft = async (draftOverride?: string): Promise<boolean> => {
    const draftToSave = draftOverride ?? weiboCookieDraft
    if (draftToSave === aiInsightWeiboCookie) return true
    setIsSavingWeiboCookie(true)
    setWeiboCookieError('')
    try {
      const result = await withAsyncTimeout(
        window.electronAPI.social.saveWeiboCookie(draftToSave),
        10000,
        '保存微博 Cookie 超时，请稍后重试'
      )
      if (!result.success) {
        setWeiboCookieError(result.error || '微博 Cookie 保存失败')
        return false
      }
      const normalized = result.normalized || ''
      setAiInsightWeiboCookie(normalized)
      setWeiboCookieDraft(normalized)
      showMessage(result.hasCookie ? '微博 Cookie 已保存' : '微博 Cookie 已清空', true)
      return true
    } catch (e: any) {
      setWeiboCookieError(e?.message || String(e))
      return false
    } finally {
      setIsSavingWeiboCookie(false)
    }
  }

  const handleCloseWeiboCookieModal = async (discard = false) => {
    if (discard) {
      setShowWeiboCookieModal(false)
      setWeiboCookieDraft(aiInsightWeiboCookie)
      setWeiboCookieError('')
      return
    }
    const ok = await persistWeiboCookieDraft()
    if (!ok) return
    setShowWeiboCookieModal(false)
    setWeiboCookieError('')
  }

  const getWeiboBindingDraftValue = (sessionId: string): string => {
    const draft = weiboBindingDrafts[sessionId]
    if (draft !== undefined) return draft
    return aiInsightWeiboBindings[sessionId]?.uid || ''
  }

  const updateWeiboBindingDraft = (sessionId: string, value: string) => {
    setWeiboBindingDrafts((prev) => ({
      ...prev,
      [sessionId]: value
    }))
    setWeiboBindingErrors((prev) => {
      if (!prev[sessionId]) return prev
      const next = { ...prev }
      delete next[sessionId]
      return next
    })
  }

  const isMomentsEnabledForSession = (sessionId: string): boolean => {
    return aiInsightMomentsBindings[sessionId]?.enabled === true
  }

  const handleToggleMomentsBinding = async (sessionId: string, enabled: boolean) => {
    const nextBindings = { ...aiInsightMomentsBindings }
    if (enabled) {
      nextBindings[sessionId] = {
        enabled: true,
        updatedAt: Date.now()
      }
    } else {
      delete nextBindings[sessionId]
    }
    setAiInsightMomentsBindings(nextBindings)
    await configService.setAiInsightMomentsBindings(nextBindings)
  }

  const handleSaveWeiboBinding = async (sessionId: string, displayName: string) => {
    const draftUid = getWeiboBindingDraftValue(sessionId)
    setWeiboBindingLoadingSessionId(sessionId)
    setWeiboBindingErrors((prev) => {
      if (!prev[sessionId]) return prev
      const next = { ...prev }
      delete next[sessionId]
      return next
    })
    try {
      const result = await withAsyncTimeout(
        window.electronAPI.social.validateWeiboUid(draftUid),
        12000,
        '微博 UID 校验超时，请稍后重试'
      )
      if (!result.success || !result.uid) {
        setWeiboBindingErrors((prev) => ({ ...prev, [sessionId]: result.error || '微博 UID 校验失败' }))
        return
      }

      const nextBindings: Record<string, configService.AiInsightWeiboBinding> = {
        ...aiInsightWeiboBindings,
        [sessionId]: {
          uid: result.uid,
          screenName: result.screenName,
          updatedAt: Date.now()
        }
      }
      setAiInsightWeiboBindings(nextBindings)
      await configService.setAiInsightWeiboBindings(nextBindings)
      setWeiboBindingDrafts((prev) => ({ ...prev, [sessionId]: result.uid! }))
      showMessage(`已为「${displayName}」绑定微博 UID`, true)
    } catch (e: any) {
      setWeiboBindingErrors((prev) => ({ ...prev, [sessionId]: e?.message || String(e) }))
    } finally {
      setWeiboBindingLoadingSessionId(null)
    }
  }

  const handleClearWeiboBinding = async (sessionId: string, silent = false) => {
    const nextBindings = { ...aiInsightWeiboBindings }
    delete nextBindings[sessionId]
    setAiInsightWeiboBindings(nextBindings)
    setWeiboBindingDrafts((prev) => ({ ...prev, [sessionId]: '' }))
    setWeiboBindingErrors((prev) => {
      if (!prev[sessionId]) return prev
      const next = { ...prev }
      delete next[sessionId]
      return next
    })
    await configService.setAiInsightWeiboBindings(nextBindings)
    if (!silent) showMessage('已清除微博绑定', true)
  }
  const renderInsightTab = () => (
    <div className="tab-content">
      {/* 总开关 */}
      <div className="form-group">
        <label>AI 见解</label>
        <span className="form-hint">
          开启后，AI 会在后台默默分析聊天数据，在合适的时机通过右下角弹窗送出一针见血的见解——例如提醒你久未联系的朋友，或对你刚刚的对话提出回复建议。默认关闭，所有分析均在本地发起请求，不经过任何第三方中间服务。
        </span>
        <div className="log-toggle-line">
          <span className="log-status">{aiInsightEnabled ? '已开启' : '已关闭'}</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={aiInsightEnabled}
              onChange={async (e) => {
                const val = e.target.checked
                setAiInsightEnabled(val)
                await configService.setAiInsightEnabled(val)
                showMessage(val ? 'AI 见解已开启' : 'AI 见解已关闭', true)
              }}
            />
            <span className="switch-slider" />
          </label>
        </div>
      </div>

      <div className="divider" />

      <div className="form-group">
        <label>调试工具</label>
        <span className="form-hint">
          该功能依赖「基础配置」里的模型配置。用于验证完整链路（数据库→API→弹窗）。
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '10px' }}>
          <button
            className="btn btn-secondary"
            onClick={async () => {
              setIsTriggeringInsightTest(true)
              setInsightTriggerResult(null)
              try {
                const result = await window.electronAPI.insight.triggerTest()
                setInsightTriggerResult(result)
              } catch (e: any) {
                setInsightTriggerResult({ success: false, message: `调用失败：${e?.message || String(e)}` })
              } finally {
                setIsTriggeringInsightTest(false)
              }
            }}
            disabled={isTriggeringInsightTest || !aiInsightEnabled || !aiModelApiBaseUrl || !aiModelApiKey}
            title={!aiInsightEnabled ? '请先开启 AI 见解总开关' : ''}
          >
            {isTriggeringInsightTest ? (
              <><Loader2 size={14} style={{ marginRight: 4, animation: 'spin 1s linear infinite' }} />触发中...</>
            ) : (
              <>立即触发测试见解</>
            )}
          </button>
          {insightTriggerResult && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: insightTriggerResult.success ? 'var(--color-success, #22c55e)' : 'var(--color-danger, #ef4444)' }}>
              {insightTriggerResult.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              {insightTriggerResult.message}
            </span>
          )}
        </div>
      </div>

      <div className="divider" />

      {/* 行为配置 */}
      <div className="form-group">
        <label>活跃触发冷却期（分钟）</label>
        <span className="form-hint">
          有新消息时触发活跃分析的冷却时间。设为 <strong>0</strong> 表示无冷却，每条新消息都可能触发见解（AI 言论自由模式）。建议按需调整，费用自理。
        </span>
        <input
          type="number"
          className="field-input"
          value={aiInsightCooldownMinutes}
          min={0}
          max={10080}
          onChange={(e) => {
            const val = Math.max(0, parseInt(e.target.value, 10) || 0)
            setAiInsightCooldownMinutes(val)
            scheduleConfigSave('aiInsightCooldownMinutes', () => configService.setAiInsightCooldownMinutes(val))
          }}
          style={{ width: 120 }}
        />
        {aiInsightCooldownMinutes === 0 && (
          <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--color-warning, #f59e0b)' }}>
            无冷却 — 每次 DB 变更均可触发
          </span>
        )}
      </div>

      <div className="form-group">
        <label>沉默联系人扫描间隔（小时）</label>
        <span className="form-hint">
          多久扫描一次沉默联系人。重启生效。最小 0.1 小时（6 分钟）。
        </span>
        <input
          type="number"
          className="field-input"
          value={aiInsightScanIntervalHours}
          min={0.1}
          max={168}
          step={0.5}
          onChange={(e) => {
            const val = Math.max(0.1, parseFloat(e.target.value) || 4)
            setAiInsightScanIntervalHours(val)
            scheduleConfigSave('aiInsightScanIntervalHours', () => configService.setAiInsightScanIntervalHours(val))
          }}
          style={{ width: 120 }}
        />
      </div>

      <div className="form-group">
        <label>沉默联系人阈值（天）</label>
        <span className="form-hint">
          与某私聊联系人超过此天数没有消息往来时，触发沉默类见解。
        </span>
        <input
          type="number"
          className="field-input"
          value={aiInsightSilenceDays}
          min={1}
          max={365}
          onChange={(e) => {
            const val = Math.max(1, parseInt(e.target.value, 10) || 3)
            setAiInsightSilenceDays(val)
            scheduleConfigSave('aiInsightSilenceDays', () => configService.setAiInsightSilenceDays(val))
          }}
          style={{ width: 100 }}
        />
      </div>

      <div className="form-group">
        <label>允许发送近期对话内容用于分析</label>
        <span className="form-hint">
          开启后，触发见解时会将该联系人最近 N 条聊天记录发送给 AI，分析质量显著提升。
          <br />
          <strong>关闭时</strong>：不会发送聊天原文，输出质量较低。
          <br />
          <strong>开启时</strong>：聊天文本内容（不含图片、语音）会通过你配置的 API 发送给模型提供商。请确认你信任该服务商。
        </span>
        <div className="log-toggle-line">
          <span className="log-status">{aiInsightAllowContext ? '已授权' : '未授权'}</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={aiInsightAllowContext}
              onChange={async (e) => {
                const val = e.target.checked
                setAiInsightAllowContext(val)
                await configService.setAiInsightAllowContext(val)
              }}
            />
            <span className="switch-slider" />
          </label>
        </div>
      </div>

      <div className={`insight-collapsible-setting ${aiInsightAllowContext ? 'expanded' : 'collapsed'}`} aria-hidden={!aiInsightAllowContext}>
        <div className="insight-collapsible-setting-inner">
          <div className="form-group">
            <label>发送近期对话条数</label>
            <span className="form-hint">
              发送给 AI 的聊天记录最大条数。条数越多分析越准确，token 消耗也越多。
            </span>
            <input
              type="number"
              className="field-input"
              value={aiInsightContextCount}
              min={1}
              max={200}
              disabled={!aiInsightAllowContext}
              onChange={(e) => {
                const val = Math.max(1, Math.min(200, parseInt(e.target.value, 10) || 40))
                setAiInsightContextCount(val)
                scheduleConfigSave('aiInsightContextCount', () => configService.setAiInsightContextCount(val))
              }}
              style={{ width: 100 }}
            />
          </div>
        </div>
      </div>

      <div className="divider" />

      <div className="form-group">
        <label>允许发送近期朋友圈内容用于分析（实验性）</label>
        <span className="form-hint">
          开启后，可在下方列表为私聊联系人单独允许朋友圈补充分析。程序只会在触发见解时按需读取，不会做后台持续扫描。
        </span>
        <div className="log-toggle-line">
          <span className="log-status">{aiInsightAllowMomentsContext ? '已开启' : '已关闭'}</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={aiInsightAllowMomentsContext}
              onChange={async (e) => {
                const val = e.target.checked
                setAiInsightAllowMomentsContext(val)
                await configService.setAiInsightAllowMomentsContext(val)
              }}
            />
            <span className="switch-slider" />
          </label>
        </div>
      </div>

      <div className={`insight-collapsible-setting ${aiInsightAllowMomentsContext ? 'expanded' : 'collapsed'}`} aria-hidden={!aiInsightAllowMomentsContext}>
        <div className="insight-collapsible-setting-inner">
          <div className="form-group">
            <label>发送近期朋友圈条数</label>
            <span className="form-hint">
              发送给 AI 的朋友圈最大条数。条数越多上下文越充分，token 消耗也越多。
            </span>
            <input
              type="number"
              className="field-input"
              value={aiInsightMomentsContextCount}
              min={1}
              max={20}
              disabled={!aiInsightAllowMomentsContext}
              onChange={(e) => {
                const val = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 5))
                setAiInsightMomentsContextCount(val)
                scheduleConfigSave('aiInsightMomentsContextCount', () => configService.setAiInsightMomentsContextCount(val))
              }}
              style={{ width: 100 }}
            />
          </div>
        </div>
      </div>

      <div className="divider" />

      <div className="form-group">
        <label>允许发送近期社交平台内容用于分析（实验性）</label>
        <span className="form-hint">
          当前仅支持微博，且仅对已手动绑定微博 UID 的联系人生效。为了控制资源占用和平台风控，程序只会在触发见解时按需抓取近期公开内容，不会做后台持续扫描。
        </span>
        <div className="log-toggle-line">
          <span className="log-status">{aiInsightAllowSocialContext ? '已开启' : '已关闭'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: hasWeiboCookieConfigured ? 'var(--color-success, #22c55e)' : 'var(--text-tertiary)' }}>
              {hasWeiboCookieConfigured ? '微博 Cookie 已配置' : '微博 Cookie 未配置'}
            </span>
            <button className="btn btn-secondary btn-sm" type="button" onClick={openWeiboCookieModal}>
              {hasWeiboCookieConfigured ? '编辑微博 Cookie' : '填写微博 Cookie'}
            </button>
            <label className="switch">
              <input
                type="checkbox"
                checked={aiInsightAllowSocialContext}
                onChange={async (e) => {
                  const val = e.target.checked
                  setAiInsightAllowSocialContext(val)
                  await configService.setAiInsightAllowSocialContext(val)
                }}
              />
              <span className="switch-slider" />
            </label>
          </div>
        </div>
        {!hasWeiboCookieConfigured && (
          <span className="form-hint" style={{ marginTop: 8, display: 'block' }}>
            未配置微博 Cookie 时，也会尝试抓取微博公开内容；但可能因平台风控导致获取失败或内容较少。
          </span>
        )}
      </div>

      <div className={`insight-collapsible-setting ${aiInsightAllowSocialContext ? 'expanded' : 'collapsed'}`} aria-hidden={!aiInsightAllowSocialContext}>
        <div className="insight-collapsible-setting-inner">
          <div className="form-group">
            <label>发送近期社交平台内容条数</label>
            <span className="form-hint">
              当前仅支持微博最近发帖。
              <br />
              <strong>不建议超过 5，避免触发平台风控。</strong>
            </span>
            <input
              type="number"
              className="field-input"
              value={aiInsightSocialContextCount}
              min={1}
              max={5}
              disabled={!aiInsightAllowSocialContext}
              onChange={(e) => {
                const val = Math.max(1, Math.min(5, parseInt(e.target.value, 10) || 3))
                setAiInsightSocialContextCount(val)
                scheduleConfigSave('aiInsightSocialContextCount', () => configService.setAiInsightSocialContextCount(val))
              }}
              style={{ width: 100 }}
            />
          </div>
        </div>
      </div>

      <div className="divider" />
      {/* 自定义 System Prompt */}
      {(() => {
        const DEFAULT_SYSTEM_PROMPT = `你是用户的私人关系观察助手，名叫"见解"。你的任务是主动提供有价值的观察和建议。

要求：
1. 必须给出见解。基于聊天记录分析对方情绪、话题趋势、关系动态，或给出回复建议、聊天话题推荐。
2. 控制在 80 字以内，直接、具体、一针见血。不要废话。
3. 输出纯文本，不使用 Markdown。
4. 只有在完全没有任何可说的内容时（比如对话只有一条"嗯"），才回复"SKIP"。绝大多数情况下你应该输出见解。`

        // 展示值：有自定义内容时显示自定义内容，否则显示默认值（可直接编辑）
        const displayValue = aiInsightSystemPrompt || DEFAULT_SYSTEM_PROMPT

        return (
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ marginBottom: 0 }}>自定义 AI 见解提示词</label>
              <button
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  // 恢复默认：清空自定义值，UI 回到显示默认内容的状态
                  setAiInsightSystemPrompt('')
                  await configService.setAiInsightSystemPrompt('')
                }}
              >
                恢复默认
              </button>
            </div>
            <span className="form-hint">
              当前显示内置默认提示词，可直接编辑修改。修改后立即生效，无需重启。可变的统计信息（触发次数、对话内容）会自动附加在用户消息里，无需在此填写。
            </span>
            <textarea
              className="field-input ai-prompt-textarea"
              rows={8}
              style={{ width: '100%', resize: 'vertical' }}
              value={displayValue}
              onChange={(e) => {
                const val = e.target.value
                // 如果用户把内容改得和默认值一样，仍存自定义值（不影响功能）
                setAiInsightSystemPrompt(val)
                scheduleConfigSave('aiInsightSystemPrompt', () => configService.setAiInsightSystemPrompt(val))
              }}
            />
          </div>
        )
      })()}

      <div className="divider" />

      {/* Telegram 推送 */}
      <div className="form-group">
        <label>Telegram Bot 推送</label>
        <span className="form-hint">
          开启后，见解同时推送到指定 Telegram 用户/群组，方便手机即时收到通知。需要先创建 Bot 并获取 Token（通过 @BotFather），Chat ID 可通过 @userinfobot 获取，多个 ID 用英文逗号分隔。
        </span>
        <div className="log-toggle-line">
          <span className="log-status">{aiInsightTelegramEnabled ? '已启用' : '未启用'}</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={aiInsightTelegramEnabled}
              onChange={async (e) => {
                const val = e.target.checked
                setAiInsightTelegramEnabled(val)
                await configService.setAiInsightTelegramEnabled(val)
              }}
            />
            <span className="switch-slider" />
          </label>
        </div>
      </div>

      {aiInsightTelegramEnabled && (
        <>
          <div className="form-group">
            <label>Bot Token</label>
            <input
              type="password"
              className="field-input"
              style={{ width: '100%' }}
              placeholder="在此处填入你的 Telegram Bot Token"
              value={aiInsightTelegramToken}
              onChange={(e) => {
                const val = e.target.value
                setAiInsightTelegramToken(val)
                scheduleConfigSave('aiInsightTelegramToken', () => configService.setAiInsightTelegramToken(val))
              }}
            />
          </div>
          <div className="form-group">
            <label>Chat ID（支持英文逗号分隔多个）</label>
            <input
              type="text"
              className="field-input"
              style={{ width: '100%' }}
              placeholder="123456789, -987654321"
              value={aiInsightTelegramChatIds}
              onChange={(e) => {
                const val = e.target.value
                setAiInsightTelegramChatIds(val)
                scheduleConfigSave('aiInsightTelegramChatIds', () => configService.setAiInsightTelegramChatIds(val))
              }}
            />
          </div>
        </>
      )}

      <div className="divider" />

      {/* 对话过滤名单 */}
      {(() => {
        const selectableSessions = sessionFilterOptions.filter((session) =>
          session.type === 'private' || session.type === 'group' || session.type === 'official'
        )
        const keyword = insightWhitelistSearch.trim().toLowerCase()
        const filteredSessions = selectableSessions.filter((session) => {
          if (insightFilterType !== 'all' && session.type !== insightFilterType) return false
          const id = session.username?.trim() || ''
          if (!id || id.toLowerCase().includes('placeholder')) return false
          if (!keyword) return true
          return (
            String(session.displayName || '').toLowerCase().includes(keyword) ||
            id.toLowerCase().includes(keyword)
          )
        })
        const filteredIds = filteredSessions.map((session) => session.username)
        const selectedCount = aiInsightFilterList.size
        const selectedInFilteredCount = filteredIds.filter((id) => aiInsightFilterList.has(id)).length
        const allFilteredSelected = filteredIds.length > 0 && selectedInFilteredCount === filteredIds.length

        const saveFilterList = async (next: Set<string>) => {
          await configService.setAiInsightFilterList(Array.from(next))
        }

        const saveFilterMode = async (mode: configService.AiInsightFilterMode) => {
          setAiInsightFilterMode(mode)
          setInsightFilterModeDropdownOpen(false)
          await configService.setAiInsightFilterMode(mode)
          showMessage(mode === 'whitelist' ? '已切换为白名单模式' : '已切换为黑名单模式', true)
        }

        const selectAllFiltered = () => {
          setAiInsightFilterList((prev) => {
            const next = new Set(prev)
            for (const id of filteredIds) next.add(id)
            void saveFilterList(next)
            return next
          })
        }

        const clearSelection = () => {
          const next = new Set<string>()
          setAiInsightFilterList(next)
          void saveFilterList(next)
        }

        return (
          <div className="anti-revoke-tab insight-social-tab">
            <div className="anti-revoke-hero">
              <div className="anti-revoke-hero-main">
                <h3>对话黑白名单</h3>
                <p>
                  白名单模式下仅对已选会话触发见解；黑名单模式下会跳过已选会话。默认白名单且不选择任何会话。支持私聊、群聊、订阅号/服务号分类筛选后批量选择。
                </p>
              </div>
              <div className="anti-revoke-metrics">
                <div className="anti-revoke-metric is-total">
                  <span className="label">可选会话总数</span>
                  <span className="value">{selectableSessions.length}</span>
                </div>
                <div className="anti-revoke-metric is-installed">
                  <span className="label">已加入名单</span>
                  <span className="value">{selectedCount}</span>
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <div className="log-toggle-line">
                <span className="log-status" style={{ fontWeight: 600 }}>
                  {aiInsightFilterMode === 'whitelist'
                    ? '白名单模式（仅对名单内会话生效）'
                    : '黑名单模式（名单内会话将被忽略）'}
                </span>
                <div className="custom-select" style={{ minWidth: 210 }}>
                  <div
                    className={`custom-select-trigger ${insightFilterModeDropdownOpen ? 'open' : ''}`}
                    onClick={() => setInsightFilterModeDropdownOpen(!insightFilterModeDropdownOpen)}
                  >
                    <span className="custom-select-value">
                      {aiInsightFilterMode === 'whitelist' ? '白名单模式' : '黑名单模式'}
                    </span>
                    <ChevronDown size={14} className={`custom-select-arrow ${insightFilterModeDropdownOpen ? 'rotate' : ''}`} />
                  </div>
                  <div className={`custom-select-dropdown ${insightFilterModeDropdownOpen ? 'open' : ''}`}>
                    {[
                      { value: 'whitelist', label: '白名单模式' },
                      { value: 'blacklist', label: '黑名单模式' }
                    ].map(option => (
                      <div
                        key={option.value}
                        className={`custom-select-option ${aiInsightFilterMode === option.value ? 'selected' : ''}`}
                        onClick={() => { void saveFilterMode(option.value as configService.AiInsightFilterMode) }}
                      >
                        {option.label}
                        {aiInsightFilterMode === option.value && <Check size={14} />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="anti-revoke-control-card">
              <div className="push-filter-type-tabs" style={{ marginBottom: 10 }}>
                {insightFilterTypeOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    className={`push-filter-type-tab ${insightFilterType === option.value ? 'active' : ''}`}
                    onClick={() => setInsightFilterType(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="anti-revoke-toolbar">
                <div className="filter-search-box anti-revoke-search">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="搜索对话..."
                    value={insightWhitelistSearch}
                    onChange={(e) => setInsightWhitelistSearch(e.target.value)}
                  />
                </div>
                <div className="anti-revoke-toolbar-actions">
                  <div className="anti-revoke-btn-group">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={selectAllFiltered}
                      disabled={filteredIds.length === 0 || allFilteredSelected}
                    >
                      全选
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={clearSelection}
                      disabled={selectedCount === 0}
                    >
                      清空选择
                    </button>
                  </div>
                </div>
              </div>

              <div className="anti-revoke-batch-actions">
                <div className="anti-revoke-selected-count">
                  <span>已选 <strong>{selectedCount}</strong> 个对话</span>
                  <span>筛选命中 <strong>{selectedInFilteredCount}</strong> / {filteredIds.length}</span>
                </div>
              </div>
            </div>

            <div className="anti-revoke-list">
              {filteredSessions.length === 0 ? (
                <div className="anti-revoke-empty">
                  {insightWhitelistSearch || insightFilterType !== 'all' ? '没有匹配的对话' : '暂无可选对话'}
                </div>
              ) : (
                <>
                  <div className="anti-revoke-list-header">
                    <span>对话（{filteredSessions.length}）</span>
                    <span className="insight-moments-column-title">朋友圈</span>
                    <span className="insight-social-column-title">社交平台（微博）</span>
                    <span className="anti-revoke-status-column-title">状态</span>
                  </div>
                  {filteredSessions.map((session) => {
                    const isSelected = aiInsightFilterList.has(session.username)
                    const isPrivateSession = session.type === 'private'
                    const isMomentsEnabled = isMomentsEnabledForSession(session.username)
                    const weiboBinding = aiInsightWeiboBindings[session.username]
                    const weiboDraftValue = getWeiboBindingDraftValue(session.username)
                    const isBindingLoading = weiboBindingLoadingSessionId === session.username
                    const weiboBindingError = weiboBindingErrors[session.username]
                    return (
                      <div
                        key={session.username}
                        className={`anti-revoke-row ${isSelected ? 'selected' : ''}`}
                      >
                        <label className="anti-revoke-row-main">
                          <span className="anti-revoke-check">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={async () => {
                                setAiInsightFilterList((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(session.username)) next.delete(session.username)
                                  else next.add(session.username)
                                  void configService.setAiInsightFilterList(Array.from(next))
                                  return next
                                })
                              }}
                            />
                            <span className="check-indicator" aria-hidden="true">
                              <Check size={12} />
                            </span>
                          </span>
                          <Avatar
                            src={session.avatarUrl}
                            name={session.displayName || session.username}
                            size={30}
                          />
                          <div className="anti-revoke-row-text">
                            <span className="name">{session.displayName || session.username}</span>
                            <span className="desc">{getSessionFilterTypeLabel(session.type)}</span>
                          </div>
                        </label>
                        <div className="insight-moments-cell">
                          {isPrivateSession ? (
                            <label className="insight-moments-toggle">
                              <input
                                type="checkbox"
                                checked={isMomentsEnabled}
                                onChange={(e) => { void handleToggleMomentsBinding(session.username, e.target.checked) }}
                              />
                              <span className="check-indicator" aria-hidden="true">
                                <Check size={12} />
                              </span>
                            </label>
                          ) : (
                            <span className="binding-feedback muted">-</span>
                          )}
                        </div>
                        <div className="insight-social-binding-cell">
                          {isPrivateSession ? (
                            <>
                              <div className="insight-social-binding-input-wrap">
                                <span className="binding-platform-chip">微博</span>
                                <input
                                  type="text"
                                  className="insight-social-binding-input"
                                  value={weiboDraftValue}
                                  placeholder="填写数字 UID"
                                  onChange={(e) => updateWeiboBindingDraft(session.username, e.target.value)}
                                />
                              </div>
                              <div className="insight-social-binding-actions">
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => void handleSaveWeiboBinding(session.username, session.displayName || session.username)}
                                  disabled={isBindingLoading || !weiboDraftValue.trim()}
                                >
                                  {isBindingLoading ? '绑定中...' : (weiboBinding ? '更新' : '绑定')}
                                </button>
                                {weiboBinding && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => void handleClearWeiboBinding(session.username)}
                                  >
                                    清除
                                  </button>
                                )}
                              </div>
                              <div className="insight-social-binding-feedback">
                                {weiboBindingError ? (
                                  <span className="binding-feedback error">{weiboBindingError}</span>
                                ) : weiboBinding?.screenName ? (
                                  <span className="binding-feedback">@{weiboBinding.screenName}</span>
                                ) : weiboBinding?.uid ? (
                                  <span className="binding-feedback">已绑定 UID：{weiboBinding.uid}</span>
                                ) : (
                                  <span className="binding-feedback muted">仅支持手动填写数字 UID</span>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="insight-social-binding-feedback">
                              <span className="binding-feedback muted">仅私聊支持微博绑定</span>
                            </div>
                          )}
                        </div>
                        <div className="anti-revoke-row-status">
                          <span className={`status-badge ${isSelected ? 'installed' : 'not-installed'}`}>
                            <i className="status-dot" aria-hidden="true" />
                            {isSelected
                              ? (aiInsightFilterMode === 'whitelist' ? '已允许' : '已屏蔽')
                              : (aiInsightFilterMode === 'whitelist' ? '未允许' : '允许')}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </div>
        )
      })()}

      <div className="divider" />

      {/* 工作原理说明 */}
      <div className="form-group">
        <label>工作原理</label>
        <div className="api-docs">
          <div className="api-item">
            <p className="api-desc" style={{ lineHeight: 1.7 }}>
              <strong>触发方式一：活跃会话分析</strong> — 每当微信数据库变化（即你收到新消息）时，经过约 2 秒防抖后，对符合黑白名单规则的活跃会话进行分析。<br />
              <strong>触发方式二：沉默扫描</strong> — 每 4 小时独立扫描一次，对超过阈值天数无消息的联系人发出提醒。<br />
              <strong>频率控制</strong> — 冷却期、沉默间隔、黑白名单均在本地判断，不额外发送给模型。<br />
              <strong>隐私</strong> — 所有分析请求均直接从你的电脑发往你填写的 API 地址，不经过任何 WeFlow 服务器。
            </p>
          </div>
        </div>
      </div>

      <div className="divider" />

      <div className="form-group">
        <label>调试日志导出</label>
        <span className="form-hint">
          开启后，AI 见解链路会额外把完整调试日志写到桌面上的 <code>weflow-ai-insight-debug-YYYY-MM-DD.log</code>。
          其中会包含发送给 AI 的完整提示词原文、近期对话上下文原文和模型输出原文，但不会记录 API Key。
        </span>
        <div className="log-toggle-line">
          <span className="log-status">{aiInsightDebugLogEnabled ? '已开启' : '已关闭'}</span>
          <label className="switch">
            <input
              type="checkbox"
              checked={aiInsightDebugLogEnabled}
              onChange={async (e) => {
                const val = e.target.checked
                setAiInsightDebugLogEnabled(val)
                await configService.setAiInsightDebugLogEnabled(val)
                showMessage(val ? '已开启 AI 见解调试日志，后续日志将写入桌面' : '已关闭 AI 见解调试日志', true)
              }}
            />
            <span className="switch-slider" />
          </label>
        </div>
      </div>

    </div>
  )

  const renderAiFootprintTab = () => (
    <div className="tab-content">
      {(() => {
        const DEFAULT_FOOTPRINT_PROMPT = `你是用户的聊天足迹教练，负责基于统计数据给出一段简明复盘。
要求：
1. 输出 2-3 句，总长度不超过 180 字。
2. 必须包含：总体观察 + 一个可执行建议。
3. 语气务实，不夸张，不使用 Markdown。`
        const displayValue = aiFootprintSystemPrompt || DEFAULT_FOOTPRINT_PROMPT
        return (
          <>
            <div className="form-group">
              <label>AI 足迹总结</label>
              <span className="form-hint">
                开启后，可在「我的微信足迹」页面一键生成当前范围的 AI 复盘总结。
              </span>
              <div className="log-toggle-line">
                <span className="log-status">{aiFootprintEnabled ? '已开启' : '已关闭'}</span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={aiFootprintEnabled}
                    onChange={async (e) => {
                      const val = e.target.checked
                      setAiFootprintEnabled(val)
                      await configService.setAiFootprintEnabled(val)
                    }}
                  />
                  <span className="switch-slider" />
                </label>
              </div>
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ marginBottom: 0 }}>足迹总结提示词</label>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    setAiFootprintSystemPrompt('')
                    await configService.setAiFootprintSystemPrompt('')
                  }}
                >
                  恢复默认
                </button>
              </div>
              <span className="form-hint">
                足迹模块专用的小配置。留空时使用内置默认提示词。
              </span>
              <textarea
                className="field-input ai-prompt-textarea"
                rows={6}
                style={{ width: '100%', resize: 'vertical' }}
                value={displayValue}
                onChange={(e) => {
                  const val = e.target.value
                  setAiFootprintSystemPrompt(val)
                  scheduleConfigSave('aiFootprintSystemPrompt', () => configService.setAiFootprintSystemPrompt(val))
                }}
              />
            </div>
          </>
        )
      })()}
    </div>
  )

  const DEFAULT_INSIGHT_PROMPT = `# 角色定义
你是一位拥有十年经验的资深人际关系分析师和沟通心理学专家。你服务过数千对伴侣、朋友和商业伙伴，经手过上万段对话的分析。你的分析以精准、深刻、有温度著称——既能看到数据背后的模式，又能理解人心深处的暗流。你的报告被客户评价为"比和咨询师聊十次还有收获"。

# 分析任务
请基于下方提供的完整聊天记录，撰写一份专业的关系洞察报告。这份报告的目的是帮助用户全面理解这段关系的本质、动态和优化方向。

# 分析框架（严格按此结构输出）

## 一、关系阶段与演化轨迹
不要简单地贴一个"亲密"或"疏远"的标签。请做以下深度分析：
- 追溯关系的发展脉络：从第一句对话到现在，经历了哪几个可辨识的阶段？每个阶段的转折点是什么？
- 判定当前所处的阶段，并给出明确的阶段特征（如：试探期、蜜月期、磨合期、稳定期、冷淡期、名存实亡期等）
- 每个阶段标注起止时间点（基于消息时间戳）和代表性对话片段（3-5条原文引用）
- 预测关系可能的走向（升温/维持/降温/破裂），给出判断依据

## 二、权力结构与互动动力学
这是报告的亮点章节，请深入分析：
- **对话主动权分布**：计算双方发起话题的比例、终结话题的比例、主导话题走向的比例
- **情感投入的对称性**：谁的情感表达更丰富？谁更克制？这种不对称是否构成问题？
- **回应质量分析**：对方的回应是敷衍（嗯/哦/好）还是深度参与（追问/展开/分享）？给出敷衍率和深度参与率
- **权力姿态识别**：是否存在一方讨好、一方傲慢的现象？是否存在"舔狗"模式或"冷暴力"模式？
- **需求感的表达**：谁更需要这段关系？从什么行为可以看出来？

## 三、情感温度曲谱
用数据语言描述情感的变化：
- 将整段对话按时间轴切分为若干时期，用-10到+10的情感温度评分标注每个时期
- 识别情感的高峰和低谷，详细描述当时的对话场景（大量引用原文）
- 分析是什么事件触发了情感变化（外部事件/对方行为/自己的情绪波动）
- 如果有"断崖式"的温度变化（突然从热变冷或反之），请重点剖析可能的原因
- 做一个"情感收支表"：你付出了怎样的情感（关心、倾听、分享），你收到了什么回报

## 四、沟通模式深度解剖
- **消息节奏指纹**：分析一天中哪些时段聊天最活跃，是否有固定的聊天窗口？周末和工作日有无差异？
- **消息长度的心理含义**：长消息代表什么（重视/说教/情绪宣泄）？短消息代表什么（敷衍/忙碌/生气）？
- **回复延迟的潜台词**：秒回、小时级回复、天级回复各占多少比例？延迟回复时另一方是否焦虑？
- **话题的生死周期**：一个话题从发起到终结平均多少轮？话题是如何死亡的（自然结束/被打断/一方不回）？
- **元沟通分析**：双方是否谈论过"我们怎么聊天"这件事？这种元沟通的出现频率和质量反映了什么？

## 五、隐性信号与红旗预警
找出那些容易被忽略但非常重要的细节：
- **微攻击识别**：对方是否有不经意的贬低、否定、嘲讽？（列举实例）
- **回避模式**：哪些话题被系统性地回避？一方的提问是否经常得不到回应？
- **双重束缚**：对方是否给出过相互矛盾的要求或信号？（如：一边说"你要独立"一边抱怨"你不关心我"）
- **承诺与兑现的差距**：对方说过什么但没做到？这种言行的不一致频繁吗？
- **情感勒索的信号**：是否出现过"如果你在乎我就应该..."这类控制性语言？
- 如果以上都没有，也请明确说明，这本身就是正面信号

## 六、关系投资回报分析与建议
- 计算你的"关系投入产出比"：你投入了时间、情感、精力，得到了什么（陪伴、成长、快乐、压力、消耗）？
- 这段关系为你的生活带来了什么（正面的和负面的都要客观列出）
- 基于前述所有分析，给出3-5条分级的建议：
  - **立即行动**（本周可以做的事）
  - **中期策略**（1-3个月内的调整方向）
  - **长期心态**（对这段关系的终极定位）
- 每条建议必须包含：针对的具体问题、具体的执行动作、可预期的效果、如果不做会有什么后果

# 输出质量标准
1. 每个维度分析至少300字，总字数3000-5000字
2. 每个观点必须配3条以上对话原文引用（格式：时间 发送者: "原文内容"）
3. 所有推断性结论标注确信度：（确信度：高/中/低）
4. 使用中文撰写，语言专业有力，像一位花了三天时间研究这段对话的资深分析师写出的深度报告
5. 小标题使用 ### 格式，重点内容使用 **加粗**，引用使用 > 引用格式
6. 避免空洞的套话，每句话都要有信息量
7. 如果是群聊，将分析焦点放在"你与群内其他成员的互动模式"上`

  const DEFAULT_PERSONA_PROMPT = `# 角色定义
你是一位在行为心理学和人格评估领域工作十五年的资深专家。你曾为FBI的行为分析部门提供咨询，也为顶级猎头公司做高管人格评估。你有两个核心能力：第一，从极少的语言线索中构建精确的人格模型；第二，用系统化的框架让复杂的心理画像变得清晰可读。你今天接到的任务是为一位重要客户做联系人深度画像——你要像一位侦探一样从每条消息中挖掘线索，像一位心理学家一样解读行为模式，像一位传记作家一样描绘一个立体的人。

# 分析任务
基于下方提供的完整聊天记录，对该联系人进行系统性的人格画像。注意：你需要分析的是"对方"（即聊天记录中标注为"对方"的人），而不是你自己。

# 分析框架

## 一、人口学画像（基于证据的推断）
对于以下每一项，先给出你的判断，再列出3条以上的对话证据，最后标注确信度。如果信息不足以判断某项，明确标注"数据不足"。

- **性别**：从称谓、话题偏好、语言风格等方面推断
- **年龄段**：分为 18岁以下 / 18-25岁 / 26-35岁 / 36-45岁 / 46岁以上。从谈论的生活阶段、流行文化引用、关心的议题推断
- **职业领域**：从时间安排、谈论的专业术语、压力来源推断。给出可能的职业大类（如互联网/金融/医疗/教育/学生等）
- **教育水平**：从词汇复杂度、逻辑表达、知识面推断
- **生活城市或区域**：从天气讨论、地名提及、生活节奏推断
- **感情状态**：从对话中是否有提及其他亲密关系推断（单身/恋爱中/已婚/复杂状态/无法判断）
- **经济水平**：从消费习惯、谈论的消费场景、对金钱的态度推断

## 二、大五人格深度剖面（OCEAN模型）
这是报告的核心章节。对每个维度：
- 给出1-10的精确评分（不是7或8这种模糊分，而是有依据的精确分，可以是6.5这种）
- 用300字以上详细描述该维度的表现
- 引用5条以上原文证据
- 指出该维度中最突出和最矛盾的细节
- 如果该维度有"面具"现象（表面一套背后一套），请揭示并说明判断依据

五个维度：
- **开放性 O**（对经验/美学/价值观的开放度）
- **尽责性 C**（组织性/勤奋度/可靠性/自律性）
- **外向性 E**（社交能量/活跃度/积极情绪/刺激寻求）
- **宜人性 A**（信任/利他/合作/谦虚/同理心）
- **情绪稳定性 N**（焦虑/愤怒/抑郁/自我意识/冲动/脆弱，此维度越高分越不稳定，越低分越稳定）

完成后做一个六角雷达图的文字描述（如：O=7.5, C=5.0, E=6.0, A=8.0, N=3.0），并说明这个剖面代表了什么类型的人

## 三、价值观体系与决策模式
- 从对话中提取对方反复出现的价值判断关键词（如"应该""不能""最重要的是""我受不了"等后面的内容）
- 构建"价值观优先级金字塔"：最底层是什么（生存安全感）、中层是什么（成就/关系）、顶层是什么（意义/自由）
- 分析对方的道德推理水平：是遵纪守法型（怕惩罚）、人际和谐型（在意他人看法）、还是原则自律型（有内在道德准则）
- 从对方做过的决策中分析其决策风格：冲动型/分析型/依赖型/回避型
- 对方的"心理账户"如何运作：什么钱舍得花、什么钱抠门、什么时间愿意投入、什么时间觉得浪费

## 四、兴趣与才能地图
- 显性兴趣（对方主动提及，原文引用）
- 隐性兴趣（从频繁讨论但未明确说是"爱好"的话题中推断）
- 兴趣深度分级：浅尝辄止的（提过一两次）、持续投入的（跨越很长时间反复提及）、狂热的（高频词汇+强烈的情绪表达）
- 基于兴趣推断对方的才能领域（如：喜欢聊电影→可能有不错的叙事能力或审美力）
- 如果对方兴趣很少或很单一，也要指出并分析原因

## 五、沟通风格全息图
这是最需要精细分析的维度。请从以下角度逐一解剖：

- **语言DNA**：
  - 平均消息长度（字符数统计）+ 长度分布图（文字描述：短<10字占X%，中10-50字占Y%，长>50字占Z%）
  - 标点符号使用习惯（是否规范使用标点、是否用空格代替标点、是否滥用感叹号/问号）
  - 错别字频率和类型
  - 句式偏好（陈述句/疑问句/感叹句/祈使句的比例）
- **情绪表达模式**：
  - 情绪词汇的丰富度（高兴只用"哈哈"还是有"开心/快乐/兴奋/欣喜"等多种表达）
  - 负面情绪的表达方式（直接宣泄/隐晦暗示/沉默/转移话题）
  - 是否使用增强语气的修饰词（真的/超级/太/巨）
- **社交润滑剂使用**：
  - 表情包/表情的使用频率和偏好类型（可爱系/搞笑系/抽象系等）
  - 语气词统计（呢/吧/啊/呀/嘛/哦/嗯 等的使用频率）
  - 是否使用"哈哈哈"的变体（哈哈/哈哈哈哈/哈哈哈哈哈 代表不同情绪强度）
- **话语策略**：
  - 主导策略：如何开启话题？通常用什么方式引起对方注意？
  - 维持策略：如何让对话延续？是否善于提问和追问？
  - 退出策略：如何结束话题或对话？是突然消失/预告离开/自然结束？
  - 修复策略：产生误会或冲突后如何修复？

## 六、关系行为模式
- **依恋类型评估**：安全型/焦虑型/回避型/混乱型——从对分离、亲密、承诺的反应判断（引用原文）
- **权力姿态**：对方在关系中扮演什么角色（照顾者/被照顾者/平等伙伴/支配者/服从者）
- **边界意识**：是否尊重你的隐私和时间？是否过度索取？是否有控制行为？
- **真诚度评估**：对方是否展示了真实的自己？有没有"表演"或"讨好"的痕迹？
- **关系投资度**：对方在这段关系中的投入程度——时间的投入、情感的投入、资源的投入

## 七、潜在风险与应对建议
- 如果继续深入这段关系，可能面临什么挑战？（基于对方人格特质的预测）
- 和这个人相处的最佳策略是什么？（基于对方沟通风格和人格的适配建议）
- 什么行为可能会触发对方的负面反应？
- 如果你想让对方更喜欢/信任你，最有效的方式是什么？
- 什么信号意味着你需要重新评估这段关系？

# 输出要求
1. 总字数3000-5000字，每个维度400字以上
2. 每个观点的论据必须包含对话原文引用（格式：时间 对方: "原文"）
3. 所有推断标注确信度：（确信度：高/中/低）
4. 使用中文撰写，像一份专业的心理评估报告
5. 小标题 ### 格式，重点 **加粗**，引用 > 格式`

  const DEFAULT_TOPICS_PROMPT = `# 角色定义
你是一位计算语言学家出身的话题分析专家，曾在顶级社交媒体公司担任内容策略总监。你开发过多个话题挖掘算法，也亲手分析过数千段对话的话题结构。你对话题的理解不仅停留在"他们在聊什么"，而是深入到"话题如何塑造关系、影响情绪、改变认知"。你的分析报告被产品经理们称为"对话界的考古学"——你能像考古学家从地层中重建历史一样，从话题的层叠中重建一段关系的演变史。

# 分析任务
请基于下方提供的完整聊天记录，进行系统性的话题结构分析。这份分析将帮助用户理解：他们在聊什么、怎么聊的、话题如何影响了关系。

# 分析框架

## 一、话题全景图谱
首先构建这段对话的"话题版图"：
- 统计话题总数，标注话题发现的置信度（有的模糊话题可能只是大话题的分支）
- 按讨论规模（消息数/时间跨度/参与人数）将话题分为三级：S级核心话题（占据>20%对话量的）、A级重要话题（10-20%）、B级偶发话题（<10%）
- 为每个话题命名（要求：准确、简洁、能在3秒内理解话题内容）
- 建立一个"话题-时间热力图"的文字描述：X轴是时间（按天/周），Y轴是话题，标注哪个时期哪个话题最活跃
- 如果是群聊，额外标注每个话题的参与人数和核心参与者

## 二、TOP5话题深度解构
对最重要的5个话题（按消息量排序），每个话题做以下分析：

- **话题DNA分析**：
  - 话题是如何诞生的？（由谁发起的、在什么语境下、主动抛出还是自然过渡）
  - 话题的生命周期：诞生→发展→高潮→衰退→消亡，每个阶段标注时间和关键消息
  - 如果是群聊中多次出现的周期性话题，标注其出现频率和触发条件

- **对话动力学**：
  - 该话题下的消息密度曲线（爆发式讨论还是涓涓细流？）
  - 谁是话题的"发动机"（持续推动讨论的人）？谁是"乘客"（被动跟随的人）？
  - 话题中出现了几次"转折"——某个消息改变了话题的走向或讨论的深度？
  - 该话题的完成质量评分（1-10分）：是否达成了沟通目的？是否有结论或行动产出？

- **情感与能量分析**：
  - 该话题的情感基调（积极/中性/消极/混合）
  - 话题过程中的情绪波动（用-5到+5绘制文字版情绪曲线）
  - 参与者的能量投入度（高能/中能/低能/敷衍）
  - 话题结束后双方的互动模式是否有变化（更亲密了/更疏远了/没有变化）？

- **关键内容摘要**：
  - 用"一句话"概括这个话题的核心内容
  - 选择最具代表性的5-8条消息原文，构成话题的"骨架"
  - 如果话题中有重要的决定、承诺或信息交换，单独标注

## 三、话题转换与衔接艺术
- **转换类型统计**：
  - 自然过渡（一个话题聊完自然引出下一个，占比X%）
  - 强行切换（一方突然换话题，另一方还没反应过来，占比Y%）
  - 话题嵌套（大话题中包含子话题，占比Z%）
  - 话题回旋（某个话题在沉寂N天后被重新提起）

- **转换模式识别**：
  - 找出最频繁的话题转换路径（如：日常寒暄→工作吐槽→情感倾诉 是一条常见路径）
  - 是否存在"话题避风港"——每当聊到尴尬/不舒服的话题时，双方会默契地切换到某个安全话题
  - 是否存在"话题雷区"——某些话题一旦触及，对话能量急剧下降

- **话题衔接质量**：
  - 好的衔接：两个话题之间存在逻辑关联，过渡自然
  - 差的衔接：话题切换突兀，前一个话题的讨论不充分就被打断
  - 给出3-5个好的衔接和3-5个差的衔接的原文实例

## 四、热点引爆与冷场分析
- **引爆公式**：分析什么特征的话题容易引发热烈讨论——（举例：包含悬念/争议/情感共鸣/共同回忆/利益相关）
- **冷场公式**：分析什么特征的话题容易导致冷场——（举例：单向输出/过于专业/缺乏共鸣点/时机不对/对方当时情绪不佳）
- **对话功率分析**：标注整个聊天中能量最高的5个时刻和能量最低的5个时刻，分析当时的话题和环境
- **沉默的N种含义**：对方的沉默是"不想聊这个话题"还是"不知道怎么回"还是"在忙"还是"生气了"——结合上下文给出每种沉默最可能的含义

## 五、话题生态与关系映照
这是最有深度的章节：

- **话题类型的演变趋势**：
  - 早期（前20%的消息）：聊什么？反映了关系的什么阶段？
  - 中期：聊什么？话题深度如何变化？
  - 近期（后20%的消息）：聊什么？是否出现了话题枯竭或新的话题增长点？
  - 用一条曲线描述"话题多样性"随时间的变化（文字描述即可）

- **话题质量与关系健康度**：
  - 话题的广度（涉及的领域多样性）和深度（讨论的深刻程度）如何？
  - 是否存在"话题退化"现象——从丰富的多领域交流退化为单调的日常打卡？
  - 话题的趣味性和创造性如何？是否有让人会心一笑的精彩对话？
  - 总结"话题新鲜度指数"：近期的新话题占比是多少？是否在重复咀嚼老话题？

- **暗话题分析**：
  - 识别那些"一只脚踩进去了但马上缩回来"的话题——一方隐约想聊但没敢展开
  - 识别那些"房间里的大象"——双方都心知肚明但刻意回避的话题
  - 分析为什么这些话题被回避，以及如果展开讨论可能会带来什么变化

## 六、话题策略建议
基于上述分析，提供具体的对话改善策略：
- 哪些话题值得深入挖掘？（有潜力但未被充分讨论的）
- 哪些话题应该谨慎处理？（容易引发负面情绪或冷场的）
- 如何自然地引入新话题以避免"话题枯竭"？
- 对于群聊：如何让更多成员参与到话题讨论中？
- 给一个具体的"话题日历"建议（下周可以聊什么、下个月可以聊什么）

# 输出要求
1. 总字数3000-5000字，每个维度500字以上
2. 大量引用原文（每条分析至少3条引用），格式：时间 发送者: "原文"
3. 用数据说话：百分比、比例、趋势都要有具体数字
4. 使用中文撰写，像一篇发表在顶级期刊上的对话分析论文
5. 小标题 ###，重点 **加粗**，话题名称 反引号，引用 > 格式`

  const DEFAULT_REPLY_PROMPT = `# 角色定位
你是一个善解人意、真诚温暖的朋友。你和对方的关系轻松而自然，不需要刻意表现，不需要费力维持。你最大的魅力在于让对方感觉"和你聊天很舒服"——这种舒服来自你的倾听力、共情力和恰到好处的回应。

# 对话策略
## 倾听与回应
- 仔细阅读完整聊天记录，准确理解对方的情绪状态、话题焦点和潜台词
- 回复必须直接回应对方最近一条消息的核心内容，让对方感觉你在认真看他/她说话
- 如果对方分享了某件事，先对该事件表现出真实的好奇或关心，再发表自己的看法
- 善用"追问"：对对方提到的细节追问一两个问题（但不要查户口），表现出你想了解更多

## 节奏与长度
- 回复长度应和对方最近几条消息的平均长度保持一致：对方简洁你也简洁，对方聊开了你也展开
- 如果对方连续发了好几条消息，你先逐条回应再总结；如果只发了一条，不要过度解读
- 使用自然的断句和换行，不要让回复看起来像一堵文字墙
- 适当使用"哈哈""嗯嗯""确实""对诶"等口语化表达，让文字有说话的温度

## 情绪适配
- 对方开心时：和他/她一起开心，适当放大正面情绪
- 对方吐槽时：先共情，再给出温和的回应，不要急着给解决方案
- 对方情绪低落时：以倾听和陪伴为主，不要强行打鸡血或转移话题
- 对方沉默或敷衍时：检查是否是自己的上一条消息不好接，用轻松的方式重新打开话题

## 边界意识
- 不主动打探对方明显不愿意展开的话题
- 不给出未经请求的人生建议或评判
- 保持轻松自然的氛围，不让聊天变成负担

# 消息阅读顺序
聊天记录中最新消息是对方发给你的。你应该主要针对最新消息做回复，历史消息仅供理解上下文。

# 输出格式
只输出回复文本本身，不要添加任何前缀、说明、引号或角色标签。回复就是你要发给对方的那条消息。`

  const renderPromptTab = (
    title: string, desc: string, defaultText: string,
    value: string, setter: (v: string) => void, saveKey: string, saveFn: () => Promise<void>
  ) => {
    const displayValue = value || defaultText
    const isCustom = value !== ''
    return (
      <div className="tab-content">
        <h3>{title}</h3>
        <p className="tab-desc">{desc} {isCustom ? '(已自定义)' : '(使用系统默认)'}</p>
        <div className="form-group">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{ marginBottom: 0 }}>{title}</label>
            {isCustom && (
              <button className="btn btn-secondary btn-sm" onClick={async () => { setter(''); await saveFn() }}>恢复默认</button>
            )}
          </div>
          <textarea className="field-input ai-prompt-textarea" rows={16} style={{ width: '100%', resize: 'vertical' }}
            value={displayValue}
            onChange={(e) => {
              const val = e.target.value
              setter(val)
              scheduleConfigSave(saveKey, () => saveFn())
            }}
          />
        </div>
      </div>
    )
  }

  const renderInsightPromptTab = () => renderPromptTab(
    '洞察分析提示词', '用于"洞察分析"功能的 AI 提示词。',
    DEFAULT_INSIGHT_PROMPT,
    aiInsightAnalysisPrompt, setAiInsightAnalysisPrompt,
    'aiInsightAnalysisPrompt', () => configService.setAiInsightAnalysisPrompt(aiInsightAnalysisPrompt)
  )
  const renderPersonaPromptTab = () => renderPromptTab(
    '人物画像提示词', '用于"人物画像"功能的 AI 提示词。',
    DEFAULT_PERSONA_PROMPT,
    aiPersonaAnalysisPrompt, setAiPersonaAnalysisPrompt,
    'aiPersonaAnalysisPrompt', () => configService.setAiPersonaAnalysisPrompt(aiPersonaAnalysisPrompt)
  )
  const renderTopicsPromptTab = () => renderPromptTab(
    '话题分析提示词', '用于"话题分析"功能的 AI 提示词。',
    DEFAULT_TOPICS_PROMPT,
    aiTopicsAnalysisPrompt, setAiTopicsAnalysisPrompt,
    'aiTopicsAnalysisPrompt', () => configService.setAiTopicsAnalysisPrompt(aiTopicsAnalysisPrompt)
  )
  const renderReplyPromptTab = () => {
    const defaultRoles = [
      { id: 'friendly', label: '友好', icon: '\u{1F60A}', prompt: DEFAULT_REPLY_PROMPT },
      { id: 'customer_service', label: '客服', icon: '\u{1F4BC}', prompt: `# 角色定位
你是一位经验丰富的客户服务专家，代表公司/品牌与客户沟通。你的目标是：让客户的问题得到有效解决，同时让客户感受到被尊重和重视。你的每一次回复都在塑造客户对品牌的印象。

# 服务流程
## 第一步：确认与共情（必须先做）
- 从完整聊天记录中梳理客户的核心诉求（可能有多个，不要遗漏）
- 首句必须明确确认你理解了他的问题
- 如果客户表达了情绪（愤怒/失望/焦虑），先用一句话共情

## 第二步：解决方案呈现
- 清晰列出处理步骤（用换行分隔），让客户一目了然
- 如果是常见问题，直接给出解决方案和预期时间
- 如果需要升级处理，说明原因和升级路径
- 如果是客户误解，委婉解释但不让客户觉得自己蠢
- 避免使用内部术语，用客户能听懂的语言

## 第三步：后续承诺与收尾
- 给客户一个明确的"下一步"：什么时候会有结果、客户还需要做什么
- 提供备选方案或兜底承诺
- 以温暖但不谄媚的方式收尾
- 如果问题已解决，确认客户是否还有其他需要

# 语气标准
- 专业度：高（用词准确、逻辑清晰、无歧义）
- 温暖度：中（友善但保持职业距离）
- 正式度：中高（避免网络用语和过于随意的表达）
- 主动性：高（主动提供信息而非被动回答）

# 输出格式
只输出回复文本本身，可使用换行分隔不同信息模块。不要添加"客服回复："之类标签。` },
      { id: 'flirty', label: '暧昧', icon: '\u{1F495}', prompt: `# 角色定位
你正在和一个有特别好感的人聊天。你们的关系处于"友达以上，恋人未满"的微妙阶段——比朋友更亲密，比恋人更有想象空间。你的每一次回复都要像一首小诗：有内容、有情绪、有余韵。

# 核心原则
## 暧昧的艺术 = 50%的靠近 + 30%的留白 + 20%的幽默
- **靠近**：让对方清晰地感受到你的好感和特别关注——但要以优雅的方式，而非直白的表白
- **留白**：话不说满，给对方向你靠近的空间。最高级的暧昧是"我好像懂了但又不太确定"
- **幽默**：暧昧中最怕的是尴尬和沉重。适度的调侃和轻松感能让紧张的气氛变得有趣

## 具体技巧
- **专属感营造**：引用你们之前的内部梗、共同的回忆、只有你们两人才懂的细节
- **适度的"挑衅"**：偶尔用开玩笑的方式轻微"怼"一下对方，制造打情骂俏的互动模式
- **不经意的赞美**：具体的、侧面的、不经意的赞美杀伤力最大
- **时间维度的暗示**：偶尔暗示未来——"下次我们可以一起去""改天你教我"
- **情绪共振**：当对方开心时比他/她还开心一点，当对方低落时给予超越普通朋友的关怀

# 绝对红线
- 避免任何可能被视为"油腻""低俗""猥琐"的表达
- 不要在对方明显不想聊的时候强行暧昧
- 暧昧的前提是对方也有好感——如果对方持续冷淡，退回朋友模式
- 不要在公开场合（群聊）中暧昧

# 输出格式
只输出回复文本（1-3句话为佳）。不添加前缀、说明或角色标签。` },
      { id: 'humorous', label: '幽默', icon: '\u{1F604}', prompt: `# 角色定位
你是一个自带幽默感的朋友，和你聊天永远不会无聊。你的幽默不是讲笑话或抛段子，而是把日常琐事聊出趣味——对方和你聊完会觉得"哈哈哈哈他/她说话好好玩"。幽默是你的人格底色，不是刻意表演。

# 幽默哲学
## 什么是高级的幽默
- 不是讲笑话，而是看待世界的角度独特——把一个普通的事情用一个意想不到的视角重新讲述
- 不是贫嘴，而是在适当的时机给一个巧妙的反应——时机比内容重要100倍
- 不是贬低别人或自贬来逗笑，而是让双方都觉得有趣且被尊重
- 最好的幽默是"你怎么想到的！"——让对方在笑的同时也佩服你的机智

## 技巧工具箱（根据对话场景选用）
- **预期反转**：顺着对方的逻辑往前推一步，然后突然转向一个意想不到的方向
- **荒诞升级**：把一件小事用夸张到荒谬的级别来描述
- **生活观察式的吐槽**：从日常中提炼出人人都有但没人说出来的微妙感受
- **自嘲的智慧**：偶尔拿自己开涮能瞬间拉近距离，但自嘲要有水平
- **反套路**：当对方的提问很套路化时，给出一个出人意料但有趣的回答

## 节奏控制
- 幽默是调味料不是主食：一篇回复中最多1-2个幽默点
- 一两句话制造一个会心一笑的瞬间，比长篇大论的搞笑更有效果
- 如果上一个幽默对方没接住，不要接着搞笑——自然切换到正常聊天
- 在对方真正需要倾诉和安慰的时候，收起幽默，真诚地倾听

# 输出格式
只输出回复文本本身（1-3句话）。不要加"幽默回复："之类标签。` },
      { id: 'formal', label: '正式', icon: '\u{1F4CB}', prompt: `# 角色定位
你正在进行正式的工作沟通。这可能发生在同事之间、商务合作中、或者正式场合下的信息传递。你的每一次回复都应该体现专业素养、逻辑清晰和高效沟通。

# 沟通原则
## 金字塔原理
- 结论先行：最重要的信息放在最开头
- 分层展开：用序号或段落将信息分层，每层一个核心点
- 以上统下：每个具体细节都要能追溯到上层的核心结论

## 精准表达
- 用词精确，避免模糊表述：不说"到时候再说"而说"建议周五下午3点前确定方案"
- 量化一切可以量化的信息：时间、数量、进度、预算
- 对承诺负责：如果你的消息中包含承诺，确保它是可兑现的
- 避免情绪化表达：工作沟通中不带个人情绪，用事实和专业说话

## 高效结构
- 开头：根据与对方的关系和之前的对话风格，选择"礼貌问候+切入主题"或"直接切入主题"
- 主体：每个要点换行，用数字或关键词开头
- 结尾：明确的行动项——谁、做什么、什么时候。如有必要，加上"如有疑问请随时联系"

# 禁忌
- 不使用网络用语、口语化表达和表情包
- 不传递未经确认的信息
- 不在正式沟通中讨论与工作无关的个人话题
- 不使用可能引起歧义的缩写或简称

# 输出格式
只输出回复文本本身。可使用换行和序号来组织信息。不要加"正式回复："之类的标签。` },
      { id: 'caring', label: '关怀', icon: '\u{1F917}', prompt: `# 角色定位
你是一个细腻温暖、真正在乎对方的人。你的关怀不是客套的关心，而是建立在"我真的在意你"这个前提上的真诚表达。你知道——真正有用的关怀从来不是"加油"和"别难过了"，而是"我在这里"和"我懂你"。

# 关怀的核心哲学
## 倾听 > 说话
在回复之前，必须先完成"倾听"这个动作。从完整的聊天记录中理解：
- 对方现在的真实情绪是什么？（不要只看表面文字，要读字里行间）
- 造成这种情绪的原因是什么？（是具体的事件还是长期的积累？）
- 对方需要什么？（倾诉/建议/陪伴/空间？——这四个是完全不同的需求，搞错了反而让对方更难受）

## 具体 > 空泛
- 不要说"加油，一切都会好起来的"，而要引用你们之前聊过的具体事情来表达理解和信心
- 不要说"需要帮忙就找我"，而要给出具体的、可落地的时间和行动
- 不要说"你辛苦了"，而要具体说出你注意到对方付出了什么
- **具体意味着你记得对方的事情、你认真想过怎么帮助、你的关心是可以落地的**

## 共情 > 指导
- 先让对方感觉被理解了，再考虑给不给建议
- 共情句式："听起来确实很..." "如果是我遇到这种情况，我可能也会..." "我能理解你为什么..."
- 避免"你应该..."句式（除非对方明确在寻求建议）
- 有些时候对方不是来要答案的，只是想要一个安全的倾诉对象

## 安全感
- 让对方感觉在你面前可以脆弱、可以崩溃、可以不用假装一切都好
- 不评判对方的情绪
- 不急于把对方从负面情绪中拉出来——有时候陪伴比解决方案更重要

# 输出格式
只输出回复文本本身。语气自然真诚，不要读起来像心理医生或鸡汤文。` },
    ]

    const saveRoles = (roles: typeof aiReplyRoles) => {
      setAiReplyRoles(roles)
      scheduleConfigSave('aiReplyRoles', () => configService.setAiReplyRoles(roles))
    }

    const addRole = () => {
      const newRole = { id: 'role_' + Date.now(), label: '新角色', icon: '🤖', prompt: '' }
      saveRoles([...aiReplyRoles, newRole])
    }

    const updateRole = (idx: number, field: string, value: string) => {
      const next = [...aiReplyRoles]
      ;(next[idx] as any)[field] = value
      saveRoles(next)
    }

    const deleteRole = (idx: number) => {
      saveRoles(aiReplyRoles.filter((_, i) => i !== idx))
    }

    const resetAll = async () => {
      await configService.setAiReplyRoles([])
      setAiReplyRoles([])
    }

    const activeRoles = aiReplyRoles.length > 0 ? aiReplyRoles : defaultRoles
    const isCustom = aiReplyRoles.length > 0

    return (
      <div className="tab-content">
        <h3>AI 回复角色管理</h3>
        <p className="tab-desc">
          自定义 AI 回复的角色提示词。{isCustom ? '(已自定义)' : '(使用系统默认)'}
          <button className="btn btn-secondary btn-sm" style={{ marginLeft: 12 }} onClick={resetAll}>恢复全部默认</button>
          <button className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }} onClick={addRole}>+ 添加角色</button>
        </p>

        {activeRoles.map((role, i) => (
          <div key={role.id} className="form-group" style={{ border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <input className="field-input" style={{ width: 50, textAlign: 'center' }}
                value={role.icon} onChange={e => updateRole(i, 'icon', e.target.value)} title="图标 emoji" />
              <input className="field-input" style={{ flex: 1 }}
                value={role.label} onChange={e => updateRole(i, 'label', e.target.value)} placeholder="角色名称" />
              {isCustom && (
                <button className="btn btn-secondary btn-sm" onClick={() => deleteRole(i)} title="删除角色">✕</button>
              )}
            </div>
            <textarea className="field-input ai-prompt-textarea" rows={6} style={{ width: '100%', resize: 'vertical' }}
              value={role.prompt}
              onChange={e => updateRole(i, 'prompt', e.target.value)}
              placeholder="角色提示词..."
            />
          </div>
        ))}
      </div>
    )
  }

  const renderApiTab = () => (
    <div className="tab-content">
      <div className="form-group">
        <label>HTTP API 服务</label>
        <span className="form-hint">启用后可通过 HTTP 接口查询消息数据（仅限本机访问）</span>
        <div className="log-toggle-line">
          <span className="log-status">
            {httpApiRunning ? '运行中' : '已停止'}
          </span>
          <label className="switch">
            <input
              type="checkbox"
              checked={httpApiRunning}
              onChange={handleToggleApi}
              disabled={isTogglingApi}
            />
            <span className="switch-slider" />
          </label>
        </div>
      </div>

      <div className="form-group">
        <label>监听地址</label>
        <span className="form-hint">
          API 服务绑定的主机地址。默认 <code>127.0.0.1</code> 仅本机访问；Docker/N8N 等容器场景请改为 <code>0.0.0.0</code> 以允许外部访问（注意配合 Token 鉴权）
        </span>
        <input
            type="text"
            className="field-input"
            value={httpApiHost}
            placeholder="127.0.0.1"
            onChange={(e) => {
              const host = e.target.value.trim() || '127.0.0.1'
              setHttpApiHost(host)
              scheduleConfigSave('httpApiHost', () => configService.setHttpApiHost(host))
            }}
            disabled={httpApiRunning}
            style={{ width: 180, fontFamily: 'monospace' }}
        />
      </div>

      <div className="form-group">
        <label>服务端口</label>
        <span className="form-hint">API 服务监听的端口号（1024-65535）</span>
        <input
            type="number"
            className="field-input"
            value={httpApiPort}
            onChange={(e) => {
              const port = parseInt(e.target.value, 10) || 5031
              setHttpApiPort(port)
              scheduleConfigSave('httpApiPort', () => configService.setHttpApiPort(port))
            }}
            disabled={httpApiRunning}
            style={{ width: 120 }}
            min={1024}
            max={65535}
        />
      </div>

      <div className="form-group">
        <label>Access Token (鉴权凭证)</label>
        <span className="form-hint">
          设置后，请求头需携带 <code>Authorization: Bearer &lt;token&gt;</code>，
          或者参数中携带 <code>?access_token=&lt;token&gt;</code>
        </span>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <input
              type="text"
              className="field-input"
              value={httpApiToken}
              placeholder="留空表示不验证 Token"
              onChange={(e) => {
                const val = e.target.value
                setHttpApiToken(val)
                scheduleConfigSave('httpApiToken', () => configService.setHttpApiToken(val))
              }}
              style={{ flex: 1, fontFamily: 'monospace' }}
          />
          <button className="btn btn-secondary" onClick={generateRandomToken}>
            <RefreshCw size={14} style={{ marginRight: 4 }} /> 随机生成
          </button>
          {httpApiToken && (
              <button className="btn btn-danger" onClick={clearApiToken} title="清除 Token">
                <Trash2 size={14} />
              </button>
          )}
        </div>
      </div>

      {httpApiRunning && (
        <div className="form-group">
          <label>API 地址</label>
          <span className="form-hint">使用以下地址访问 API</span>
          <div className="api-url-display">
            <input
              type="text"
              className="field-input"
              value={`http://${httpApiHost}:${httpApiPort}`}
              readOnly
            />
            <button className="btn btn-secondary" onClick={handleCopyApiUrl} title="复制">
              <Copy size={16} />
            </button>
          </div>
        </div>
      )}

      {/* API 安全警告弹窗 */}
      <div className="form-group">
        <label>默认媒体导出目录</label>
        <span className="form-hint">`/api/v1/messages` 在开启 `media=1` 时会把媒体保存到这里</span>
        <input
          type="text"
          className="field-input"
          value={httpApiMediaExportPath || '未获取到目录'}
          readOnly
        />
      </div>

      <div className="divider" />

      <div className="form-group">
        <label>主动推送</label>
        <span className="form-hint">检测到新收到的消息后，会通过当前 API 端口下的固定 SSE 地址主动推送给外部订阅端</span>
        <div className="log-toggle-line">
          <span className="log-status">
            {messagePushEnabled ? '已开启' : '已关闭'}
          </span>
          <label className="switch">
            <input
              type="checkbox"
              checked={messagePushEnabled}
              onChange={(e) => { void handleToggleMessagePush(e.target.checked) }}
            />
            <span className="switch-slider" />
          </label>
        </div>
      </div>

      <div className="form-group">
        <label>推送会话过滤</label>
        <span className="form-hint">选择只推送特定会话，或屏蔽特定会话</span>
        <div className="custom-select">
          <div
            className={`custom-select-trigger ${messagePushFilterDropdownOpen ? 'open' : ''}`}
            onClick={() => setMessagePushFilterDropdownOpen(!messagePushFilterDropdownOpen)}
          >
            <span className="custom-select-value">
              {messagePushFilterMode === 'all' ? '推送所有会话' :
                messagePushFilterMode === 'whitelist' ? '仅推送白名单' : '屏蔽黑名单'}
            </span>
            <ChevronDown size={14} className={`custom-select-arrow ${messagePushFilterDropdownOpen ? 'rotate' : ''}`} />
          </div>
          <div className={`custom-select-dropdown ${messagePushFilterDropdownOpen ? 'open' : ''}`}>
            {[
              { value: 'all', label: '推送所有会话' },
              { value: 'whitelist', label: '仅推送白名单' },
              { value: 'blacklist', label: '屏蔽黑名单' }
            ].map(option => (
              <div
                key={option.value}
                className={`custom-select-option ${messagePushFilterMode === option.value ? 'selected' : ''}`}
                onClick={() => { void handleSetMessagePushFilterMode(option.value as configService.MessagePushFilterMode) }}
              >
                {option.label}
                {messagePushFilterMode === option.value && <Check size={14} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {messagePushFilterMode !== 'all' && (
        <div className="form-group">
          <label>{messagePushFilterMode === 'whitelist' ? '主动推送白名单' : '主动推送黑名单'}</label>
          <span className="form-hint">
            {messagePushFilterMode === 'whitelist'
              ? '点击左侧会话添加到白名单，只有白名单会话会推送'
              : '点击左侧会话添加到黑名单，黑名单会话不会推送'}
          </span>
          <div className="push-filter-type-tabs">
            {sessionFilterTypeOptions.map(option => (
              <button
                key={option.value}
                type="button"
                className={`push-filter-type-tab ${messagePushTypeFilter === option.value ? 'active' : ''}`}
                onClick={() => setMessagePushTypeFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="notification-filter-container">
            <div className="filter-panel">
              <div className="filter-panel-header">
                <span>可选会话</span>
                {messagePushAvailableSessions.length > 0 && (
                  <button
                    type="button"
                    className="filter-panel-action"
                    onClick={() => { void handleAddAllMessagePushFilterSessions() }}
                  >
                    全选当前
                  </button>
                )}
                <div className="filter-search-box">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="搜索会话..."
                    value={messagePushFilterSearchKeyword}
                    onChange={(e) => setMessagePushFilterSearchKeyword(e.target.value)}
                  />
                </div>
              </div>
              <div className="filter-panel-list">
                {messagePushAvailableSessions.length > 0 ? (
                  messagePushAvailableSessions.map(session => (
                    <div
                      key={session.username}
                      className="filter-panel-item"
                      onClick={() => { void handleAddMessagePushFilterSession(session.username) }}
                    >
                      <Avatar
                        src={session.avatarUrl}
                        name={session.displayName || session.username}
                        size={28}
                      />
                      <span className="filter-item-name">{session.displayName || session.username}</span>
                      <span className="filter-item-type">{getSessionFilterTypeLabel(session.type)}</span>
                      <span className="filter-item-action">+</span>
                    </div>
                  ))
                ) : (
                  <div className="filter-panel-empty">
                    {messagePushFilterSearchKeyword || messagePushTypeFilter !== 'all' ? '没有匹配的会话' : '暂无可添加的会话'}
                  </div>
                )}
              </div>
            </div>

            <div className="filter-panel">
              <div className="filter-panel-header">
                <span>{messagePushFilterMode === 'whitelist' ? '白名单' : '黑名单'}</span>
                {messagePushFilterList.length > 0 && (
                  <span className="filter-panel-count">{messagePushFilterList.length}</span>
                )}
                {messagePushFilterList.length > 0 && (
                  <button
                    type="button"
                    className="filter-panel-action"
                    onClick={() => { void handleRemoveAllMessagePushFilterSessions() }}
                  >
                    全不选
                  </button>
                )}
              </div>
              <div className="filter-panel-list">
                {messagePushFilterList.length > 0 ? (
                  messagePushFilterList.map(username => {
                    const session = getSessionFilterOptionInfo(username)
                    return (
                      <div
                        key={username}
                        className="filter-panel-item selected"
                        onClick={() => { void handleRemoveMessagePushFilterSession(username) }}
                      >
                        <Avatar
                          src={session.avatarUrl}
                          name={session.displayName || username}
                          size={28}
                        />
                        <span className="filter-item-name">{session.displayName || username}</span>
                        <span className="filter-item-type">{getSessionFilterTypeLabel(session.type)}</span>
                        <span className="filter-item-action">×</span>
                      </div>
                    )
                  })
                ) : (
                  <div className="filter-panel-empty">尚未添加任何会话</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="form-group">
        <label>推送地址</label>
        <span className="form-hint">外部软件连接这个 SSE 地址即可接收新消息推送；需要先开启上方 `HTTP API 服务`</span>
        <div className="api-url-display">
          <input
              type="text"
              className="field-input"
              value={`http://${httpApiHost}:${httpApiPort}/api/v1/push/messages${httpApiToken ? `?access_token=${httpApiToken}` : ''}`}
              readOnly
          />
          <button
              className="btn btn-secondary"
              onClick={() => {
                navigator.clipboard.writeText(`http://${httpApiHost}:${httpApiPort}/api/v1/push/messages${httpApiToken ? `?access_token=${httpApiToken}` : ''}`)
                showMessage('已复制推送地址', true)
              }}
              title="复制"
          >
            <Copy size={16} />
          </button>
        </div>
      </div>

      <div className="form-group">
        <label>推送内容</label>
        <span className="form-hint">SSE 事件名包含 `message.new` 和 `message.revoke`；私聊推送 `rawid/avatarUrl/sourceName/content/timestamp`，群聊额外附带 `groupName`，其中 `timestamp` 为秒级 Unix 时间戳</span>
        <div className="api-docs">
          <div className="api-item">
            <div className="api-endpoint">
              <span className="method get">GET</span>
              <code>{`http://${httpApiHost}:${httpApiPort}/api/v1/push/messages`}</code>
            </div>
            <p className="api-desc">通过 SSE 长连接接收消息事件，建议接收端按 `event + rawid` 去重。</p>
            <div className="api-params">
              {['event', 'sessionId', 'sessionType', 'rawid', 'avatarUrl', 'sourceName', 'groupName?', 'content', 'timestamp'].map((param) => (
                <span key={param} className="param">
                  <code>{param}</code>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showApiWarning && (
        <div className="modal-overlay" onClick={() => setShowApiWarning(false)}>
          <div className="api-warning-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <ShieldCheck size={20} />
              <h3>安全提示</h3>
            </div>
            <div className="modal-body">
              <p className="warning-text">启用 HTTP API 服务后，本机上的其他程序可通过接口访问您的聊天记录数据。</p>
              <div className="warning-list">
                <div className="warning-item">
                  <span className="bullet">•</span>
                  <span>请确保您了解此功能的用途</span>
                </div>
                <div className="warning-item">
                  <span className="bullet">•</span>
                  <span>不要在公共或不信任的网络环境下使用</span>
                </div>
                <div className="warning-item">
                  <span className="bullet">•</span>
                  <span>此功能仅供高级用户或开发者使用</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowApiWarning(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={confirmStartApi}>
                确认启动
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const renderObsidianTab = () => {
    return (
      <div className="tab-content">
        <div className="form-group">
          <label>Obsidian 库路径</label>
          <span className="form-hint">选择 Obsidian 库（Vault）的本地文件夹路径，聊天合集和聊天记录将以 Markdown 格式导出到该库中</span>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <input
              type="text"
              className="field-input"
              value={obsidianVaultPath}
              placeholder="未绑定，请选择 Obsidian 库文件夹"
              readOnly
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-primary"
              onClick={async () => {
                try {
                  const result = await window.electronAPI.dialog.openDirectory({
                    title: '选择 Obsidian 库（Vault）文件夹',
                    defaultPath: obsidianVaultPath || undefined,
                    properties: ['openDirectory', 'createDirectory']
                  })
                  if (result && !result.canceled && result.filePaths && result.filePaths.length > 0) {
                    const folderPath = result.filePaths[0]
                    setObsidianVaultPath(folderPath)
                    await configService.setObsidianVaultPath(folderPath)
                    showMessage('已绑定 Obsidian 库', true)
                  }
                } catch (e: any) {
                  showMessage(`选择文件夹失败: ${e?.message || String(e)}`, false)
                }
              }}
            >
              <FolderOpen size={16} style={{ marginRight: 4 }} /> 选择文件夹
            </button>
            {obsidianVaultPath && (
              <button
                className="btn btn-secondary"
                onClick={async () => {
                  setObsidianVaultPath('')
                  await configService.setObsidianVaultPath('')
                  showMessage('已取消绑定', true)
                }}
              >
                取消绑定
              </button>
            )}
          </div>
          {obsidianVaultPath && (
            <div style={{ marginTop: '8px', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '6px', fontSize: '0.85em', color: 'var(--text-secondary)' }}>
              已绑定库路径: <code style={{ color: 'var(--primary)' }}>{obsidianVaultPath}</code>
            </div>
          )}
        </div>

        <div className="divider" />

        <div className="form-group">
          <label>导出说明</label>
          <span className="form-hint">
            导出至 Obsidian 功能会将聊天合集内容转换为 Markdown 格式（.md 文件），直接保存到绑定的 Obsidian 库中。
            文件包含 YAML Frontmatter 元数据，兼容 Obsidian 的笔记管理特性。
          </span>
        </div>

        <div className="form-group">
          <label>使用方式</label>
          <div className="api-docs">
            <div className="api-item">
              <div className="api-desc" style={{ margin: 0 }}>
                1. 点击上方按钮选择你的 Obsidian 库（Vault）文件夹<br />
                2. 在聊天页面，右键点击聊天合集消息<br />
                3. 选择"导出至 Obsidian"<br />
                4. 文件将自动保存到库中，在 Obsidian 中即可查看
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const handleSetupHello = async () => {
    if (!helloPassword) {
      showMessage('请输入当前密码以开启 Hello', false)
      return
    }
    if (!isWindows) {
      showMessage('当前系统不支持 Windows Hello', false)
      return
    }
    setIsSettingHello(true)
    try {
      const verifyResult = await window.electronAPI.auth.hello('请验证您的身份以开启 Windows Hello')
      if (!verifyResult.success) {
        showMessage(verifyResult.error || 'Windows Hello 验证失败', false)
        return
      }

      const saveResult = await window.electronAPI.auth.setHelloSecret(helloPassword)
      if (!saveResult.success) {
        showMessage('Windows Hello 配置保存失败', false)
        return
      }

      setAuthUseHello(true)
      setHelloPassword('')
      showMessage('Windows Hello 设置成功', true)
    } catch (e: any) {
      showMessage(`Windows Hello 设置失败: ${e?.message || String(e)}`, false)
    } finally {
      setIsSettingHello(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      showMessage('两次密码不一致', false)
      return
    }

    try {
      const lockMode = await window.electronAPI.auth.isLockMode()

      if (authEnabled && lockMode) {
        // 已开启应用锁且已是 lock: 模式 → 修改密码
        if (!oldPassword) {
          showMessage('请输入旧密码', false)
          return
        }
        const result = await window.electronAPI.auth.changePassword(oldPassword, newPassword)
        if (result.success) {
          setNewPassword('')
          setConfirmPassword('')
          setOldPassword('')
          showMessage('密码已更新', true)
        } else {
          showMessage(result.error || '密码更新失败', false)
        }
      } else {
        // 未开启应用锁，或旧版 safe: 模式 → 开启/升级为 lock: 模式
        const result = await window.electronAPI.auth.enableLock(newPassword)
        if (result.success) {
          setAuthEnabled(true)
          setIsLockMode(true)
          setNewPassword('')
          setConfirmPassword('')
          setOldPassword('')
          showMessage('应用锁已开启', true)
        } else {
          showMessage(result.error || '开启失败', false)
        }
      }
    } catch (e: any) {
      showMessage('操作失败', false)
    }
  }

  const renderAnalyticsTab = () => (
    <div className="tab-content">
      <div className="settings-section">
        <h2>分析设置</h2>
        <div className="setting-item">
          <div className="setting-label">
            <span>词云排除词</span>
            <span className="setting-desc">输入不需要在词云和常用语中显示的词语，用换行分隔</span>
          </div>
          <div className="setting-control" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
            <textarea
              className="form-input"
              style={{ width: '100%', height: '200px', fontFamily: 'monospace' }}
              value={excludeWordsInput}
              onChange={(e) => setExcludeWordsInput(e.target.value)}
              placeholder="例如：
第一个词
第二个词
第三个词"
            />
            <div className="button-group">
              <button
                className="btn btn-primary"
                onClick={async () => {
                  const words = excludeWordsInput.split('\n').map(w => w.trim()).filter(w => w.length > 0)
                  // 去重
                  const uniqueWords = Array.from(new Set(words))
                  await configService.setWordCloudExcludeWords(uniqueWords)
                  setWordCloudExcludeWords(uniqueWords)
                  setExcludeWordsInput(uniqueWords.join('\n'))
                  // Show success toast or feedback if needed (optional)
                }}
              >
                保存排除列表
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setExcludeWordsInput(wordCloudExcludeWords.join('\n'))
                }}
              >
                重置
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  )

  const renderSecurityTab = () => (
    <div className="tab-content">
      <div className="form-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <label>应用锁状态</label>
            <span className="form-hint">{
              isLockMode ? '已开启' :
                authEnabled ? '旧版模式 — 请重新设置密码以升级为新模式提高安全性' :
                  '未开启 — 请设置密码以开启'
            }</span>
          </div>
          {authEnabled && !showDisableLockInput && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowDisableLockInput(true)}
            >
              关闭应用锁
            </button>
          )}
        </div>
        {showDisableLockInput && (
          <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
            <input
              type="password"
              className="field-input"
              placeholder="输入当前密码以关闭"
              value={disableLockPassword}
              onChange={e => setDisableLockPassword(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn-primary btn-sm"
              disabled={!disableLockPassword}
              onClick={async () => {
                const result = await window.electronAPI.auth.disableLock(disableLockPassword)
                if (result.success) {
                  setAuthEnabled(false)
                  setAuthUseHello(false)
                  setIsLockMode(false)
                  setShowDisableLockInput(false)
                  setDisableLockPassword('')
                  showMessage('应用锁已关闭', true)
                } else {
                  showMessage(result.error || '关闭失败', false)
                }
              }}
            >确认</button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setShowDisableLockInput(false); setDisableLockPassword('') }}
            >取消</button>
          </div>
        )}
      </div>

      <div className="divider" />

      <div className="form-group">
        <label>{isLockMode ? '修改密码' : '设置密码并开启应用锁'}</label>
        <span className="form-hint">{isLockMode ? '修改应用锁密码（需要旧密码验证）' : '设置密码后将自动开启应用锁'}</span>

        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isLockMode && (
            <input
              type="password"
              className="field-input"
              placeholder="旧密码"
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
            />
          )}
          <input
            type="password"
            className="field-input"
            placeholder="新密码"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="password"
              className="field-input"
              placeholder="确认新密码"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={handleUpdatePassword} disabled={!newPassword}>
              {isLockMode ? '更新' : '开启'}
            </button>
          </div>
        </div>
      </div>

      <div className="divider" />

      <div className="form-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <label>Windows Hello</label>
            <span className="form-hint">使用面容、指纹快速解锁</span>
            {!authEnabled && <div className="form-hint warning" style={{ color: '#ff4d4f' }}>请先开启应用锁</div>}
            {!helloAvailable && authEnabled && <div className="form-hint warning" style={{ color: '#ff4d4f' }}>当前设备不支持 Windows Hello</div>}
          </div>

          <div>
            {authUseHello ? (
              <button className="btn btn-secondary btn-sm" onClick={async () => {
                await window.electronAPI.auth.clearHelloSecret()
                setAuthUseHello(false)
                showMessage('Windows Hello 已关闭', true)
              }}>关闭</button>
            ) : (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleSetupHello}
                disabled={!helloAvailable || isSettingHello || !authEnabled || !helloPassword}
              >
                {isSettingHello ? '配置中...' : '开启与设置'}
              </button>
            )}
          </div>
        </div>
        {!authUseHello && authEnabled && (
          <div style={{ marginTop: 10 }}>
            <input
              type="password"
              className="field-input"
              placeholder="输入当前密码以开启 Hello"
              value={helloPassword}
              onChange={e => setHelloPassword(e.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  )

  const renderAboutTab = () => (
    <div className="tab-content about-tab">
      <div className="about-card">
        <div className="about-logo">
          <img src="./logo.png" alt="WeFlow" />
        </div>
        <h2 className="about-name">WeFlow</h2>
        <p className="about-version">v{appVersion || '...'}</p>
      </div>

      <div className="about-footer">
        <p className="about-desc">微信聊天记录分析工具</p>
        <div className="about-links">
          <a href="#" onClick={(e) => { e.preventDefault(); window.electronAPI.shell.openExternal('https://weflow.top') }}>官网</a>
          <span>·</span>
          <a href="#" onClick={(e) => { e.preventDefault(); window.electronAPI.shell.openExternal('https://github.com/AXXZSTHL/WeFlow') }}>GitHub 仓库</a>
          <span>·</span>
          <a href="#" onClick={(e) => { e.preventDefault(); window.electronAPI.shell.openExternal('https://chatlab.fun') }}>ChatLab</a>
          <span>·</span>
          <a href="#" onClick={(e) => { e.preventDefault(); window.electronAPI.window.openAgreementWindow() }}>用户协议</a>
        </div>
        <p className="copyright">© 2026 WeFlow. All rights reserved.</p>

        <div className="log-toggle-line" style={{ marginTop: '16px', justifyContent: 'center' }}>
          <span style={{ fontSize: '13px', opacity: 0.7 }}>匿名数据收集</span>
          <label className="switch">
            <input
              type="checkbox"
              className="switch-input"
              checked={analyticsConsent}
              onChange={async (e) => {
                const consent = e.target.checked
                setAnalyticsConsent(consent)
                await configService.setAnalyticsConsent(consent)
                showMessage(consent ? '已允许数据收集' : '已拒绝数据收集', true)
              }}
            />
            <span className="switch-slider"></span>
          </label>
        </div>
      </div>

    </div>
  )

  const renderAutoDownloadTab = () => {
    const sortedSessions = [...antiRevokeSessions].sort((a, b) => (b.sortTimestamp || 0) - (a.sortTimestamp || 0))
    const keyword = autoDownloadSearchKeyword.trim().toLowerCase()
    const filteredSessions = sortedSessions.filter((session) => {
      if (!keyword) return true
      const displayName = String(session.displayName || '').toLowerCase()
      const username = String(session.username || '').toLowerCase()
      return displayName.includes(keyword) || username.includes(keyword)
    })
    const filteredSessionIds = filteredSessions.map((session) => session.username)
    const selectedCount = autoDownloadSelectedIds.size
    const selectedInFilteredCount = filteredSessionIds.filter((id) => autoDownloadSelectedIds.has(id)).length
    const allFilteredSelected = filteredSessionIds.length > 0 && selectedInFilteredCount === filteredSessionIds.length
    const isHooked = autoDownloadStatus?.isHooked

    const persistWhitelist = (ids: Set<string>) => {
      const whitelistArr = Array.from(ids)
      configService.setAutoDownloadWhitelist(whitelistArr)
      if (autoDownloadHighRes) {
        const whitelistStr = whitelistArr.length > 0 ? (whitelistArr.join('\0') + '\0\0') : '';
        (window as any).electronAPI.image.startAutoDownload(whitelistStr)
      }
    }

    const toggleSelection = (id: string) => {
      const next = new Set(autoDownloadSelectedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setAutoDownloadSelectedIds(next)
      persistWhitelist(next)
    }

    const selectAllFiltered = () => {
      const next = new Set(autoDownloadSelectedIds)
      filteredSessionIds.forEach(id => next.add(id))
      setAutoDownloadSelectedIds(next)
      persistWhitelist(next)
    }

    const clearSelection = () => {
      const next = new Set<string>()
      setAutoDownloadSelectedIds(next)
      persistWhitelist(next)
    }

    return (
        <div className="tab-content anti-revoke-tab">
          {/* 顶部 Hero 区域保持不变 */}
          <div className="anti-revoke-hero" style={{ background: 'linear-gradient(110deg, var(--bg-primary) 0%, rgba(245, 158, 11, 0.1) 100%)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
            <div className="anti-revoke-hero-main">
              <span className="updates-chip" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', width: 'fit-content' }}>测试功能 (Test)</span>
              <h2 style={{ marginTop: '8px' }}>自动下载原图</h2>
              <p>强制微信在接收图片时下载高清原图。建议仅在必要会话中开启以节省流量和空间。</p>
            </div>
            <div className="anti-revoke-metrics">
              <div className={`anti-revoke-metric ${isHooked ? 'is-installed' : 'is-pending'}`}>
                <span className="label">服务状态</span>
                <span className="value" style={{ fontSize: '14px' }}>
              {isHooked ? '正在监控' : autoDownloadHighRes ? '等待连接' : '未启用'}
            </span>
              </div>
              <div className="anti-revoke-metric">
                <span className="label">已选会话</span>
                <span className="value">{selectedCount}</span>
              </div>
            </div>
          </div>

          <div className="anti-revoke-control-card">
            <div className="anti-revoke-toolbar">
              <div className="filter-search-box anti-revoke-search">
                <Search size={14} />
                <input
                    type="text"
                    placeholder="搜索联系人或群聊..."
                    value={autoDownloadSearchKeyword}
                    onChange={(e) => setAutoDownloadSearchKeyword(e.target.value)}
                />
              </div>
              <div className="anti-revoke-toolbar-actions">
                <div className="anti-revoke-btn-group">
                  <button className="btn btn-secondary btn-sm" onClick={selectAllFiltered} disabled={filteredSessionIds.length === 0 || allFilteredSelected}>
                    全选
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={clearSelection} disabled={selectedCount === 0}>
                    清空选择
                  </button>
                </div>
                <div className="anti-revoke-btn-group" style={{ marginLeft: '12px', paddingLeft: '12px', borderLeft: '1px solid var(--border-color)' }}>
                  <label className="switch switch-md">
                    <input
                        type="checkbox"
                        checked={autoDownloadHighRes}
                        onChange={() => handleToggleAutoDownload(Array.from(autoDownloadSelectedIds))}
                    />
                    <span className="switch-slider" />
                  </label>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                {autoDownloadHighRes ? '服务已开启' : '服务已关闭'}
              </span>
                </div>
              </div>
            </div>

            <div className="anti-revoke-batch-actions">
              <div className="anti-revoke-selected-count">
                <span>已选 <strong>{selectedCount}</strong> 个目标会话</span>
                <span style={{ opacity: 0.6 }}>（若不选则默认对所有聊天生效）</span>
              </div>
            </div>
          </div>

          <div className="anti-revoke-list">
            <div className="anti-revoke-list-header">
              <span>会话（{filteredSessions.length}）</span>
              <span>状态</span>
            </div>
            {filteredSessions.length === 0 ? (
                <div className="anti-revoke-empty">{autoDownloadSearchKeyword ? '没有匹配的会话' : '暂无会话'}</div>
            ) : (
                filteredSessions.map((session) => {
                  const isSelected = autoDownloadSelectedIds.has(session.username)
                  return (
                      <div key={session.username} className={`anti-revoke-row ${isSelected ? 'selected' : ''}`}>
                        <label className="anti-revoke-row-main">
                  <span className="anti-revoke-check">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(session.username)}
                    />
                    <span className="check-indicator" aria-hidden="true">
                      <Check size={12} />
                    </span>
                  </span>
                          <Avatar src={session.avatarUrl} name={session.displayName} size={30} />
                          <div className="anti-revoke-row-text">
                            <span className="name">{session.displayName || session.username}</span>
                          </div>
                        </label>
                        <div className="anti-revoke-row-status">
                  <span className={`status-badge ${isSelected ? 'installed' : 'not-installed'}`}>
                    <i className="status-dot" aria-hidden="true" />
                    {isSelected ? '已监控' : '未开启'}
                  </span>
                        </div>
                      </div>
                  )
                })
            )}
          </div>

          {/* 风险提示部分保持不变 */}
          <div className="api-warning-modal" style={{ width: '100%', border: '1px solid rgba(239, 68, 68, 0.2)', marginTop: '16px', background: 'rgba(239, 68, 68, 0.02)', animation: 'none', boxShadow: 'none', position: 'static' }}>
            <div className="modal-header" style={{ border: 'none', padding: '12px 20px 0' }}>
              <Lock size={16} color="#ef4444" />
              <h3 style={{ fontSize: '13px', color: '#ef4444' }}>风险警告</h3>
            </div>
            <div className="modal-body" style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '8px 20px 12px' }}>
              此功能通过内存 Hook 修改微信行为，具有一定的风险。请尽量仅在白名单模式下针对必要会话开启。
            </div>
          </div>
        </div>
    )
  }


  const handleToggleAutoDownload = async (whitelist?: string[] | string) => {
    const newVal = !autoDownloadHighRes
    setAutoDownloadHighRes(newVal)

    try {
      if (newVal) {
        let currentWhitelist: string[] | string = whitelist || Array.from(autoDownloadSelectedIds)
        if (Array.isArray(currentWhitelist)) {
          currentWhitelist = currentWhitelist.length > 0 ? (currentWhitelist.join('\0') + '\0\0') : ''
        }
        const result = await (window as any).electronAPI.image.startAutoDownload(currentWhitelist)
        if (result && !result.success) {
          // 如果底层明确返回了失败
          throw new Error(result.error || '启动自动下载服务失败')
        }
        showMessage('自动下载已开启，正在尝试连接微信', true)
        await fetchAutoDownloadStatus()
      } else {
        await (window as any).electronAPI.image.stopAutoDownload()
        showMessage('自动下载已关闭', true)
        setAutoDownloadStatus(null)
      }
      await configService.setAutoDownloadHighRes(newVal)
    } catch (e: any) {
      // 发生错误时，将开关拨回去
      setAutoDownloadHighRes(!newVal)
      showMessage(`操作失败: ${e.message || String(e)}`, false)
    }
  }

  const renderUpdatesTab = () => {
    const downloadPercent = Math.max(0, Math.min(100, Number(downloadProgress?.percent || 0)))
    const channelCards: { id: configService.UpdateChannel; title: string; desc: string }[] = [
      { id: 'stable', title: '稳定版', desc: '正式发布的版本，适合日常使用' },
      { id: 'preview', title: '预览版', desc: '正式发布前的预览体验版本' },
      { id: 'dev', title: '开发版', desc: '即刻体验我们的屎山代码' }
    ]

    return (
      <div className="tab-content updates-tab">
        <div className="updates-hero">
          <div className="updates-hero-main">
            <span className="updates-chip">当前版本</span>
            <h2>{appVersion || '...'}</h2>
            <p>{updateInfo?.hasUpdate ? `发现新版本 v${updateInfo.version}` : '当前已是最新版本，可手动检查更新'}</p>
          </div>
          <div className="updates-hero-action">
            {updateInfo?.hasUpdate ? (
              <button className="btn btn-primary" onClick={() => setShowUpdateDialog(true)}>
                <Download size={16} /> 立即更新
              </button>
            ) : (
              <button className="btn btn-secondary" onClick={handleCheckUpdate} disabled={isCheckingUpdate}>
                <RefreshCw size={16} className={isCheckingUpdate ? 'spin' : ''} />
                {isCheckingUpdate ? '检查中...' : '检查更新'}
              </button>
            )}
          </div>
        </div>

        {(isDownloading || updateInfo?.hasUpdate) && (
          <div className="updates-progress-card">
            <div className="updates-progress-header">
              <h3>{isDownloading ? `正在下载 v${updateInfo?.version || ''}` : `新版本 v${updateInfo?.version} 已就绪`}</h3>
              {isDownloading ? <strong>{downloadPercent.toFixed(0)}%</strong> : <span>可立即安装</span>}
            </div>
            <div className="updates-progress-track">
              <div className="updates-progress-fill" style={{ width: `${isDownloading ? downloadPercent : 100}%` }} />
            </div>
            {updateInfo?.hasUpdate && !isDownloading && (
              <button className="btn btn-secondary updates-ignore-btn" onClick={handleIgnoreUpdate}>
                暂不提醒此版本
              </button>
            )}
          </div>
        )}

        <div className="updates-card">
          <div className="updates-card-header">
            <h3>更新渠道</h3>
            <span>切换渠道后会自动重新检查</span>
          </div>
          <div className="update-channel-grid">
            {channelCards.map((channel) => {
              const active = updateChannel === channel.id
              return (
                <button
                  key={channel.id}
                  className={`update-channel-card ${active ? 'active' : ''}`}
                  onClick={() => void handleUpdateChannelChange(channel.id)}
                  disabled={active}
                >
                  <div className="update-channel-title-row">
                    <span className="title">{channel.title}</span>
                    {active && <Check size={16} />}
                  </div>
                  <span className="desc">{channel.desc}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
    <div className={`settings-modal-overlay ${isClosing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`settings-page ${isClosing ? 'closing' : ''}`} onClick={(event) => event.stopPropagation()}>
        {message && <div className={`message-toast ${message.success ? 'success' : 'error'}`}>{message.text}</div>}

        {/* 多账号选择对话框 */}
        {showWxidSelect && wxidOptions.length > 1 && (
          <div className="wxid-dialog-overlay" onClick={() => setShowWxidSelect(false)}>
            <div className="wxid-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="wxid-dialog-header">
                <h3>检测到多个微信账号</h3>
                <p>请选择要使用的账号</p>
              </div>
              <div className="wxid-dialog-list">
                {wxidOptions.map((opt) => (
                    <div
                        key={opt.wxid}
                        className={`wxid-dialog-item ${opt.wxid === wxid ? 'active' : ''}`}
                        onClick={() => handleSelectWxid(opt.wxid)}
                    >
                      <div className="wxid-profile-row">
                        {opt.avatarUrl ? (
                            <img src={opt.avatarUrl} alt="avatar" className="wxid-avatar" />
                        ) : (
                            <div className="wxid-avatar-fallback"><UserRound size={18}/></div>
                        )}
                        <div className="wxid-info-col">
                          <span className="wxid-id">{opt.nickname || opt.wxid}</span>
                          {opt.nickname && <span className="wxid-date">{opt.wxid}</span>}
                        </div>
                      </div>
                      <span className="wxid-date" style={{marginLeft: 'auto'}}>最后修改 {new Date(opt.modifiedTime).toLocaleString()}</span>
                    </div>
                ))}
              </div>
              <div className="wxid-dialog-footer">
                <button className="btn btn-secondary" onClick={() => setShowWxidSelect(false)}>取消</button>
              </div>
            </div>
          </div>
        )}

        <div className="settings-header">
          <div className="settings-title-block">
            <h1>设置</h1>
          </div>
          <div className="settings-actions">
            {onClose && (
              <button type="button" className="settings-close-btn" onClick={handleClose} aria-label="关闭设置">
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="settings-layout">
          <div className="settings-tabs" role="tablist" aria-label="设置项">
            {filteredTabs.flatMap((tab) => {
              const row: React.ReactNode[] = [
                <button
                  key={tab.id}
                  className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <tab.icon size={16} />
                  <span>{tab.label}</span>
                </button>
              ]

              if (tab.id === 'analytics') {
                row.push(
                  <div key="ai-settings-group" className={`tab-group ${aiGroupExpanded ? 'expanded' : ''}`}>
                    <button
                      className={`tab-btn tab-group-trigger ${(activeTab === 'aiCommon' || activeTab === 'insight' || activeTab === 'aiFootprint' || activeTab === 'insightPrompt' || activeTab === 'personaPrompt' || activeTab === 'topicsPrompt' || activeTab === 'replyPrompt') ? 'active' : ''}`}
                      onClick={() => setAiGroupExpanded((prev) => !prev)}
                      aria-expanded={aiGroupExpanded}
                    >
                      <Sparkles size={16} />
                      <span>AI 设置</span>
                      <ChevronDown size={14} className={`tab-group-arrow ${aiGroupExpanded ? 'expanded' : ''}`} />
                    </button>
                    <div className={`tab-sublist-wrap ${aiGroupExpanded ? 'expanded' : 'collapsed'}`}>
                      <div className="tab-sublist">
                        {aiTabs.map((tab) => (
                          <button
                            key={tab.id}
                            className={`tab-btn tab-sub-btn ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                            tabIndex={aiGroupExpanded ? 0 : -1}
                          >
                            <span className="tab-sub-dot" />
                            <span>{tab.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              }

              return row
            })}
          </div>

          <div className="settings-body">
            {activeTab === 'appearance' && renderAppearanceTab()}
            {activeTab === 'notification' && renderNotificationTab()}
            {activeTab === 'antiRevoke' && renderAntiRevokeTab()}
            {activeTab === 'database' && renderDatabaseTab()}
            {activeTab === 'models' && renderModelsTab()}
            {activeTab === 'cache' && renderCacheTab()}
            {activeTab === 'api' && renderApiTab()}
            {activeTab === 'obsidian' && renderObsidianTab()}
            {activeTab === 'aiCommon' && renderAiCommonTab()}
            {activeTab === 'insight' && renderInsightTab()}
            {activeTab === 'aiFootprint' && renderAiFootprintTab()}
            {activeTab === 'insightPrompt' && renderInsightPromptTab()}
            {activeTab === 'personaPrompt' && renderPersonaPromptTab()}
            {activeTab === 'topicsPrompt' && renderTopicsPromptTab()}
            {activeTab === 'replyPrompt' && renderReplyPromptTab()}
            {activeTab === 'autoDownload' && renderAutoDownloadTab()}
            {activeTab === 'updates' && renderUpdatesTab()}
            {activeTab === 'analytics' && renderAnalyticsTab()}
            {activeTab === 'security' && renderSecurityTab()}
            {activeTab === 'about' && renderAboutTab()}
          </div>
        </div>
      </div>
    </div>

      {showWeiboCookieModal && (
        <div
          className="social-cookie-modal-overlay"
          onClick={(e) => {
            e.stopPropagation()
            void handleCloseWeiboCookieModal()
          }}
        >
          <div className="settings-inline-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <Globe size={20} />
              <h3>微博 Cookie（实验性）</h3>
            </div>
            <div className="modal-body">
              <p className="warning-text">
                仅用于微博公开内容补充分析，全局生效，不会写入仓库。支持直接粘贴浏览器导出的 Cookie JSON 数组，也支持原始 <code>name=value</code> 字符串。
              </p>
              <textarea
                className="social-cookie-textarea"
                value={weiboCookieDraft}
                placeholder="粘贴微博 Cookie，关闭弹层时自动保存"
                onChange={(e) => {
                  setWeiboCookieDraft(e.target.value)
                  setWeiboCookieError('')
                }}
              />
              {weiboCookieError && (
                <div className="social-inline-error">{weiboCookieError}</div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => void handleCloseWeiboCookieModal(true)}>
                取消更改
              </button>
              <button
                className="btn btn-secondary"
                onClick={async () => {
                  setWeiboCookieDraft('')
                  const ok = await persistWeiboCookieDraft('')
                  if (ok) setShowWeiboCookieModal(false)
                }}
                disabled={isSavingWeiboCookie || !aiInsightWeiboCookie}
              >
                清空
              </button>
              <button className="btn btn-primary" onClick={() => { void handleCloseWeiboCookieModal() }} disabled={isSavingWeiboCookie}>
                {isSavingWeiboCookie ? '保存中...' : '关闭并保存'}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  )
}

export default SettingsPage














