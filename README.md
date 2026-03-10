# Code LLM

Assistente de IA especializado em desenvolvimento de software (Java, Node.js, React, Angular) — otimizado para MacBook Pro M4 com arquitetura **Local-First**.

## Arquitetura

```
MacBook M4 (Local):
├── Next.js + React (frontend chat — :3002)
├── Node.js/Express (backend API — :3001)
├── qwen2.5-coder:7b via Ollama (LLM local)
├── SQLite + cosine similarity (vector DB)
└── nomic-embed-text (embeddings)

Fallback: Claude API (contextos >30K tokens)
```

## Pré-requisitos

- MacBook M4 com 24GB RAM
- Node.js **v20** (required — `better-sqlite3` não compila em v25+)
- [Ollama](https://ollama.ai)

## Setup Rápido (15 min)

```bash
# 1. Instalar Ollama e modelos
brew install ollama
ollama pull qwen2.5-coder:7b
ollama pull nomic-embed-text

# 2. Usar Node.js v20
nvm install 20 && nvm use 20

# 3. Instalar dependências
npm install

# 4. Configurar ambiente
cp .env.example .env
# Editar .env se necessário

# 5. Iniciar aplicação
npm run dev
# Frontend: http://localhost:3002
# Backend:  http://localhost:3001
```

## Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia frontend + backend |
| `npm run build` | Build de produção |

## Indexar um Projeto

Acesse o frontend em `http://localhost:3002` e use o painel **"Indexar projeto"** na sidebar:

1. Informe o **caminho absoluto** do diretório (ex: `~/projetos/meu-repo`)
2. Informe um **nome** (opcional)
3. Clique em **Indexar** — a indexação roda em background
4. Clique em **Limpar índice** para apagar tudo e reindexar do zero

Após indexar, as respostas do assistente usarão o código do projeto como contexto (RAG).

## Estrutura

```
bbts-code-llm/
├── backend/           # Node.js/Express API
│   └── src/
│       ├── api/       # Routes + controllers
│       ├── rag/       # Indexer, searcher, chunker
│       ├── llm/       # Ollama + Claude clients
│       └── db/        # SQLite (vectors em ~/.code-llm/)
├── frontend/          # Next.js/React chat (:3002)
├── vscode-extension/  # VSCode plugin
└── docs/              # Documentação
```

## Banco de Dados

Armazenado em `~/.code-llm/vectors.db` (SQLite).
Busca por similaridade coseno em memória (brute-force, adequado para <100K chunks).

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [API Reference](docs/API.md)
- [Setup Detalhado](SETUP.md)
- [Histórico de Mudanças](docs/CHANGES.md)
