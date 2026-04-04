import { useCallback, useRef } from 'react';
import { streamChat, sendChat, ChatMessage, ChatSource, FileChange, RenameChange, DeleteChange, CreateDir, DeleteDir, ListDir, ListSubdirs, ListTree, SearchFiles, CommandSuggestion } from '../api';
import useChatTabStore, { ChatTabMessage } from '../../stores/chat-tab-store';

function formatElapsed(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return sec > 0 ? `${min}min ${sec}s` : `${min}min`;
}

const WRITE_FILE_REGEX = /<write_file\s+path="([^"]+)">([\s\S]*?)<\/write_file>/g;
const RENAME_FILE_REGEX = /<rename(?:_file)?\s+(?:from="|file=")([^"]+)"(?:\s+to="|"\s+to=")([^"]+)"\s*\/?>/g;
const DELETE_FILE_REGEX = /<delete_file\s+path="([^"]+)"\s*\/?>/g;
const LIST_DIR_REGEX = /<list_dir\s+path="([^"]+)"\s*\/?>/g;
const LIST_SUBDIRS_REGEX = /<list_subdirs\s+path="([^"]+)"\s*\/?>/g;
const LIST_TREE_REGEX = /<list_tree\s+path="([^"]+)"\s*\/?>/g;
const CREATE_DIR_REGEX = /<create_dir\s+path="([^"]+)"\s*\/?>/g;
const DELETE_DIR_REGEX = /<delete_dir\s+path="([^"]+)"\s*\/?>/g;
const SEARCH_FILES_REGEX = /<search_files\s+path="([^"]+)"\s+query="([^"]+)"\s*\/?>/g;
const RUN_COMMAND_REGEX = /<run_command(?:\s+cwd="([^"]*)")?(?:\s+description="([^"]*)")?\s*>([\s\S]*?)<\/run_command>/g;

function normalizeAIOutput(raw: string): string {
  let result = raw;
  result = result.replace(/<run\s+command="mv\s+([^\s"]+)\s+([^\s"]+)"\s*\/?>/g, '<rename_file from="$1" to="$2" />');
  result = result.replace(/<run_command(?:\s+[^>]*)?>[\s]*mv\s+([^\s]+)\s+([^\s<]+)[\s]*<\/run_command>/g, '<rename_file from="$1" to="$2" />');
  result = result.replace(/<code>mv\s+([^\s<]+)\s+([^\s<]+)<\/code>/g, '<rename_file from="$1" to="$2" />');
  result = result.replace(/`mv\s+([^\s`]+)\s+([^\s`]+)`/g, '<rename_file from="$1" to="$2" />');
  result = result.replace(/<run\s+command="rm\s+(?:-[rf]+\s+)?([^\s"]+)"\s*\/?>/g, '<delete_file path="$1" />');
  result = result.replace(/<run_command(?:\s+[^>]*)?>[\s]*rm\s+(?:-[rf]+\s+)?([^\s<]+)[\s]*<\/run_command>/g, '<delete_file path="$1" />');
  result = result.replace(/<run\s+command="mkdir\s+(?:-p\s+)?([^\s"]+)"\s*\/?>/g, '<create_dir path="$1" />');
  result = result.replace(/<run_command(?:\s+[^>]*)?>[\s]*mkdir\s+(?:-p\s+)?([^\s<]+)[\s]*<\/run_command>/g, '<create_dir path="$1" />');
  result = result.replace(/<delete\s+path="([^"]+)"\s*\/?>/g, '<delete_file path="$1" />');
  result = result.replace(/<move(?:_file)?\s+from="([^"]+)"\s+to="([^"]+)"\s*\/?>/g, '<rename_file from="$1" to="$2" />');
  result = result.replace(/<create\s+path="([^"]+)"\s*\/?>/g, '<create_dir path="$1" />');
  result = result.replace(/<(?:ls|list)\s+path="([^"]+)"\s*\/?>/g, '<list_tree path="$1" />');
  return result;
}

