import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Loader2, Sparkles, Copy, Check, Send } from 'lucide-react'
import * as configService from '../services/config'
import MarkdownContent from '../components/MarkdownContent'
import './ChatInsightPage.scss'

const DEFAULT_PROMPT = `# 角色定义
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

function ChatInsightPage() {
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const sessionId = sp.get('sessionId') || ''
  const sessionName = sp.get('sessionName') || '未知会话'
  const isGroup = sp.get('isGroup') === '1'

  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    (async () => {
      const saved = await configService.getAiInsightAnalysisPrompt()
      if (saved) setPrompt(saved)
    })()
  }, [])

  const analyze = useCallback(async () => {
    if (!sessionId) { setError('缺少会话信息'); return }
    setLoading(true); setError(null); setResult('')
    try {
      const r = await window.electronAPI.ai.analyzeChat({ sessionId, prompt, analysisType: 'insight', isGroup })
      if (r.success && r.data) setResult(r.data.content)
      else setError(r.error || '分析失败')
    } catch (e: any) { setError(e.message || '异常') }
    finally { setLoading(false) }
  }, [sessionId, prompt, isGroup])

  const copy = useCallback(() => {
    if (!result) return
    const ta = document.createElement('textarea'); ta.value = result
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }, [result])

  return (
    <div className="chat-insight-page">
      <div className="insight-header">
        <button className="back-btn" onClick={() => navigate(-1)}><ChevronLeft size={18}/><span>返回</span></button>
        <div className="header-info"><h2>洞察分析</h2><span className="sub">{sessionName}{isGroup?' (群聊)':''}</span></div>
      </div>
      <div className="insight-content">
        <div className="action-bar">
          <button className="analyze-btn" onClick={analyze} disabled={loading||!sessionId}>
            {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }}/>AI 分析中...</> : <><Send size={18}/>开始分析</>}
          </button>
        </div>
        {error && <div className="error-msg"><p>{error}</p></div>}
        {result && (
          <div className="result-section">
            <div className="result-header"><h3>分析结果</h3><button className="copy-btn" onClick={copy}>{copied?<Check size={16}/>:<Copy size={16}/>}{copied?'已复制':'复制结果'}</button></div>
            <div className="result-content"><MarkdownContent>{result}</MarkdownContent></div>
          </div>
        )}
        {!result && !loading && !error && (
          <div className="empty-state"><Sparkles size={48} strokeWidth={1}/><h3>点击「开始分析」对当前会话进行洞察分析</h3><p>AI 将从关系阶段、互动模式、情感温度等六个维度进行系统性深度分析</p></div>
        )}
      </div>
    </div>
  )
}
export default ChatInsightPage
