import { existsSync } from 'fs'
import { join } from 'path'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { app } from 'electron'

const execFileAsync = promisify(execFile)

type WechatRpaSendOptions = {
  targetCandidates: string[]
  message: string
  autoSend?: boolean
  launchIfNeeded?: boolean
}

type WechatRpaResult = {
  success: boolean
  error?: string
  targetUsed?: string
  sent?: boolean
  opened?: boolean
  steps?: string[]
}

type WindowInfo = {
  hWnd: any
  title: string
  className: string
}

export class WechatRpaService {
  private koffi: any = null
  private user32: any = null
  private kernel32: any = null
  private initialized = false

  private EnumWindows: any = null
  private EnumChildWindows: any = null
  private GetWindowTextW: any = null
  private GetWindowTextLengthW: any = null
  private GetClassNameW: any = null
  private GetWindowThreadProcessId: any = null
  private IsWindowVisible: any = null
  private ShowWindow: any = null
  private SetForegroundWindow: any = null
  private BringWindowToTop: any = null
  private SetFocus: any = null
  private PostMessageW: any = null
  private GetForegroundWindow: any = null
  private AttachThreadInput: any = null
  private GetCurrentThreadId: any = null
  private WNDENUMPROC_PTR: any = null

  private readonly VK_RETURN = 0x0d
  private readonly WM_KEYDOWN = 0x0100
  private readonly WM_KEYUP = 0x0101
  private readonly WM_CHAR = 0x0102
  private readonly SW_RESTORE = 9

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private async findPidByImageName(imageName: string): Promise<number | null> {
    try {
      const { stdout } = await execFileAsync('tasklist', ['/FI', `IMAGENAME eq ${imageName}`, '/FO', 'CSV', '/NH'])
      const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      for (const line of lines) {
        if (line.startsWith('INFO:')) continue
        const parts = line.split('","').map((p) => p.replace(/^"|"$/g, ''))
        if (parts[0]?.toLowerCase() === imageName.toLowerCase()) {
          const pid = Number(parts[1])
          if (!Number.isNaN(pid)) return pid
        }
      }
      return null
    } catch {
      return null
    }
  }

  private async findWeChatPid(): Promise<number | null> {
    for (const name of ['Weixin.exe', 'WeChat.exe']) {
      const pid = await this.findPidByImageName(name)
      if (pid) return pid
    }
    return null
  }

  private async findWeChatExecutable(): Promise<string | null> {
    const roots = [
      'C:\\Program Files\\Tencent',
      'C:\\Program Files (x86)\\Tencent',
      'D:\\Program Files\\Tencent',
      'D:\\Program Files (x86)\\Tencent'
    ]
    const candidates = ['WeChat\\WeChat.exe', 'Weixin\\Weixin.exe']
    for (const root of roots) {
      for (const rel of candidates) {
        const full = join(root, rel)
        if (existsSync(full)) return full
      }
    }

    try {
      const pid = await this.findWeChatPid()
      if (!pid) return null
      const { stdout } = await execFileAsync('wmic', ['process', 'where', `processid=${pid}`, 'get', 'ExecutablePath', '/value'])
      const match = stdout.match(/ExecutablePath=(.*)/i)
      const path = String(match?.[1] || '').trim()
      if (path && existsSync(path)) return path
    } catch {
      return null
    }

    return null
  }

