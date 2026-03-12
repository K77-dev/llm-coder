# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Code LLM is a local-first AI coding assistant with a RAG pipeline. It runs a local LLM (Ollama with qwen2.5-coder:7b) for chat, uses SQLite for vector storage, and falls back to Claude API for large contexts (>30K tokens). The project is written in Portuguese (Brazilian).

## Prerequisites

- **Node.js v20 is required** — `better-sqlite3` does not compile on v21+/v25+. Use `nvm use 20`.
- **Ollama** must be running locally (`ollama serve`) with models `qwen2.5-coder:7b` and `nomic-embed-text` pulled.

## Build and Run Commands

This is an npm workspaces monorepo with three workspaces: `backend`, `frontend`, `vscode-extension`.

```
npm install                          # Install all workspace dependencies (must use Node v20)
npm run dev                          # Start both frontend (:3002) and backend (:3001) concurrently
npm run build                        # Production build for backend + frontend
npm run dev --workspace=backend      # Start only the backend
npm run dev --workspace=frontend     # Start only the frontend
```

## Testing and Type Checking

```
npm test --workspace=backend         # Run backend tests (Jest)
npm run typecheck --workspace=backend    # Backend type check (tsc --noEmit)
npm run typecheck --workspace=frontend   # Frontend type check (tsc --noEmit)
npx tsc --noEmit -p backend/tsconfig.json  # Direct typecheck alternative
```

There are no lint scripts configured. The backend uses Jest with ts-jest for testing.

## Indexing Scripts (root-level)

```
npm run setup:db          # Initialize the SQLite database
npm run index:repos       # Index repositories defined in .env (REPOS_TO_INDEX)
npm run index:full        # Full re-index
npm run cache:clean       # Clean embedding/query caches
```

## Architecture

### Monorepo Structure

Three npm workspaces, each with its own `package.json` and `tsconfig.json`:
- **backend** (`@bbts/code-llm-backend`) — Express.js API on port 3001
- **frontend** (`@bbts/code-llm-frontend`) — Next.js 14 App Router on port 3002
- **vscode-extension** — VSCode plugin that talks to the backend

### Backend (`backend/src/`)

The backend is a TypeScript Express server with this module structure:

- **`index.ts`** — App entry point. Initializes DB, configures Express (helmet, CORS, JSON limit 10mb), mounts routes under `/api`.
- **`api/routes/`** — Route modules mounted by `index.ts` via `createRoutes()`:
  - `chat.ts` → POST `/api/chat` (main LLM chat endpoint, uses `optionalAuth`)
  - `index-route.ts` → POST/GET/DELETE `/api/index` (project indexing)
  - `health.ts` → GET `/api/health` (system status: Ollama, DB, indexing)
  - `files.ts` → File system operations (read, write, rename, delete, mkdir, tree, search)
  - `browse.ts` → GET `/api/browse` (directory listing for the frontend picker)
  - `exec.ts` → POST `/api/exec` (shell command execution via SSE streaming, 2min timeout)
- **`api/controllers/chat.controller.ts`** — Chat logic: validates input with Zod, performs RAG search, selects model (local vs Claude), supports streaming SSE or regular JSON responses. The response includes parsed structured actions (file writes, renames, deletes, commands).
- **`api/middleware/`**:
  - `error.ts` — `AppError` class for typed HTTP errors + global error handler
  - `auth.ts` — JWT-based auth (`optionalAuth` and `requireAuth`)
- **`llm/`** — LLM abstraction layer:
  - `ollama-client.ts` — Wraps the `ollama` npm package for chat (generate/stream) and embeddings. Default temperature 0.1.
  - `claude-client.ts` — Anthropic SDK wrapper. Falls back when `FALLBACK_ONLY=true` or token count > 30K.
  - `prompt-templates/index.ts` — System prompts that instruct the LLM to use XML tags (`<write_file>`, `<rename_file>`, `<delete_file>`, `<run_command>`, etc.) for structured output. Prompts are in Portuguese.
  - `response-parser.ts` — Regex-based parser that extracts structured actions (file changes, renames, deletes, commands, directory operations) from LLM output XML tags.
