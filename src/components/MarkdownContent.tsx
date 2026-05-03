import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import './MarkdownContent.scss'

interface MarkdownContentProps {
  children: string
  compact?: boolean
}

const components: Components = {
  h1: ({ children, ...props }) => <h2 className="md-h1" {...props}>{children}</h2>,
  h2: ({ children, ...props }) => <h3 className="md-h2" {...props}>{children}</h3>,
  h3: ({ children, ...props }) => <h4 className="md-h3" {...props}>{children}</h4>,
  p: ({ children, ...props }) => <p className="md-p" {...props}>{children}</p>,
  ul: ({ children, ...props }) => <ul className="md-ul" {...props}>{children}</ul>,
  ol: ({ children, ...props }) => <ol className="md-ol" {...props}>{children}</ol>,
  li: ({ children, ...props }) => <li className="md-li" {...props}>{children}</li>,
  strong: ({ children, ...props }) => <strong className="md-strong" {...props}>{children}</strong>,
  em: ({ children, ...props }) => <em className="md-em" {...props}>{children}</em>,
  code: ({ className, children, ...props }: any) => {
    const isBlock = className?.startsWith('language-')
    if (isBlock) {
      return (
        <pre className="md-code-block">
          <code className={className} {...props}>{children}</code>
        </pre>
      )
    }
    return <code className="md-code-inline" {...props}>{children}</code>
  },
  pre: ({ children, ...props }) => <pre className="md-pre" {...props}>{children}</pre>,
  blockquote: ({ children, ...props }) => <blockquote className="md-quote" {...props}>{children}</blockquote>,
  table: ({ children, ...props }) => (
    <div className="md-table-wrap">
      <table className="md-table" {...props}>{children}</table>
    </div>
  ),
  th: ({ children, ...props }) => <th className="md-th" {...props}>{children}</th>,
  td: ({ children, ...props }) => <td className="md-td" {...props}>{children}</td>,
  hr: (props) => <hr className="md-hr" {...props} />,
  a: ({ children, href, ...props }) => (
    <a className="md-link" href={href} target="_blank" rel="noreferrer" {...props}>{children}</a>
  ),
}

function MarkdownContent({ children, compact }: MarkdownContentProps) {
  if (!children) return null

  return (
    <div className={`markdown-content ${compact ? 'compact' : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownContent
