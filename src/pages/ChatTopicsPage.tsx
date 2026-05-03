import { useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronDown, ChevronUp, Loader2, Sparkles, Copy, Check, RotateCcw, Send, Hash } from 'lucide-react'
import MarkdownContent from '../components/MarkdownContent'
import './ChatTopicsPage.scss'

const DEFAULT_PROMPT = `# 角色定义
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
5. 小标题 ###，重点 **加粗**，话题名称 \`反引号\`，引用 > 格式`

function ChatTopicsPage() {
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const sessionId = sp.get('sessionId') || ''
  const sessionName = sp.get('sessionName') || '未知会话'
  const isGroup = sp.get('isGroup') === '1'

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
      const r = await window.electronAPI.ai.analyzeChat({ sessionId, prompt, analysisType: 'topics', isGroup })
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
    <div className="chat-topics-page">
      <div className="topics-header">
        <button className="back-btn" onClick={() => navigate(-1)}><ChevronLeft size={18}/><span>返回</span></button>
        <div className="header-info"><h2>话题分析</h2><span className="sub">{sessionName}{isGroup?' (群聊)':''}</span></div>
      </div>
      <div className="topics-content">
        <div className="prompt-section">
          <div className="prompt-header">
            <button className="prompt-expand-btn" onClick={() => setExpanded(!expanded)}>
              <h3><Sparkles size={16}/><span>话题分析提示词</span></h3>
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
            {loading ? <><Loader2 size={18} style={{ animation: 'topics-spin 1s linear infinite' }}/>AI 话题分析中...</> : <><Send size={18}/>开始话题分析</>}
          </button>
        </div>
        {error && <div className="error-msg"><p>{error}</p></div>}
        {result && (
          <div className="result-section">
            <div className="result-header"><h3>话题分析结果</h3><button className="copy-btn" onClick={copy}>{copied?<Check size={16}/>:<Copy size={16}/>}{copied?'已复制':'复制结果'}</button></div>
            <div className="result-content"><MarkdownContent>{result}</MarkdownContent></div>
          </div>
        )}
        {!result && !loading && !error && (
          <div className="empty-state"><Hash size={48} strokeWidth={1}/><h3>点击「开始话题分析」提取当前会话的话题</h3><p>AI 将从话题全景图谱、深度拆解、转换网络等五个维度进行系统性话题挖掘</p></div>
        )}
      </div>
    </div>
  )
}
export default ChatTopicsPage
