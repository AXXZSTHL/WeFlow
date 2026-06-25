import * as https from 'https'
import * as http from 'http'
import * as crypto from 'crypto'

const FEISHU_API_HOST = 'open.feishu.cn'
const OAUTH_LOCAL_PORT = 27123

const LOG_PREFIX = '[FeishuService]'

function log(msg: string, data?: any) {
  const timestamp = new Date().toISOString()
  if (data !== undefined) {
    console.log(`${LOG_PREFIX} ${timestamp} ${msg}`, typeof data === 'object' ? JSON.stringify(data).slice(0, 2000) : data)
  } else {
    console.log(`${LOG_PREFIX} ${timestamp} ${msg}`)
  }
}

function httpsRequest(options: {
  method: string
  path: string
  body?: unknown
  token?: string
  basicAuth?: string
  label?: string
}): Promise<{ status: number; data: any }> {
  const label = options.label || options.path
  log(`>>> ${options.method} ${options.path} [${label}] token=${options.token ? options.token.slice(0, 12) + '...' : 'none'} basicAuth=${options.basicAuth ? 'yes' : 'no'}`, options.body ? { ...options.body as any, app_secret: (options.body as any)?.app_secret ? '***' : undefined } : undefined)

  return new Promise((resolve, reject) => {
    const bodyStr = options.body ? JSON.stringify(options.body) : ''
    const headers: Record<string, string> = {
      'Content-Type': 'application/json; charset=utf-8',
    }
    if (options.basicAuth) {
      headers['Authorization'] = `Basic ${options.basicAuth}`
    } else if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`
    }
    if (bodyStr) {
      headers['Content-Length'] = String(Buffer.byteLength(bodyStr))
    }

    const req = https.request({
      hostname: FEISHU_API_HOST,
      path: options.path,
      method: options.method,
      headers,
      timeout: 30000,
    }, (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk.toString() })
      res.on('end', () => {
        log(`<<< ${options.method} ${options.path} [${label}] status=${res.statusCode}`, data.slice(0, 500))
        try {
          resolve({ status: res.statusCode || 0, data: JSON.parse(data) })
        } catch {
          resolve({ status: res.statusCode || 0, data })
        }
      })
    })

    req.on('error', (err) => {
      log(`!!! ERROR ${options.method} ${options.path} [${label}]: ${err.message}`)
      reject(new Error(`网络请求失败: ${err.message}`))
    })
    req.on('timeout', () => {
      log(`!!! TIMEOUT ${options.method} ${options.path} [${label}]`)
      req.destroy()
      reject(new Error('请求超时'))
    })

    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

export interface FeishuConfig {
  appId: string
  appSecret: string
  folderToken?: string
}

/**
 * 获取 tenant_access_token（仅需 App ID + Secret，无需用户授权）
 */
export async function getTenantAccessToken(appId: string, appSecret: string): Promise<string> {
  log('获取 Tenant Access Token')
  const { status, data } = await httpsRequest({
    method: 'POST',
    path: '/open-apis/auth/v3/tenant_access_token/internal',
    body: { app_id: appId, app_secret: appSecret },
    label: 'getTenantToken',
  })
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`获取 tenant_access_token 失败 (code=${data.code}): ${data.msg || status}`)
  }
  log('Tenant Token 获取成功', { tokenPrefix: data.tenant_access_token.slice(0, 10) })
  return data.tenant_access_token
}

/**
 * 生成 OAuth 授权 URL
 * 用户需要在飞书应用后台添加重定向 URL: http://127.0.0.1:27123/callback
 */
export function getOAuthUrl(appId: string, state: string): string {
  const redirectUri = encodeURIComponent(`http://127.0.0.1:${OAUTH_LOCAL_PORT}/callback`)
  return `https://${FEISHU_API_HOST}/open-apis/authen/v1/authorize?app_id=${appId}&redirect_uri=${redirectUri}&state=${state}&scope=docx:document`
}

/**
 * 启动本地 HTTP 服务器等待 OAuth 回调，返回授权码
 */
export function startOAuthServer(expectedState: string): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '', `http://127.0.0.1:${OAUTH_LOCAL_PORT}`)
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')

      if (code && state === expectedState) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<html><body style="text-align:center;padding-top:80px;font-family:sans-serif"><h2>授权成功</h2><p>可以关闭此页面回到 weflow</p></body></html>')
        server.close()
        resolve({ code })
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end('<html><body style="text-align:center;padding-top:80px;font-family:sans-serif"><h2>授权失败</h2><p>参数不匹配，请重试</p></body></html>')
      }
    })

    server.on('error', (err) => {
      reject(new Error(`启动 OAuth 回调服务器失败: ${err.message}`))
    })

    server.listen(OAUTH_LOCAL_PORT, '127.0.0.1', () => {
      log(`OAuth 回调服务器已启动: http://127.0.0.1:${OAUTH_LOCAL_PORT}/callback`)
    })

    // 超时 5 分钟
    setTimeout(() => {
      server.close()
      reject(new Error('OAuth 授权超时（5 分钟）'))
    }, 5 * 60 * 1000)
  })
}

