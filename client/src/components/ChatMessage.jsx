import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Code block with a copy button, used inside markdown rendering. */
function CodeBlock({ inline, className, children }) {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, '');
  const lang = /language-(\w+)/.exec(className || '')?.[1];

  if (inline) {
    return <code className={className}>{children}</code>;
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="relative group my-2 rounded-lg overflow-hidden border border-base-300">
      <div className="flex items-center justify-between bg-base-300 px-3 py-1.5 text-xs">
        <span className="opacity-60 font-mono">{lang || 'code'}</span>
        <button onClick={copy} className="btn btn-ghost btn-xs">
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="bg-base-300/50 p-3 overflow-x-auto text-sm">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

/** One chat message bubble (user or assistant) with markdown + sources. */
export default function ChatMessage({ role, content, sources, streaming }) {
  const [copied, setCopied] = useState(false);
  const isUser = role === 'user';

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className={`chat ${isUser ? 'chat-end' : 'chat-start'} animate-fade-in`}>
      <div className="chat-image avatar placeholder">
        <div className={`w-8 rounded-full ${isUser ? 'bg-secondary text-secondary-content' : 'bg-primary text-primary-content'}`}>
          <span className="text-xs font-bold">{isUser ? 'You' : 'AI'}</span>
        </div>
      </div>

      <div
        className={`chat-bubble max-w-[85%] md:max-w-[75%] ${
          isUser ? 'chat-bubble-secondary' : 'bg-base-200 text-base-content'
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className={`prose-chat text-sm md:text-base ${streaming ? 'streaming-cursor' : ''}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>
              {content}
            </ReactMarkdown>
          </div>
        )}

        {/* Source citations */}
        {!isUser && sources?.length > 0 && (
          <div className="mt-3 pt-2 border-t border-base-300">
            <p className="text-xs font-semibold opacity-60 mb-1.5">Sources</p>
            <div className="flex flex-wrap gap-1.5">
              {sources.map((s, i) => (
                <span
                  key={i}
                  className="badge badge-outline badge-sm gap-1"
                  title={`Relevance: ${s.score ?? '—'}`}
                >
                  📄 {s.filename} · p.{s.pageNumber}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {!isUser && !streaming && content && (
        <div className="chat-footer mt-1">
          <button onClick={copyMessage} className="btn btn-ghost btn-xs opacity-60">
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  );
}
