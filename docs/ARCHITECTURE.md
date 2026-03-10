# Arquitetura Code LLM

## Visão Geral

```
┌─────────────────────────────────────────────────┐
│              MacBook Pro M4 (24GB)              │
│                                                 │
│  ┌──────────────┐     ┌──────────────────────┐  │
│  │  Next.js     │────▶│  Node.js/Express     │  │
│  │  (frontend)  │     │  (backend :3001)     │  │
│  │  :3002       │     │                      │  │
│  └──────────────┘     │  ┌─────────────────┐ │  │
│                       │  │  RAG Engine     │ │  │
│  ┌──────────────┐     │  │  - Indexer      │ │  │
│  │  VSCode Ext  │────▶│  │  - Searcher     │ │  │
│  │  (plugin)    │     │  │  - Chunker      │ │  │
│  └──────────────┘     │  └────────┬────────┘ │  │
│                       │           │           │  │
│                       │  ┌────────▼────────┐  │  │
│                       │  │  LLM Layer      │  │  │
│                       │  │  - Ollama local │  │  │
│                       │  │  - Claude API   │  │  │
│                       │  └─────────────────┘  │  │
│                       └──────────────────────┘  │
│                                                 │
│  ┌──────────────┐     ┌──────────────────────┐  │
│  │  Ollama      │     │  SQLite              │  │
│  │  qwen2.5-    │     │  ~/.code-llm/        │  │
│  │  coder:7b    │     │  vectors.db          │  │
│  │  (~5GB RAM)  │     │  (chunks + vectors)  │  │
│  └──────────────┘     └──────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## Componentes

### Backend (`/backend`)
- **Express.js** API com TypeScript, porta 3001
- **RAG Engine**: Indexação e busca de código
- **LLM Layer**: Abstração sobre Ollama + Claude API (fallback)
- **SQLite**: Armazenamento de vetores e cache em `~/.code-llm/vectors.db`

### Frontend (`/frontend`)
- **Next.js 14** com App Router, porta 3002
- **React 18** com hooks customizados
- Chat interface com suporte a streaming SSE
- Sidebar com status do sistema e painel de indexação de projetos

### VSCode Extension (`/vscode-extension`)
- Comandos: Chat, Explain, Generate Tests, Review
- Webview para interface de chat
- Integração direta com backend local

## RAG Pipeline

```
Diretório do usuário (qualquer projeto local)
     │
     ▼
Chunker (150 linhas por chunk, 20 linhas de overlap)
     │
     ▼
Embeddings (nomic-embed-text via Ollama — 768 dimensões)
     │
     ▼
SQLite: tabelas code_chunks + vectors (BLOB float32)
     │
     ▼ (no momento da query)
Geração do embedding da pergunta
     │
     ▼
Cosine Similarity (brute-force em memória)
     │
     ▼
Filtro: score >= 0.45 (descarta chunks irrelevantes)
     │
     ▼
Deduplicação por filePath (maior score por arquivo)
     │
     ▼
Top-5 chunks → contexto injetado no prompt
```

## Fluxo de Chat

```
Usuário → mensagem
     │
     ▼
RAG Search (top-5 chunks, score >= 0.45, sem duplicatas)
     │
     ▼
Construção do prompt:
  [System prompt] + [Contexto RAG] + [Histórico] + [Mensagem]
     │
     ▼
Contagem de tokens estimada
     │
     ├─ tokens < 30K e Ollama disponível → qwen2.5-coder:7b (local)
     └─ tokens > 30K ou Ollama indisponível → Claude API (fallback)
          │
          ▼
     Resposta + fontes (repo, filePath, score)
```

## Endpoints de Indexação

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `POST` | `/api/index` | Inicia indexação de um diretório em background |
| `GET` | `/api/index/status` | Retorna `{ isIndexing: boolean }` |
| `DELETE` | `/api/index/:repo` | Remove chunks de um repo específico |
| `DELETE` | `/api/index` | Limpa o índice inteiro |

## Budget de Memória (24GB)

| Componente | RAM |
|------------|-----|
| macOS + apps | 4GB |
| Ollama (qwen2.5-coder:7b) | ~5GB |
| Node.js + Next.js | 2-3GB |
| SQLite + cache | ~200MB |
| Buffer | 6-7GB |
| **Total** | **~12-13GB** |

## Decisões de Design

1. **Local-first**: Ollama + SQLite evitam dependências de cloud
2. **Fallback automático**: Claude API quando contexto > 30K tokens ou Ollama indisponível
3. **Cosine similarity em memória**: Sem extensão sqlite-vec, usa brute-force — aceitável para <100K chunks com M4 SSD
4. **Score mínimo (0.45)**: Evita injetar contexto irrelevante no prompt
5. **Deduplicação por filePath**: Evita que o mesmo arquivo indexado com nomes diferentes apareça duplicado no contexto
6. **LRU cache**: Embeddings cacheados em memória para evitar reprocessamento
7. **WAL mode**: SQLite em Write-Ahead Logging para leituras concorrentes sem lock
8. **Porta 3002**: Frontend usa 3002 porque 3000 é ocupada pelo Open WebUI (Ollama)