  private ensureLoaded(): boolean {
    if (this.initialized) return true
    try {
      this.koffi = require('koffi')
      this.user32 = this.koffi.load('user32.dll')
      this.kernel32 = this.koffi.load('kernel32.dll')

      const WNDENUMPROC = this.koffi.proto('bool __stdcall (void *hWnd, intptr_t lParam)')
      this.WNDENUMPROC_PTR = this.koffi.pointer(WNDENUMPROC)

      this.EnumWindows = this.user32.func('EnumWindows', 'bool', [this.WNDENUMPROC_PTR, 'intptr_t'])
      this.EnumChildWindows = this.user32.func('EnumChildWindows', 'bool', ['void*', this.WNDENUMPROC_PTR, 'intptr_t'])
      this.GetWindowTextW = this.user32.func('GetWindowTextW', 'int', ['void*', this.koffi.out('uint16*'), 'int'])
      this.GetWindowTextLengthW = this.user32.func('GetWindowTextLengthW', 'int', ['void*'])
      this.GetClassNameW = this.user32.func('GetClassNameW', 'int', ['void*', this.koffi.out('uint16*'), 'int'])
      this.GetWindowThreadProcessId = this.user32.func('GetWindowThreadProcessId', 'uint32', ['void*', this.koffi.out('uint32*')])
      this.IsWindowVisible = this.user32.func('IsWindowVisible', 'bool', ['void*'])
      this.ShowWindow = this.user32.func('ShowWindow', 'bool', ['void*', 'int'])
      this.SetForegroundWindow = this.user32.func('SetForegroundWindow', 'bool', ['void*'])
      this.BringWindowToTop = this.user32.func('BringWindowToTop', 'bool', ['void*'])
      this.SetFocus = this.user32.func('SetFocus', 'void*', ['void*'])
      this.PostMessageW = this.user32.func('PostMessageW', 'bool', ['void*', 'uint32', 'uintptr_t', 'intptr_t'])
      this.GetForegroundWindow = this.user32.func('GetForegroundWindow', 'void*', [])
      this.AttachThreadInput = this.user32.func('AttachThreadInput', 'bool', ['uint32', 'uint32', 'bool'])
      this.GetCurrentThreadId = this.kernel32.func('GetCurrentThreadId', 'uint32', [])

      this.initialized = true
      return true
    } catch (error) {
      console.error('[wechat-rpa] 初始化失败:', error)
      return false
    }
  }

  private decodeUtf16(buf: Buffer): string {
    const zeroIndex = buf.indexOf(0)
    return buf.toString('ucs2', 0, zeroIndex >= 0 ? zeroIndex : undefined).trim()
  }

  private isWeChatWindowTitle(title: string): boolean {
    const normalized = String(title || '').trim()
    if (!normalized) return false
    const lower = normalized.toLowerCase()
    return normalized === '微信' || lower === 'wechat' || lower === 'weixin'
  }

  private async launchWeChatIfNeeded(): Promise<void> {
    const exe = await this.findWeChatExecutable()
    if (exe) {
      spawn(exe, [], { detached: true, stdio: 'ignore' }).unref()
      return
    }
  }

  private resolveUiaScriptPath(): string | null {
    const candidates = app.isPackaged
      ? [
          join(process.resourcesPath, 'resources', 'rpa', 'wechat-uia-send.ps1'),
          join(process.resourcesPath, 'rpa', 'wechat-uia-send.ps1')
        ]
      : [
          join(app.getAppPath(), 'resources', 'rpa', 'wechat-uia-send.ps1'),
          join(app.getAppPath(), 'resources', 'wechat-uia-send.ps1')
        ]

    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate
    }

