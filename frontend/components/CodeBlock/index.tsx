'use client';

import { useState } from 'react';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language = 'plaintext' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-lg overflow-hidden bg-slate-50 dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-100 dark:bg-neutral-800 border-b border-slate-300 dark:border-neutral-700">
        <span className="text-xs text-slate-500 dark:text-neutral-400 font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white transition-colors opacity-0 group-hover:opacity-100"
        >
          {copied ? 'Copiado!' : 'Copiar'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm">
        <code className={`text-slate-700 dark:text-neutral-300 font-mono language-${language}`}>
          {code}
        </code>
      </pre>
    </div>
  );
}