/**
 * 用授权码换取 user_access_token
 * POST /open-apis/authen/v1/oidc/access_token
 */
/**
 * 获取 app_access_token
 * POST /open-apis/auth/v3/app_access_token/internal
 */
async function getAppAccessToken(appId: string, appSecret: string): Promise<string> {
  log('获取 App Access Token')
  const { status, data } = await httpsRequest({
    method: 'POST',
    path: '/open-apis/auth/v3/app_access_token/internal',
    body: { app_id: appId, app_secret: appSecret },
    label: 'getAppToken',
  })
  if (data.code !== 0 || !data.app_access_token) {
    throw new Error(`获取 app_access_token 失败 (code=${data.code}): ${data.msg || status}`)
  }
  return data.app_access_token
}

export async function exchangeCodeForToken(
  code: string,
  appId: string,
  appSecret: string
): Promise<{ accessToken: string; refreshToken: string }> {
  log('Step 1: 获取 app_access_token')
  const appAccessToken = await getAppAccessToken(appId, appSecret)

  log('Step 2: 用 app_access_token 换取 user_access_token')
  const { status, data } = await httpsRequest({
    method: 'POST',
    path: '/open-apis/authen/v1/oidc/access_token',
    body: {
      grant_type: 'authorization_code',
      code,
    },
    token: appAccessToken,
    label: 'exchangeCode',
  })

  log('换取 Token 响应', { code: data.code, msg: data.msg || data.message, hasAccessToken: !!data.data?.access_token })

  if (data.code !== 0 || !data.data?.access_token) {
    throw new Error(`换取 user_access_token 失败 (code=${data.code}): ${data.msg || data.message || status}`)
  }

  log('获取 User Token 成功', { tokenPrefix: data.data.access_token.slice(0, 12) })
  return {
    accessToken: data.data.access_token,
    refreshToken: data.data.refresh_token || '',
  }
}

/**
 * 刷新 user_access_token
 * POST /open-apis/authen/v1/oidc/refresh_access_token
 */
export async function refreshUserAccessToken(
  refreshToken: string,
  appId: string,
  appSecret: string
): Promise<{ accessToken: string; refreshToken: string }> {
  log('刷新 User Access Token')
  const appAccessToken = await getAppAccessToken(appId, appSecret)

  const { status, data } = await httpsRequest({
    method: 'POST',
    path: '/open-apis/authen/v1/oidc/refresh_access_token',
    body: {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    },
    token: appAccessToken,
    label: 'refreshToken',
  })

  if (data.code !== 0 || !data.data?.access_token) {
    throw new Error(`刷新 Token 失败 (code=${data.code}): ${data.msg || status}`)
  }

  log('刷新 Token 成功')
  return {
    accessToken: data.data.access_token,
    refreshToken: data.data.refresh_token || refreshToken,
  }
}

