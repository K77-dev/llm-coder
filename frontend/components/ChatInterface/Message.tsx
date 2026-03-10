'use client';

import ReactMarkdown from 'react-markdown';
import { Message as MessageType } from '../../lib/hooks/useChat';

interface MessageProps {
  message: MessageType;
}

export function Message({ message }: MessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-3`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-1">
          AI
        </div>
      )}

      <div className={`max-w-[85%] ${isUser ? 'order-first' : ''}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-slate-800 text-slate-100 rounded-tl-sm'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const isBlock = match || String(children).includes('\n');
                    if (isBlock) {
                      return (
                        <pre className="bg-slate-900 rounded-lg p-3 overflow-x-auto my-2">
                          <code className={`text-slate-300 text-xs font-mono ${className || ''}`} {...props}>
                            {children}
                          </code>
                        </pre>
                      );
                    }
                    return (
                      <code className="bg-slate-900 text-blue-300 px-1 py-0.5 rounded text-xs font-mono" {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
              {message.isStreaming && (
                <span className="inline-block w-1.5 h-4 bg-blue-400 animate-pulse ml-0.5" />
              )}
            </div>
          )}
        </div>

        {/* Sources */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {message.sources.slice(0, 3).map((s, i) => (
              <span
                key={i}
                className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full border border-slate-700"
                title={`${s.repo}/${s.filePath}`}
              >
                {s.language} · {Math.round(s.score * 100)}%
              </span>
            ))}
          </div>
        )}

        {/* Model indicator */}
        {message.model && (
          <div className="mt-1 text-xs text-slate-500">
            via {message.model === 'claude' ? 'Claude API' : 'Ollama local'}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-1">
          U
        </div>
      )}
    </div>
  );
}
