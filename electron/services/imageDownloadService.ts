import { join } from 'path'
import { existsSync } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { isElectronAppPackaged } from './electronRuntime'

const execFileAsync = promisify(execFile)

const SUPPORTED = (process.platform === 'win32' && process.arch === 'x64')
  || (process.platform === 'darwin')

export class ImageDownloadService {
  private static instance: ImageDownloadService
  private koffi: any = null
  private lib: any = null
  private initialized = false

  private initImgHelper: any = null
  private uninstallImgHelper: any = null
  private getImgHelperError: any = null

  private currentPid: number | null = null
  private pollTimer: NodeJS.Timeout | null = null
  private isHooked = false

  private lastWhitelist: string[] = []

  static getInstance(): ImageDownloadService {
    if (!ImageDownloadService.instance) {
      ImageDownloadService.instance = new ImageDownloadService()
    }
    return ImageDownloadService.instance
  }

  private constructor() {
  }

  private async ensureInitialized(): Promise<boolean> {
    if (this.initialized) return true
    if (!SUPPORTED) return false

    try {
      this.koffi = require('koffi')
      const libPath = this.getLibPath()
      if (!existsSync(libPath)) return false

      this.lib = this.koffi.load(libPath)

      this.initImgHelper = this.lib.func('bool InitImgHelper(uint32, const char*)')
      this.uninstallImgHelper = this.lib.func('void UninstallImgHelper()')
      this.getImgHelperError = this.lib.func('const char* GetImgHelperError()')

      this.initialized = true
      return true
    } catch (error) {
      console.error('[ImageDownloadService] failed to initialize:', error)
      return false
    }
  }

  private getLibPath(): string {
    const isPackaged = isElectronAppPackaged()
    const candidates: string[] = []

    if (process.platform === 'darwin') {
      const dylibName = 'img_helper.dylib'
      if (isPackaged) {
        candidates.push(join(process.resourcesPath, 'resources', 'image', 'macos', 'universal', dylibName))
        candidates.push(join(process.resourcesPath, 'resources', 'image', 'macos', dylibName))
      } else {
        candidates.push(join(process.cwd(), 'resources', 'image', 'macos', 'universal', dylibName))
        candidates.push(join(process.cwd(), 'resources', 'image', 'macos', dylibName))
      }
    } else {
      // Windows
      if (isPackaged) {
        candidates.push(join(process.resourcesPath, 'resources', 'image', 'win32', 'x64', 'img_helper.dll'))
      } else {
        candidates.push(join(process.cwd(), 'resources', 'image', 'win32', 'x64', 'img_helper.dll'))
      }
    }

    for (const p of candidates) {
      if (existsSync(p)) return p
    }
    return candidates[0]
  }

  private async findMainWeChatPid(): Promise<number | null> {
    if (process.platform === 'darwin') {
      return this.findWeChatPidMacOS()
    }
    return this.findWeChatPidWindows()
  }