async function createDocument(
  title: string,
  folderToken: string | undefined,
  token: string
): Promise<string> {
  const body: Record<string, string> = { title }
  if (folderToken) {
    body.folder_token = folderToken
  }

  log('创建飞书文档', { title, folderToken: folderToken || '(根目录)' })

  const { status, data } = await httpsRequest({
    method: 'POST',
    path: '/open-apis/docx/v1/documents',
    body,
    token,
    label: 'createDocument',
  })

  if (data.code !== 0 || !data.data?.document?.document_id) {
    throw new Error(`创建飞书文档失败 (code=${data.code}): ${data.msg || status}`)
  }

  log('创建文档成功', { documentId: data.data.document.document_id })
  return data.data.document.document_id
}

interface FeishuBlock {
  block_type: number
  [key: string]: any
}

interface FeishuTextElement {
  text_run: {
    content: string
    text_element_style?: {
      bold?: boolean
    }
  }
}

function parseMarkdownToBlocks(markdown: string): FeishuBlock[] {
  const lines = markdown.split('\n')
  const blocks: FeishuBlock[] = []
  let inFrontmatter = false

  for (const line of lines) {
    // 跳过 frontmatter 和空行
    if (line === '---' && blocks.length === 0) {
      inFrontmatter = !inFrontmatter
      continue
    }
    if (inFrontmatter) continue
    if (!line.trim()) continue

    // ## 标题
    const h2Match = line.match(/^##\s+(.+)/)
    if (h2Match) {
      blocks.push({
        block_type: 4,
        heading2: { elements: [{ text_run: { content: h2Match[1].trim() } }] }
      })
      continue
    }

    // # 标题
    const h1Match = line.match(/^#\s+(.+)/)
    if (h1Match) {
      blocks.push({
        block_type: 3,
        heading1: { elements: [{ text_run: { content: h1Match[1].trim() } }] }
      })
      continue
    }

    // > 引用
    const quoteMatch = line.match(/^>\s+(.+)/)
    if (quoteMatch) {
      blocks.push({
        block_type: 15,
        quote: { elements: [{ text_run: { content: quoteMatch[1].trim() } }] }
      })
      continue
    }

    // - 列表项（支持 **加粗**）
    const bulletMatch = line.match(/^-\s+(.*)/)
    if (bulletMatch) {
      const content = bulletMatch[1]
      // 解析 **bold** 语法
      const elements: FeishuTextElement[] = []
      let remaining = content
      const boldRegex = /\*\*(.+?)\*\*/g
      let lastIndex = 0
      let match: RegExpExecArray | null

      while ((match = boldRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
          elements.push({ text_run: { content: content.slice(lastIndex, match.index) } })
        }
        elements.push({ text_run: { content: match[1], text_element_style: { bold: true } } })
        lastIndex = match.index + match[0].length
      }
      if (lastIndex < content.length) {
        elements.push({ text_run: { content: content.slice(lastIndex) } })
      }
      if (elements.length === 0) {
        elements.push({ text_run: { content } })
      }

      blocks.push({
        block_type: 12,
        bullet: { elements }
      })
      continue
    }

    // 普通文本
    blocks.push({
      block_type: 2,
      text: { elements: [{ text_run: { content: line } }] }
    })
  }

  return blocks
}

async function writeBlocksToDocument(
  documentId: string,
  blocks: FeishuBlock[],
  token: string
): Promise<void> {
  const BATCH_SIZE = 50
  const totalBatches = Math.ceil(blocks.length / BATCH_SIZE)

  log(`写入文档: ${blocks.length} 个 block, ${totalBatches} 批`)

  for (let i = 0; i < blocks.length; i += BATCH_SIZE) {
    const batch = blocks.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1

    const { status, data } = await httpsRequest({
      method: 'POST',
      path: `/open-apis/docx/v1/documents/${documentId}/blocks/${documentId}/children?document_revision_id=-1`,
      body: { children: batch, index: -1 },
      token,
      label: `writeBlocks[${batchNum}/${totalBatches}]`,
    })

    if (data.code !== 0) {
      throw new Error(`写入文档失败 (第 ${batchNum}/${totalBatches} 批, code=${data.code}): ${data.msg || status}`)
    }

    log(`第 ${batchNum}/${totalBatches} 批写入成功 (${batch.length} blocks)`)

    if (totalBatches > 1 && i + BATCH_SIZE < blocks.length) {
      await new Promise(resolve => setTimeout(resolve, 400))
    }
  }

  log('文档内容写入完成')
}

export interface FeishuExportConfig {
  userAccessToken: string
  refreshToken?: string
  appId?: string
  appSecret?: string
  folderToken?: string
}

export async function exportChatRecordToFeishu(payload: {
  title: string
  markdown: string
  config: FeishuExportConfig
}): Promise<{ success: boolean; error?: string; documentUrl?: string; newToken?: string; newRefreshToken?: string }> {
  const { title, markdown, config } = payload

  log('======== 导出到飞书 ========')
  log('参数', { title, markdownLen: markdown.length, hasAppId: !!config.appId, hasUserToken: !!config.userAccessToken, folderToken: config.folderToken || '(根目录)' })

  try {
    // 1. 优先尝试 tenant_access_token（仅需 App ID + Secret）
    let token: string
    if (config.appId && config.appSecret) {
      try {
        token = await getTenantAccessToken(config.appId, config.appSecret)
        log('使用 tenant_access_token')
      } catch (e) {
        // tenant token 获取失败，尝试 user token
        log('tenant_access_token 获取失败，尝试 user_access_token')
        if (!config.userAccessToken) throw e
        token = config.userAccessToken
      }
    } else if (config.userAccessToken) {
      token = config.userAccessToken
    } else {
      return { success: false, error: '请在设置中填写飞书 App ID 和 App Secret' }
    }

    const doExport = async (t: string) => {
      const documentId = await createDocument(title, config.folderToken, t)
      const blocks = parseMarkdownToBlocks(markdown)
      await writeBlocksToDocument(documentId, blocks, t)
      return documentId
    }

    let documentId: string
    try {
      documentId = await doExport(token)
    } catch (firstError) {
      const errMsg = firstError instanceof Error ? firstError.message : String(firstError)
      // tenant token 权限不够，降级到 user token
      if ((errMsg.includes('99991672') || errMsg.includes('99991663')) && config.userAccessToken) {
        log('tenant_access_token 权限不足，降级到 user_access_token')
        documentId = await doExport(config.userAccessToken)
      } else if (errMsg.includes('99991663') && config.refreshToken && config.appId && config.appSecret) {
        log('Token 过期，自动刷新')
        const { accessToken, refreshToken: newRt } = await refreshUserAccessToken(config.refreshToken, config.appId, config.appSecret)
        documentId = await doExport(accessToken)
        const docUrl = `https://${FEISHU_API_HOST}/docx/${documentId}`
        log('======== 导出完成（已刷新token） ========', { documentId, docUrl })
        return { success: true, documentUrl: docUrl, newToken: accessToken, newRefreshToken: newRt }
      } else {
        throw firstError
      }
    }

    const docUrl = `https://${FEISHU_API_HOST}/docx/${documentId}`
    log('======== 导出完成 ========', { documentId, docUrl })
    return { success: true, documentUrl: docUrl }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    log('======== 导出失败 ========', { error: errMsg })
    return { success: false, error: errMsg }
  }
}

export async function validateFeishuConfig(config: { userAccessToken: string; folderToken?: string }): Promise<{ success: boolean; error?: string }> {
  try {
    if (!config.userAccessToken) {
      return { success: false, error: '未授权，请先点击"飞书授权"' }
    }
    const documentId = await createDocument('weflow 连接测试', config.folderToken, config.userAccessToken)
    log('验证成功', { documentId })
    return { success: true }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    return { success: false, error: errMsg }
  }
}
