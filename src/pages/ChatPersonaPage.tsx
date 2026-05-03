import { useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronDown, ChevronUp, Loader2, Sparkles, Copy, Check, RotateCcw, Send, User } from 'lucide-react'
import MarkdownContent from '../components/MarkdownContent'
import './ChatPersonaPage.scss'

const DEFAULT_PROMPT = `# 角色定义
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

function ChatPersonaPage() {
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const sessionId = sp.get('sessionId') || ''
  const sessionName = sp.get('sessionName') || '未知联系人'

  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const analyze = useCallback(async () => {
    if (!sessionId) { setError('缺少会话信息'); return }
    setLoading(true); setError(null); setResult('')
    try {
      const r = await window.electronAPI.ai.analyzeChat({ sessionId, prompt, analysisType: 'persona' })
      if (r.success && r.data) setResult(r.data.content)
      else setError(r.error || '分析失败')
    } catch (e: any) { setError(e.message || '异常') }
    finally { setLoading(false) }
  }, [sessionId, prompt])

  const copy = useCallback(() => {
    if (!result) return
    const ta = document.createElement('textarea'); ta.value = result
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }, [result])

  return (
    <div className="chat-persona-page">
      <div className="persona-header">
        <button className="back-btn" onClick={() => navigate(-1)}><ChevronLeft size={18}/><span>返回</span></button>
        <div className="header-info"><h2>人物画像</h2><span className="sub">{sessionName}</span></div>
      </div>
      <div className="persona-content">
        <div className="prompt-section">
          <div className="prompt-header">
            <button className="prompt-expand-btn" onClick={() => setExpanded(!expanded)}>
              <h3><Sparkles size={16}/><span>画像分析提示词</span></h3>
              {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            </button>
            <button className="reset-btn" onClick={() => setPrompt(DEFAULT_PROMPT)} title="恢复默认提示词">
              <RotateCcw size={14}/>
            </button>
          </div>
          {expanded ? (
            <textarea className="prompt-textarea" value={prompt} onChange={e => setPrompt(e.target.value)} rows={12}/>
          ) : (
            <div className="prompt-preview" onClick={() => setExpanded(true)}>{prompt.slice(0, 160)}{prompt.length > 160 ? '...' : ''}</div>
          )}
        </div>
        <div className="action-bar">
          <button className="analyze-btn" onClick={analyze} disabled={loading||!sessionId}>
            {loading ? <><Loader2 size={18} style={{ animation: 'persona-spin 1s linear infinite' }}/>AI 画像分析中...</> : <><Send size={18}/>开始画像分析</>}
          </button>
        </div>
        {error && <div className="error-msg"><p>{error}</p></div>}
        {result && (
          <div className="result-section">
            <div className="result-header"><h3>人物画像</h3><button className="copy-btn" onClick={copy}>{copied?<Check size={16}/>:<Copy size={16}/>}{copied?'已复制':'复制结果'}</button></div>
            <div className="result-content"><MarkdownContent>{result}</MarkdownContent></div>
          </div>
        )}
        {!result && !loading && !error && (
          <div className="empty-state"><User size={48} strokeWidth={1}/><h3>点击「开始画像分析」对当前联系人进行人物画像</h3><p>AI 将从人口学特征、大五人格、深层价值观等七个维度进行系统性深度画像</p></div>
        )}
      </div>
    </div>
  )
}
export default ChatPersonaPage