  private async findWeChatPidMacOS(): Promise<number | null> {
    try {
      // 使用 pgrep 查找微信进程
      const { stdout } = await execFileAsync('pgrep', ['-f', 'WeChat'])
      if (!stdout || !stdout.trim()) return null

      const pids = stdout.trim().split('\n').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0)
      if (pids.length === 0) return null

      // 检查每个 PID 的完整路径，确保是 WeChat.app 而非其他
      for (const pid of pids) {
        try {
          const { stdout: pathOut } = await execFileAsync('ps', ['-p', String(pid), '-o', 'comm='])
          const name = pathOut.trim()
          if (name === 'WeChat' || name === 'WeChatAppEx') {
            return pid
          }
        } catch {
          continue
        }
      }

      // 回退：返回第一个 PID
      return pids[0]
    } catch {
      // pgrep 不可用时使用 ps
      try {
        const { stdout } = await execFileAsync('ps', ['-eo', 'pid,comm', '-c'])
        if (!stdout) return null
        const lines = stdout.split('\n')
        for (const line of lines) {
          const parts = line.trim().split(/\s+/)
          if (parts.length >= 2 && parts[1] === 'WeChat') {
            const pid = parseInt(parts[0], 10)
            if (!isNaN(pid) && pid > 0) return pid
          }
        }
        return null
      } catch {
        return null
      }
    }
  }

  private async findWeChatPidWindows(): Promise<number | null> {
    try {
      const script = `
      Get-CimInstance Win32_Process -Filter "Name = 'Weixin.exe'" |
      Select-Object ProcessId, CommandLine |
      ConvertTo-Json -Compress
    `;

      const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', script])
      if (!stdout || !stdout.trim()) return null

      let processes = JSON.parse(stdout.trim())
      if (!Array.isArray(processes)) processes = [processes]

      const target = processes
          .filter((p: any) => p.CommandLine && p.CommandLine.toLowerCase().includes('weixin.exe'))
          .sort((a: any, b: any) => a.CommandLine.length - b.CommandLine.length)[0]

      return target ? target.ProcessId : null;
    } catch (e) {
      return null
    }
  }

  async startAutoDownload(whitelist: string[] | string = []): Promise<{ success: boolean; error?: string }> {
    if (!await this.ensureInitialized()) {
      const reason = !SUPPORTED
        ? `当前平台不支持 (${process.platform} ${process.arch})`
        : '核心组件初始化失败'
      return { success: false, error: reason }
    }

    if (this.isHooked) {
      await this.unhook()
    }

    this.lastWhitelist = whitelist

    if (!this.pollTimer) {
      this.pollTimer = setInterval(() => this.checkAndHook(this.lastWhitelist, false), 30000)
    }

    return await this.checkAndHook(whitelist, true)
  }

  async stopAutoDownload() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    await this.unhook()
  }

  private async checkAndHook(whitelist: string[] | string = [], isManualStart = false): Promise<{ success: boolean; error?: string }> {
    const pid = await this.findMainWeChatPid()

    if (!pid) {
      if (this.isHooked) {
        console.log('[ImageDownloadService] WeChat exited, unhooking')
        await this.unhook()
      }
      return { success: true, error: '等待微信启动' }
    }

    if (this.isHooked && this.currentPid === pid) {
      return { success: true }
    }

    if (this.isHooked && this.currentPid !== pid) {
      console.log('[ImageDownloadService] WeChat PID changed, re-hooking')
      await this.unhook()
    }

    console.log(`[ImageDownloadService] attempting to hook PID: ${pid}`)
    try {
      let whitelistBuffer: Buffer | null = null;
      if (typeof whitelist === 'string') {
        if (whitelist.length > 0) {
          whitelistBuffer = Buffer.from(whitelist, 'utf8');
        }
      } else if (Array.isArray(whitelist) && whitelist.length > 0) {
        whitelistBuffer = Buffer.from(whitelist.join('\0') + '\0\0', 'utf8');
      }

      const success = this.initImgHelper(pid, whitelistBuffer)

      if (success) {
        this.isHooked = true
        this.currentPid = pid
        console.log('[ImageDownloadService] hook successful')
        return { success: true }
      } else {
        const err = this.getImgHelperError()
        console.error(`[ImageDownloadService] hook failed: ${err}`)
        if (isManualStart && this.pollTimer) {
          clearInterval(this.pollTimer)
          this.pollTimer = null
        }
        return { success: false, error: err || 'Hook 失败' }
      }
    } catch (e: any) {
      console.error('[ImageDownloadService] InitImgHelper call crashed:', e)
      if (isManualStart && this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
      return { success: false, error: `调用异常: ${e.message || String(e)}` }
    }
  }

  private async unhook() {
    if (this.isHooked && this.uninstallImgHelper) {
      try {
        this.uninstallImgHelper()
      } catch (e) {
        console.error('[ImageDownloadService] uninstall failed:', e)
      }
    }
    this.isHooked = false
    this.currentPid = null
  }

  async getStatus() {
    return {
      isHooked: this.isHooked,
      pid: this.currentPid,
      supported: SUPPORTED
    }
  }
}

export const imageDownloadService = ImageDownloadService.getInstance()