function parseStreamedContent(raw: string) {
  raw = normalizeAIOutput(raw);
  const fileChanges: FileChange[] = [];
  const renames: RenameChange[] = [];
  const deletes: DeleteChange[] = [];
  const createDirs: CreateDir[] = [];
  const deleteDirs: DeleteDir[] = [];
  const listDirs: ListDir[] = [];
  const listSubdirs: ListSubdirs[] = [];
  const listTrees: ListTree[] = [];
  const searchFiles: SearchFiles[] = [];
  const commands: CommandSuggestion[] = [];
  let match: RegExpExecArray | null;

  WRITE_FILE_REGEX.lastIndex = 0;
  while ((match = WRITE_FILE_REGEX.exec(raw)) !== null) {
    fileChanges.push({ path: match[1].trim(), content: match[2].replace(/^\n/, '').replace(/\n$/, '') });
  }
  RENAME_FILE_REGEX.lastIndex = 0;
  while ((match = RENAME_FILE_REGEX.exec(raw)) !== null) {
    renames.push({ from: match[1].trim(), to: match[2].trim() });
  }
  DELETE_FILE_REGEX.lastIndex = 0;
  while ((match = DELETE_FILE_REGEX.exec(raw)) !== null) {
    deletes.push({ path: match[1].trim() });
  }
  LIST_DIR_REGEX.lastIndex = 0;
  while ((match = LIST_DIR_REGEX.exec(raw)) !== null) {
    listDirs.push({ path: match[1].trim() });
  }
  LIST_SUBDIRS_REGEX.lastIndex = 0;
  while ((match = LIST_SUBDIRS_REGEX.exec(raw)) !== null) {
    listSubdirs.push({ path: match[1].trim() });
  }
  LIST_TREE_REGEX.lastIndex = 0;
  while ((match = LIST_TREE_REGEX.exec(raw)) !== null) {
    listTrees.push({ path: match[1].trim() });
  }
  CREATE_DIR_REGEX.lastIndex = 0;
  while ((match = CREATE_DIR_REGEX.exec(raw)) !== null) {
    createDirs.push({ path: match[1].trim() });
  }
  DELETE_DIR_REGEX.lastIndex = 0;
  while ((match = DELETE_DIR_REGEX.exec(raw)) !== null) {
    deleteDirs.push({ path: match[1].trim() });
  }
  SEARCH_FILES_REGEX.lastIndex = 0;
  while ((match = SEARCH_FILES_REGEX.exec(raw)) !== null) {
    searchFiles.push({ path: match[1].trim(), query: match[2].trim() });
  }
  RUN_COMMAND_REGEX.lastIndex = 0;
  while ((match = RUN_COMMAND_REGEX.exec(raw)) !== null) {
    commands.push({ cwd: match[1]?.trim() || undefined, description: match[2]?.trim() || undefined, command: match[3].trim() });
  }

  WRITE_FILE_REGEX.lastIndex = 0; RENAME_FILE_REGEX.lastIndex = 0;
  DELETE_FILE_REGEX.lastIndex = 0; LIST_DIR_REGEX.lastIndex = 0;
  LIST_SUBDIRS_REGEX.lastIndex = 0; LIST_TREE_REGEX.lastIndex = 0;
  CREATE_DIR_REGEX.lastIndex = 0; DELETE_DIR_REGEX.lastIndex = 0;
  SEARCH_FILES_REGEX.lastIndex = 0; RUN_COMMAND_REGEX.lastIndex = 0;
  const text = raw
    .replace(WRITE_FILE_REGEX, '').replace(RENAME_FILE_REGEX, '')
    .replace(DELETE_FILE_REGEX, '').replace(LIST_DIR_REGEX, '')
    .replace(LIST_SUBDIRS_REGEX, '').replace(LIST_TREE_REGEX, '')
    .replace(CREATE_DIR_REGEX, '').replace(DELETE_DIR_REGEX, '')
    .replace(SEARCH_FILES_REGEX, '').replace(RUN_COMMAND_REGEX, '').trim();

  return { text, fileChanges, renames, deletes, createDirs, deleteDirs, listDirs, listSubdirs, listTrees, searchFiles, commands };
}

