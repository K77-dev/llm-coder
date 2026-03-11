export interface RenameChange {
  from: string;
  to: string;
}

export interface DeleteChange {
  path: string;
}

export interface ListDir {
  path: string;
}

export interface ListSubdirs {
  path: string;
}

export interface SearchFiles {
  path: string;
  query: string;
}

export interface ListTree {
  path: string;
}

export interface CreateDir {
  path: string;
}

export interface DeleteDir {
  path: string;
}

export interface ParsedResponse {
  text: string;
  codeBlocks: CodeBlock[];
  fileChanges: FileChange[];
  renames: RenameChange[];
  deletes: DeleteChange[];
  createDirs: CreateDir[];
  deleteDirs: DeleteDir[];
  listDirs: ListDir[];
  listSubdirs: ListSubdirs[];
  listTrees: ListTree[];
  searchFiles: SearchFiles[];
  commands: CommandSuggestion[];
  language?: string;
}

export interface CodeBlock {
  language: string;
  code: string;
}

export interface FileChange {
  path: string;
  content: string;
}

export interface CommandSuggestion {
  command: string;
  cwd?: string;
  description?: string;
}

const CODE_BLOCK_REGEX = /```(\w+)?\n([\s\S]*?)```/g;
const WRITE_FILE_REGEX = /<write_file\s+path="([^"]+)">([\s\S]*?)<\/write_file>/g;
const RENAME_FILE_REGEX = /<rename_file\s+from="([^"]+)"\s+to="([^"]+)"\s*\/?>/g;
const DELETE_FILE_REGEX = /<delete_file\s+path="([^"]+)"\s*\/?>/g;
const LIST_DIR_REGEX = /<list_dir\s+path="([^"]+)"\s*\/?>/g;
const LIST_SUBDIRS_REGEX = /<list_subdirs\s+path="([^"]+)"\s*\/?>/g;
const LIST_TREE_REGEX = /<list_tree\s+path="([^"]+)"\s*\/?>/g;
const CREATE_DIR_REGEX = /<create_dir\s+path="([^"]+)"\s*\/?>/g;
const DELETE_DIR_REGEX = /<delete_dir\s+path="([^"]+)"\s*\/?>/g;
const SEARCH_FILES_REGEX = /<search_files\s+path="([^"]+)"\s+query="([^"]+)"\s*\/?>/g;
const RUN_COMMAND_REGEX = /<run_command(?:\s+cwd="([^"]*)")?(?:\s+description="([^"]*)")?\s*>([\s\S]*?)<\/run_command>/g;

export function parseResponse(raw: string): ParsedResponse {
  const codeBlocks: CodeBlock[] = [];
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

  while ((match = CODE_BLOCK_REGEX.exec(raw)) !== null) {
    codeBlocks.push({
      language: match[1] || 'plaintext',
      code: match[2].trim(),
    });
  }

  while ((match = WRITE_FILE_REGEX.exec(raw)) !== null) {
    fileChanges.push({
      path: match[1].trim(),
      content: match[2].replace(/^\n/, '').replace(/\n$/, ''),
    });
  }

  while ((match = RENAME_FILE_REGEX.exec(raw)) !== null) {
    renames.push({ from: match[1].trim(), to: match[2].trim() });
  }

  while ((match = DELETE_FILE_REGEX.exec(raw)) !== null) {
    deletes.push({ path: match[1].trim() });
  }

  while ((match = LIST_DIR_REGEX.exec(raw)) !== null) {
    listDirs.push({ path: match[1].trim() });
  }

  while ((match = LIST_SUBDIRS_REGEX.exec(raw)) !== null) {
    listSubdirs.push({ path: match[1].trim() });
  }

  while ((match = LIST_TREE_REGEX.exec(raw)) !== null) {
    listTrees.push({ path: match[1].trim() });
  }

  while ((match = CREATE_DIR_REGEX.exec(raw)) !== null) {
    createDirs.push({ path: match[1].trim() });
  }

  while ((match = DELETE_DIR_REGEX.exec(raw)) !== null) {
    deleteDirs.push({ path: match[1].trim() });
  }

  while ((match = SEARCH_FILES_REGEX.exec(raw)) !== null) {
    searchFiles.push({ path: match[1].trim(), query: match[2].trim() });
  }

  while ((match = RUN_COMMAND_REGEX.exec(raw)) !== null) {
    commands.push({
      cwd: match[1]?.trim() || undefined,
      description: match[2]?.trim() || undefined,
      command: match[3].trim(),
    });
  }

  // Remove structured tags from displayed text
  const cleanText = raw
    .replace(WRITE_FILE_REGEX, '')
    .replace(RENAME_FILE_REGEX, '')
    .replace(DELETE_FILE_REGEX, '')
    .replace(CREATE_DIR_REGEX, '')
    .replace(DELETE_DIR_REGEX, '')
    .replace(LIST_DIR_REGEX, '')
    .replace(LIST_SUBDIRS_REGEX, '')
    .replace(LIST_TREE_REGEX, '')
    .replace(SEARCH_FILES_REGEX, '')
    .replace(RUN_COMMAND_REGEX, '')
    .trim();

  return {
    text: cleanText,
    codeBlocks,
    fileChanges,
    renames,
    deletes,
    createDirs,
    deleteDirs,
    listDirs,
    listSubdirs,
    listTrees,
    searchFiles,
    commands,
    language: codeBlocks[0]?.language,
  };
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
