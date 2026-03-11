import { useState, useCallback, useRef } from 'react';
import { sendChat, streamChat, ChatMessage, ChatSource, FileChange, CommandSuggestion } from '../api';

export interface Message extends ChatMessage {
  id: string;
  sources?: ChatSource[];
  model?: 'local' | 'claude';
  isStreaming?: boolean;
  fileChanges?: FileChange[];
  commands?: CommandSuggestion[];
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<boolean>(false);

  const sendMessage = useCallback(async (
    content: string,
    options?: { model?: 'local' | 'claude' | 'auto'; useStream?: boolean }
  ) => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    abortRef.current = false;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    };

    setMessages((prev) => [...prev, userMessage]);

    const history: ChatMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const projectDir = localStorage.getItem('projectDir') || undefined;

      if (options?.useStream) {
        const assistantId = crypto.randomUUID();
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: 'assistant', content: '', isStreaming: true },
        ]);

        let fullContent = '';
        for await (const chunk of streamChat({
          message: content,
          history,
          model: options?.model || 'auto',
          stream: true,
          projectDir,
        })) {
          if (abortRef.current) break;
          fullContent += chunk;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: fullContent } : m
            )
          );
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          )
        );
      } else {
        const response = await sendChat({
          message: content,
          history,
          model: options?.model || 'auto',
          projectDir,
        });

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: response.response,
            sources: response.sources,
            model: response.model,
            fileChanges: response.fileChanges?.length ? response.fileChanges : undefined,
            commands: response.commands?.length ? response.commands : undefined,
          },
        ]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar mensagem';
      setError(msg);
      setMessages((prev) => prev.slice(0, -1)); // Remove user message on error
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { messages, isLoading, error, sendMessage, clearMessages, abort };
}
