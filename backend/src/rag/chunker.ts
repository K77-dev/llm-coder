export interface CodeChunk {
  repo: string;
  filePath: string;
  chunkId: number;
  language: string;
  code: string;
  summary: string;
}

const LANGUAGE_MAP: Record<string, string> = {
  '.java': 'java',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.sol': 'solidity',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.json': 'json',
  '.xml': 'xml',
  '.sql': 'sql',
};

const CHUNK_SIZE = 150; // lines
const CHUNK_OVERLAP = 20; // lines

export function detectLanguage(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf('.'));
  return LANGUAGE_MAP[ext] || 'plaintext';
}

export function chunkFile(
  repo: string,
  filePath: string,
  content: string
): CodeChunk[] {
  const lines = content.split('\n');
  const language = detectLanguage(filePath);
  const chunks: CodeChunk[] = [];

  if (lines.length <= CHUNK_SIZE) {
    chunks.push({
      repo,
      filePath,
      chunkId: 0,
      language,
      code: content,
      summary: generateSummary(content, language, filePath),
    });
    return chunks;
  }

  let chunkId = 0;
  for (let i = 0; i < lines.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    const chunkLines = lines.slice(i, i + CHUNK_SIZE);
    const code = chunkLines.join('\n');

    chunks.push({
      repo,
      filePath,
      chunkId: chunkId++,
      language,
      code,
      summary: generateSummary(code, language, filePath),
    });

    if (i + CHUNK_SIZE >= lines.length) break;
  }

  return chunks;
}

function generateSummary(code: string, language: string, filePath: string): string {
  const fileName = filePath.split('/').pop() || filePath;
  const classMatch = code.match(/(?:class|interface|enum)\s+(\w+)/);
  const funcMatches = code.match(/(?:function|def|public|private|protected)\s+\w+/g);

  let summary = `Arquivo: ${fileName} (${language})`;
  if (classMatch) summary += ` | Classe: ${classMatch[1]}`;
  if (funcMatches?.length) {
    summary += ` | Funções: ${funcMatches.slice(0, 3).join(', ')}`;
  }
  return summary;
}

export const INDEXABLE_EXTENSIONS = new Set([
  '.java', '.ts', '.tsx', '.js', '.jsx',
  '.py', '.sol', '.kt', '.go', '.rs',
]);

export function isIndexable(filePath: string): boolean {
  const ext = filePath.substring(filePath.lastIndexOf('.'));
  return INDEXABLE_EXTENSIONS.has(ext);
}
