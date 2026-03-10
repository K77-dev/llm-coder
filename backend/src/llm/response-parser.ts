export interface ParsedResponse {
  text: string;
  codeBlocks: CodeBlock[];
  language?: string;
}

export interface CodeBlock {
  language: string;
  code: string;
}

const CODE_BLOCK_REGEX = /```(\w+)?\n([\s\S]*?)```/g;

export function parseResponse(raw: string): ParsedResponse {
  const codeBlocks: CodeBlock[] = [];
  let match: RegExpExecArray | null;

  while ((match = CODE_BLOCK_REGEX.exec(raw)) !== null) {
    codeBlocks.push({
      language: match[1] || 'plaintext',
      code: match[2].trim(),
    });
  }

  return {
    text: raw,
    codeBlocks,
    language: codeBlocks[0]?.language,
  };
}

export function estimateTokenCount(text: string): number {
  // Rough estimation: ~4 chars per token
  return Math.ceil(text.length / 4);
}
