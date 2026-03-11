'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '../../lib/hooks/useChat';
import { Message } from './Message';

export function ChatInterface() {
  const { messages, isLoading, error, sendMessage, clearMessages } = useChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const msg = input.trim();
    setInput('');
    await sendMessage(msg, { useStream: true });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-neutral-800">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Code LLM</h1>
          <p className="text-xs text-slate-500 dark:text-neutral-400">Java · Node.js · React · Angular</p>
        </div>
        <button
          onClick={clearMessages}
          className="text-xs text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          Nova conversa
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-4">⚡</div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Como posso ajudar?</h2>
            <p className="text-slate-500 dark:text-neutral-400 text-sm max-w-md">
              Gere código Java/Node.js/React/Angular,
              peça reviews ou ajuda com debugging.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-2 w-full max-w-lg">
              {EXAMPLE_QUERIES.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q, { useStream: true })}
                  className="text-left px-4 py-2 text-sm text-slate-600 dark:text-neutral-300 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <Message key={msg.id} message={msg} />
        ))}

        {error && (
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-neutral-800">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pergunte algo......"
              rows={1}
              className="w-full resize-none bg-slate-100 dark:bg-neutral-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px] max-h-32"
              style={{ height: 'auto' }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
              }}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
          >
            {isLoading ? '...' : 'Enviar'}
          </button>
        </form>
        <div className="mt-2">
          <span className="text-xs text-slate-400 dark:text-neutral-500">Enter para enviar · Shift+Enter para nova linha</span>
        </div>
      </div>
    </div>
  );
}

const EXAMPLE_QUERIES = [
  'Como implementar autenticação JWT em Spring Boot?',
  'Gere um componente React para formulário de login com validação',
  'Como criar um serviço que consome RabbitMQ?',
  'Crie testes unitários para um serviço Node.js',
];
