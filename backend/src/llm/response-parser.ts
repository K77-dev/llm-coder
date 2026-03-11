export interface ParsedResponse {
  text: string;
  codeBlocks: CodeBlock[];
  fileChanges: FileChange[];
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
const RUN_COMMAND_REGEX = /<run_command(?:\s+cwd="([^"]*)")?(?:\s+description="([^"]*)")?\s*>([\s\S]*?)<\/run_command>/g;

export function parseResponse(raw: string): ParsedResponse {
  const codeBlocks: CodeBlock[] = [];
  const fileChanges: FileChange[] = [];
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
    .replace(RUN_COMMAND_REGEX, '')
    .trim();

  return {
    text: cleanText,
    codeBlocks,
    fileChanges,
    commands,
    language: codeBlocks[0]?.language,
  };
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}
