#!/usr/bin/env ts-node
import 'dotenv/config';
import path from 'path';
import os from 'os';
import fs from 'fs';
import Database from 'better-sqlite3';
import crypto from 'crypto';

// Simplified indexer that runs standalone (without the full backend)
const REPOS_BASE_PATH = (process.env.REPOS_BASE_PATH || '~/repos').replace('~', os.homedir());
const REPOS_TO_INDEX = (process.env.REPOS_TO_INDEX || '').split(',').filter(Boolean);
const DB_DIR = path.resolve(
  (process.env.DB_PATH || '~/.code-llm/vectors.db').replace('~', os.homedir()).replace('/vectors.db', '')
);
const VECTORS_DB = path.join(DB_DIR, 'vectors.db');
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '100');

const isFullRun = process.argv.includes('--full');
const isInitial = process.argv.includes('--initial');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'target', '.next', 'coverage']);
const INDEXABLE_EXTS = new Set(['.java', '.ts', '.tsx', '.js', '.jsx', '.py', '.kt', '.go']);
const LANG_MAP: Record<string, string> = {
  '.java': 'java', '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript', '.py': 'python',
  '.kt': 'kotlin', '.go': 'go',
};

function getAllFiles(dir: string): string[] {
  const results: string[] = [];
  function walk(current: string) {
    try {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
          walk(path.join(current, entry.name));
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (INDEXABLE_EXTS.has(ext)) results.push(path.join(current, entry.name));
        }
      }
    } catch {
      // Skip unreadable dirs
    }
  }
  walk(dir);
  return results;
}

async function main() {
  if (!fs.existsSync(VECTORS_DB)) {
    console.error('❌ Database not found. Run `npm run setup:db` first.');
    process.exit(1);
  }

  const db = new Database(VECTORS_DB);
  db.pragma('journal_mode = WAL');

  const repos = isFullRun || isInitial
    ? REPOS_TO_INDEX
    : REPOS_TO_INDEX.slice(0, 2); // Start with first 2 repos

  if (repos.length === 0) {
    console.log('⚠️  No repos configured. Set REPOS_TO_INDEX in .env');
    console.log('   Example: REPOS_TO_INDEX=java-backend,node-api,react-apps');
    process.exit(0);
  }

  console.log(`🔍 Indexing ${repos.length} repos: ${repos.join(', ')}`);
  console.log(`📁 Base path: ${REPOS_BASE_PATH}\n`);

  let totalIndexed = 0;
  let totalSkipped = 0;

  for (const repoName of repos) {
    const repoPath = path.join(REPOS_BASE_PATH, repoName);

    if (!fs.existsSync(repoPath)) {
      console.log(`⚠️  Repo not found: ${repoPath} — skipping`);
      continue;
    }

    const files = getAllFiles(repoPath);
    console.log(`📦 ${repoName}: ${files.length} files`);

    let indexed = 0;
    const insert = db.prepare(`
      INSERT INTO code_chunks (repo, file_path, chunk_id, language, code, summary)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(repo, file_path, chunk_id) DO UPDATE SET
        code = excluded.code, summary = excluded.summary,
        indexed_at = CURRENT_TIMESTAMP
    `);
    const insertMany = db.transaction((chunks: Parameters<typeof insert['run']>[]) => {
      for (const args of chunks) insert.run(...args);
    });

    const batch: Parameters<typeof insert['run']>[] = [];

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const relativePath = path.relative(repoPath, filePath);
        const ext = path.extname(filePath);
        const lang = LANG_MAP[ext] || 'plaintext';
        const lines = content.split('\n');
        const CHUNK = 150;
        const OVERLAP = 20;

        for (let i = 0, id = 0; i < lines.length; i += CHUNK - OVERLAP, id++) {
          const code = lines.slice(i, i + CHUNK).join('\n');
          const hash = crypto.createHash('md5').update(code).digest('hex').slice(0, 8);
          batch.push([repoName, relativePath, id, lang, code, `${relativePath} [${lang}] chunk-${id} ${hash}`]);
          if (batch.length >= BATCH_SIZE) {
            insertMany(batch.splice(0));
            indexed += BATCH_SIZE;
            process.stdout.write(`\r  ${indexed} chunks...`);
          }
          if (i + CHUNK >= lines.length) break;
        }
      } catch {
        totalSkipped++;
      }
    }

    if (batch.length > 0) {
      insertMany(batch.splice(0));
      indexed += batch.length;
    }

    console.log(`\n  ✅ ${repoName}: ${indexed} chunks indexed`);
    totalIndexed += indexed;
  }

  db.close();
  console.log(`\n✨ Done! Total: ${totalIndexed} chunks indexed, ${totalSkipped} files skipped`);
  console.log('ℹ️  Run `npm run index:initial` again to generate embeddings (requires Ollama)');
}

main().catch((err) => {
  console.error('❌ Indexing failed:', err);
  process.exit(1);
});