    return null
  }

  private async runPowerShellScript(scriptPath: string, args: Record<string, string | boolean>): Promise<{ code: number; stdout: string; stderr: string }> {
    return await new Promise((resolve, reject) => {
      const cliArgs: string[] = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath]
      for (const [key, value] of Object.entries(args)) {
        cliArgs.push(`-${key}`, String(value))
      }

      const child = spawn('powershell.exe', cliArgs, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''
      child.stdout?.setEncoding('utf8')
      child.stderr?.setEncoding('utf8')
      child.stdout?.on('data', chunk => { stdout += chunk })
      child.stderr?.on('data', chunk => { stderr += chunk })
      child.on('error', reject)
      child.on('close', code => resolve({ code: code ?? -1, stdout, stderr }))
    })
  }

  private async trySendViaUia(options: WechatRpaSendOptions): Promise<WechatRpaResult | null> {
    const scriptPath = this.resolveUiaScriptPath()
    if (!scriptPath) return null

    try {
      const result = await this.runPowerShellScript(scriptPath, {
        TargetsJson: JSON.stringify(Array.isArray(options.targetCandidates) ? options.targetCandidates : []),
        Message: String(options.message || ''),
        AutoSend: options.autoSend !== false
      })

      const raw = String(result.stdout || '').trim()
      if (!raw) return null

      const parsed = JSON.parse(raw) as WechatRpaResult
      if (parsed?.success) {
        return parsed
      }

      return null
    } catch (error) {
      console.warn('[wechat-rpa] UIA 路径尝试失败，回退到 Win32:', error)
      return null
    }
  }

  private getWindowTitle(hWnd: any): string {
    const len = this.GetWindowTextLengthW(hWnd)
    if (len <= 0) return ''
    const buf = Buffer.alloc((len + 1) * 2)
    this.GetWindowTextW(hWnd, buf, len + 1)
    return this.decodeUtf16(buf)
  }

  private getClassName(hWnd: any): string {
    const buf = Buffer.alloc(512)
    const len = this.GetClassNameW(hWnd, buf, 256)
    if (!len) return ''
    return this.decodeUtf16(buf)
  }

  private collectChildWindows(parent: any): WindowInfo[] {
    const items: WindowInfo[] = []
    const enumChildCallback = this.koffi.register((hChild: any) => {
      if (!this.IsWindowVisible(hChild)) return true
      items.push({
        hWnd: hChild,
        title: this.getWindowTitle(hChild),
        className: this.getClassName(hChild)
      })
      return true
    }, this.WNDENUMPROC_PTR)

    this.EnumChildWindows(parent, enumChildCallback, 0)
    this.koffi.unregister(enumChildCallback)
    return items
  }

  private async findWeChatWindow(timeoutMs = 12000): Promise<{ hWnd: any; pid: number } | null> {
    if (!this.ensureLoaded()) return null
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      let found: { hWnd: any; pid: number } | null = null
      const enumWindowsCallback = this.koffi.register((hWnd: any) => {
        if (!this.IsWindowVisible(hWnd)) return true
        const title = this.getWindowTitle(hWnd)
        if (!this.isWeChatWindowTitle(title)) return true

        const pidBuf = Buffer.alloc(4)
        this.GetWindowThreadProcessId(hWnd, pidBuf)
        const pid = pidBuf.readUInt32LE(0)
        if (!pid) return true

        found = { hWnd, pid }
        return false
      }, this.WNDENUMPROC_PTR)

      this.EnumWindows(enumWindowsCallback, 0)
      this.koffi.unregister(enumWindowsCallback)
      if (found) return found
      await this.sleep(400)
    }
    return null
  }

  private focusWindow(hWnd: any): void {
    try { this.ShowWindow(hWnd, this.SW_RESTORE) } catch { }
    try { this.BringWindowToTop(hWnd) } catch { }

    let fgWnd: any = null
    let fgThread = 0
    try {
      fgWnd = this.GetForegroundWindow()
      if (fgWnd) {
        const fgPidBuf = Buffer.alloc(4)
        fgThread = this.GetWindowThreadProcessId(fgWnd, fgPidBuf)
      }
    } catch { }

    let currentThread = 0
    try {
      currentThread = this.GetCurrentThreadId()
    } catch { }

    let attached = false
    if (currentThread && fgThread && currentThread !== fgThread) {
      try {
        attached = Boolean(this.AttachThreadInput(currentThread, fgThread, true))
      } catch {
        attached = false
      }
    }

    try { this.SetForegroundWindow(hWnd) } catch { }
    try { this.SetFocus(hWnd) } catch { }

    if (attached) {
      try {
        this.AttachThreadInput(currentThread, fgThread, false)
      } catch { }
    }
  }

  private isEditableClass(className: string): boolean {
    const lower = String(className || '').toLowerCase()
    return lower.includes('edit') || lower.includes('rich') || lower.includes('input') || lower.includes('textarea') || lower.includes('txguiedit')
  }

  private pickSearchControl(children: WindowInfo[]): WindowInfo | null {
    const candidates = children.filter(item => this.isEditableClass(item.className))
    return candidates[0] || null
  }

  private pickComposerControl(children: WindowInfo[]): WindowInfo | null {
    const candidates = children.filter(item => this.isEditableClass(item.className))
    return candidates[candidates.length - 1] || null
  }

  private pressEnter(target?: any): void {
    const targetWindow = target || this.GetForegroundWindow()
    if (!targetWindow) return
    this.PostMessageW(targetWindow, this.WM_KEYDOWN, this.VK_RETURN, 0)
    this.PostMessageW(targetWindow, this.WM_KEYUP, this.VK_RETURN, 0)
  }

  private async typeText(control: WindowInfo, text: string): Promise<boolean> {
    try {
      for (const ch of String(text || '')) {
        const code = ch.codePointAt(0)
        if (!Number.isFinite(code)) continue
        this.PostMessageW(control.hWnd, this.WM_CHAR, code as number, 0)
        await this.sleep(10)
      }
      return true
    } catch (error) {
      console.warn('[wechat-rpa] 逐字输入失败:', error)
      return false
    }
  }

  public async sendReply(options: WechatRpaSendOptions): Promise<WechatRpaResult> {
    const steps: string[] = []
    if (process.platform !== 'win32') {
      return { success: false, error: '仅支持 Windows 平台', steps }
    }
    if (!this.ensureLoaded()) {
      return { success: false, error: 'RPA 初始化失败', steps }
    }

    const message = String(options?.message || '').trim()
    const targetCandidates = Array.isArray(options?.targetCandidates)
      ? options.targetCandidates.map(item => String(item || '').trim()).filter(Boolean)
      : []
    const autoSend = options?.autoSend !== false
    const launchIfNeeded = options?.launchIfNeeded !== false

    if (!message) return { success: false, error: '没有可发送的内容', steps }
    if (targetCandidates.length === 0) return { success: false, error: '没有可定位的聊天对象', steps }

    const uiaResult = await this.trySendViaUia({ targetCandidates, message, autoSend, launchIfNeeded })
    if (uiaResult?.success) {
      return { ...uiaResult, steps: [...steps, ...(uiaResult.steps || []), 'uia'] }
    }

    let window = await this.findWeChatWindow(1000)
    if (!window && launchIfNeeded) {
      steps.push('launch')
      await this.launchWeChatIfNeeded()
      window = await this.findWeChatWindow(15000)
    }
    if (!window) return { success: false, error: '未找到微信窗口', steps }

    const mainWindow = window.hWnd
    this.focusWindow(mainWindow)
    await this.sleep(350)

    let targetUsed = targetCandidates[0]
    let searchOk = false

    for (const candidate of targetCandidates.slice(0, 6)) {
      targetUsed = candidate
      const children = this.collectChildWindows(mainWindow)
      const searchControl = this.pickSearchControl(children)
      if (!searchControl) continue

      this.focusWindow(searchControl.hWnd)
      await this.sleep(120)
      const setOk = await this.typeText(searchControl, candidate)
      await this.sleep(250)
      if (!setOk) continue
      this.pressEnter()
      await this.sleep(1000)

      const openedTitle = this.getWindowTitle(mainWindow)
      const openedMatches = targetCandidates.some(item => item && openedTitle.includes(item))
      if (!openedMatches) {
        continue
      }

      searchOk = true
      break
    }

    if (!searchOk) {
      return { success: false, error: '未能直接定位到对应联系人，请检查联系人名称是否可被微信搜索命中', steps: [...steps, 'search-missing'] }
    }

    this.focusWindow(mainWindow)
    await this.sleep(250)

    const childrenAfterSearch = this.collectChildWindows(mainWindow)
    const composerControl = this.pickComposerControl(childrenAfterSearch)
    if (composerControl) {
      this.focusWindow(composerControl.hWnd)
      await this.sleep(120)
      const setOk = await this.typeText(composerControl, message)
      if (setOk) {
        await this.sleep(180)
        if (autoSend) {
          this.pressEnter()
          await this.sleep(250)
        }
        return { success: true, targetUsed, sent: autoSend, opened: true, steps }
      }
    }

    return { success: false, error: '未找到微信输入框，无法直接输入发送', steps: [...steps, 'composer-missing'] }
  }
}

export const wechatRpaService = new WechatRpaService()