export function useChatTab() {
  const activeTabId = useChatTabStore((s) => s.activeTabId);
  const activeTab = useChatTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const messages = activeTab?.messages || [];
  const addTabMessage = useChatTabStore((s) => s.addTabMessage);
  const updateTabMessage = useChatTabStore((s) => s.updateTabMessage);
  const clearTabMessages = useChatTabStore((s) => s.clearTabMessages);
  const removeLastTabMessage = useChatTabStore((s) => s.removeLastTabMessage);
  const setLoadingTab = useChatTabStore((s) => s.setLoadingTab);
  const isLoading = useChatTabStore((s) => s.loadingTabId === s.activeTabId);

  const abortRef = useRef(false);

  const sendMessage = useCallback(async (
    content: string,
    options?: { model?: 'local' | 'claude' | 'auto'; useStream?: boolean; collectionIds?: number[]; ragMinScore?: number; ragTopK?: number }
  ) => {
    const tabId = useChatTabStore.getState().activeTabId;
    const tab = useChatTabStore.getState().tabs.find((t) => t.id === tabId);
    if (!tab || useChatTabStore.getState().loadingTabId) return;

    setLoadingTab(tabId);
    abortRef.current = false;

    const userMessage: ChatTabMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    };

    addTabMessage(tabId, userMessage);

    const currentMessages = useChatTabStore.getState().tabs.find((t) => t.id === tabId)?.messages || [];
    const history: ChatMessage[] = currentMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const projectDir = localStorage.getItem('projectDir') || undefined;

      if (options?.useStream) {
        const assistantId = crypto.randomUUID();
        const streamStartTime = Date.now();
        addTabMessage(tabId, { id: assistantId, role: 'assistant', content: '', isStreaming: true });

        let fullContent = '';
        for await (const chunk of streamChat({
          message: content,
          history,
          model: options?.model || 'auto',
          stream: true,
          projectDir,
          collectionIds: options?.collectionIds,
          ragMinScore: options?.ragMinScore,
          ragTopK: options?.ragTopK,
        })) {
          if (abortRef.current) break;
          fullContent += chunk;
          updateTabMessage(tabId, assistantId, (m) => ({ ...m, content: fullContent }));
        }

        const elapsed = Date.now() - streamStartTime;
        const elapsedText = formatElapsed(elapsed);
        const parsed = parseStreamedContent(fullContent);
        updateTabMessage(tabId, assistantId, (m) => ({
          ...m,
          content: parsed.text + `\n\n<div style="text-align:right;opacity:0.5;font-size:12px">${elapsedText}</div>`,
          isStreaming: false,
          fileChanges: parsed.fileChanges.length ? parsed.fileChanges : undefined,
          renames: parsed.renames.length ? parsed.renames : undefined,
          deletes: parsed.deletes.length ? parsed.deletes : undefined,
          createDirs: parsed.createDirs.length ? parsed.createDirs : undefined,
          deleteDirs: parsed.deleteDirs.length ? parsed.deleteDirs : undefined,
          listDirs: parsed.listDirs.length ? parsed.listDirs : undefined,
          listSubdirs: parsed.listSubdirs.length ? parsed.listSubdirs : undefined,
          listTrees: parsed.listTrees.length ? parsed.listTrees : undefined,
          searchFiles: parsed.searchFiles.length ? parsed.searchFiles : undefined,
          commands: parsed.commands.length ? parsed.commands : undefined,
        }));
      } else {
        const nonStreamStartTime = Date.now();
        const response = await sendChat({
          message: content,
          history,
          model: options?.model || 'auto',
          projectDir,
          collectionIds: options?.collectionIds,
          ragMinScore: options?.ragMinScore,
          ragTopK: options?.ragTopK,
        });
        const nonStreamElapsed = formatElapsed(Date.now() - nonStreamStartTime);

        addTabMessage(tabId, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.response + `\n\n_(${nonStreamElapsed})_`,
          sources: response.sources,
          model: response.model,
          fileChanges: response.fileChanges?.length ? response.fileChanges : undefined,
          renames: response.renames?.length ? response.renames : undefined,
          deletes: response.deletes?.length ? response.deletes : undefined,
          createDirs: response.createDirs?.length ? response.createDirs : undefined,
          deleteDirs: response.deleteDirs?.length ? response.deleteDirs : undefined,
          listDirs: response.listDirs?.length ? response.listDirs : undefined,
          listSubdirs: response.listSubdirs?.length ? response.listSubdirs : undefined,
          listTrees: response.listTrees?.length ? response.listTrees : undefined,
          searchFiles: response.searchFiles?.length ? response.searchFiles : undefined,
          commands: response.commands?.length ? response.commands : undefined,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao enviar mensagem';
      removeLastTabMessage(tabId);
      throw new Error(msg);
    } finally {
      setLoadingTab(null);
    }
  }, [addTabMessage, updateTabMessage, removeLastTabMessage, setLoadingTab]);

  const clearMessages = useCallback(() => {
    clearTabMessages(activeTabId);
  }, [activeTabId, clearTabMessages]);

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { messages, isLoading, sendMessage, clearMessages, abort };
}