- **`rag/`** — RAG pipeline:
  - `chunker.ts` — Splits files into 150-line chunks with 20-line overlap. Generates summaries from class/function names. Supports `.java`, `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.sol`, `.kt`, `.go`, `.rs`.
  - `indexer.ts` — Walks a directory, chunks indexable files, generates embeddings via Ollama, stores in SQLite. Uses a SHA-256 hash to cache embeddings. Singleton `isIndexing` flag prevents concurrent indexing.
  - `searcher.ts` — Brute-force cosine similarity search in memory. Minimum score threshold 0.45, deduplicates by filePath, returns top-5 results.
- **`db/sqlite-client.ts`** — Manages two SQLite databases at `~/.code-llm/`: `vectors.db` (code_chunks + vectors tables) and `cache.db` (embedding_cache + query_cache). Uses WAL mode. Schema is created inline (not from migration files).
- **`utils/`**:
  - `cache.ts` — Generic LRU cache with TTL. `embeddingCache` singleton used across indexer and searcher.
  - `logger.ts` — Pino logger with pino-pretty in development.

### Frontend (`frontend/`)

Next.js 14 with App Router, Tailwind CSS, Zustand for state:

- **`app/`** — Next.js pages (layout + page)
- **`lib/api.ts`** — Axios client and all API call functions (chat, indexing, file operations, exec). Also handles SSE streaming for chat and command execution.
- **`lib/hooks/useChat.ts`** — Core React hook managing chat state, message sending (regular + streaming), and a `normalizeAIOutput()` function that converts malformed LLM output (e.g., `mv` commands, `<run>` tags) into canonical XML tags before parsing.
- **`components/`**:
  - `ChatInterface/` — Main chat UI + individual Message component
  - `Sidebar/` — System status panel, project indexing panel, health polling
  - `CodeBlock/` — Syntax-highlighted code blocks (uses Shiki)
  - `CodeViewer/` — File content viewer
  - `FileExplorer/` — Directory browser
  - `DirectoryPicker/` — Directory selection modal for indexing

### Key Data Flow

1. User sends message → `POST /api/chat`
2. Backend runs RAG search (embed query → cosine similarity against `vectors.db` → top-5 chunks with score ≥ 0.45)
3. Builds prompt: system prompt + RAG context + last 6 history messages + user message
4. Routes to Ollama (local) or Claude API based on token count and availability
5. Response is parsed for structured XML tags (`<write_file>`, `<rename_file>`, `<run_command>`, etc.)
6. Frontend renders response and executes structured actions (file writes, renames, commands) via the respective `/api/files/*` and `/api/exec` endpoints

### Database

SQLite databases stored at `~/.code-llm/`:
- `vectors.db` — Tables: `code_chunks` (repo, file_path, chunk_id, language, code, summary) + `vectors` (chunk_id, embedding BLOB as float32 array)
- `cache.db` — Tables: `embedding_cache` (text_hash → embedding) + `query_cache` (query_hash → response with TTL)

### Environment Configuration

Copy `.env.example` to `.env`. Key variables:
- `LLM_MODEL` / `LLM_HOST` — Ollama model and host
- `EMBEDDING_MODEL` — Model for embeddings (default: `nomic-embed-text`)
- `DB_PATH` — SQLite database path (default: `~/.code-llm/vectors.db`)
- `CLAUDE_API_KEY` / `CLAUDE_MODEL` — Claude API fallback
- `PORT` — Backend port (default: 3001)
- `FRONTEND_URL` — For CORS (default: `http://localhost:3000`; port 3002 is also allowed)

### Docker

`docker-compose.yml` provides containerized deployment. The backend connects to the host Ollama via `host.docker.internal:11434`. Note: the Docker frontend uses port 3000, while local dev uses port 3002.
