# Code LLM

Assistente de codigo com IA que roda localmente como app desktop. Combina LLMs locais via Ollama com Claude API como fallback para oferecer chat contextual, code review, explicacao de codigo e geracao de testes — tudo com RAG sobre repositorios indexados.

## Funcionalidades

- **Chat contextual** — converse sobre seu codigo com contexto do projeto indexado
- **RAG** — indexacao automatica de repositorios com embeddings vetoriais para busca semantica
- **LLM local + fallback** — Ollama para execucao local, Claude API como fallback
- **Interface IDE-like** — layout estilo VSCode com file explorer, chat e status bar
- **Tema claro/escuro** — alternancia de tema com persistencia
- **Syntax highlighting** — renderizacao de codigo com Shiki
- **Extensao VSCode** — chat, explain, review e geracao de testes direto no editor
- **App desktop** — empacotado com Electron para macOS, Linux e Windows

## Arquitetura

```
┌─────────────────────────────────────────────────┐
│                   Electron                       │
│  ┌──────────────────┐  ┌──────────────────────┐ │
│  │  Frontend (3002)  │  │   Backend (3001)      │ │
│  │  Next.js 14       │  │   Express             │ │
│  │  React 18         │──│   SQLite (vetores)    │ │
│  │  Zustand          │  │   Ollama / Claude     │ │
│  │  Tailwind 3       │  │   RAG (chunk/embed)   │ │
│  └──────────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────┘
         │                        │
         │                  ┌─────┴─────┐
         │                  │  Ollama    │
         │                  │  (local)   │
         │                  └───────────┘
┌────────┴─────────┐
│  VSCode Extension │
│  (conecta ao API) │
└──────────────────┘
```

## Pre-requisitos

- **Node.js** 20+
- **Ollama** instalado e rodando (`ollama serve`)
- Modelo LLM baixado (ex: `ollama pull codellama:13b-instruct-q4_K_M`)
- Modelo de embeddings baixado (ex: `ollama pull nomic-embed-text`)
- (Opcional) Chave da API Claude para fallback

## Instalacao

```bash
# Clone o repositorio
git clone <repo-url>
cd llm-coder

# Instale dependencias (todos os workspaces)
npm install

# Configure variaveis de ambiente
cp .env.example .env
# Edite .env com suas configuracoes

# Configure o banco de dados
npm run setup:db
```

## Variaveis de ambiente

| Variavel | Descricao | Default |
|---|---|---|
| `LLM_MODEL` | Modelo Ollama para chat | `codellama:13b-instruct-q4_K_M` |
| `LLM_HOST` | URL do Ollama | `http://localhost:11434` |
| `LLM_FALLBACK` | Fallback quando Ollama indisponivel | `claude` |
| `CLAUDE_API_KEY` | Chave API Anthropic (opcional) | — |
| `CLAUDE_MODEL` | Modelo Claude para fallback | `claude-opus-4-6` |
| `DB_PATH` | Caminho do banco de vetores | `~/.code-llm/vectors.db` |
| `EMBEDDING_MODEL` | Modelo para embeddings | `nomic-embed-text` |
| `VECTOR_DIMENSIONS` | Dimensoes dos vetores | `384` |
| `MAX_MEMORY_MB` | Limite de memoria | `13000` |
| `PORT` | Porta do backend | `3001` |
| `LOG_LEVEL` | Nivel de log (Pino) | `info` |

## Uso

### Modo desenvolvimento (web)

```bash
# Inicia backend (porta 3001) + frontend (porta 3002)
npm run dev
```

Acesse `http://localhost:3002` no navegador.

### Modo desenvolvimento (Electron)

```bash
# Inicia o app desktop com hot reload
npm run electron:dev
```

O Electron inicia o backend e o frontend automaticamente.

### Build e empacotamento

```bash
# Build completo (backend + frontend + electron)
npm run electron:build

# Empacotar para distribuicao (dmg/AppImage/nsis)
npm run electron:pack
```

### Docker

```bash
# Backend + frontend via Docker Compose
# (requer Ollama rodando no host)
docker compose up -d
```

## Indexacao de repositorios

O RAG precisa indexar seus repositorios para fornecer contexto ao chat.

```bash
# Indexar diretorios configurados em REPOS_TO_INDEX
npm run index:repos

# Reindexacao completa
npm run index:full

# Limpar cache
npm run cache:clean
```

Tambem e possivel indexar diretamente pela interface: abra uma pasta e a indexacao inicia automaticamente.

## API

O backend expoe os seguintes endpoints em `/api`:

| Rota | Descricao |
|---|---|
| `GET /api/health` | Status do servidor, Ollama e banco |
| `POST /api/chat` | Enviar mensagem ao LLM |
| `GET /api/files/*` | Leitura de arquivos do projeto |
| `GET /api/browse/*` | Listagem de diretorios |
| `POST /api/index` | Indexar diretorio para RAG |
| `POST /api/exec` | Executar comandos no projeto |

## Extensao VSCode

A extensao conecta ao backend e oferece:

- **Chat** (`Ctrl+Shift+B`) — abre painel de chat
- **Explicar codigo** (`Ctrl+Shift+E`) — explica selecao
- **Revisar codigo** — code review da selecao
- **Gerar testes** — gera testes para selecao

```bash
# Build da extensao
npm run build --workspace=vscode-extension

# Empacotar .vsix
cd vscode-extension && npx vsce package
```

## Estrutura do projeto

```
llm-coder/
├── backend/                 # API Express (porta 3001)
│   └── src/
│       ├── api/             # Routes, controllers, middleware
│       ├── db/              # SQLite client e migrations
│       ├── llm/             # Clientes Ollama e Claude, parser, prompts
│       ├── rag/             # Chunker, indexer, searcher
│       └── utils/           # Logger (Pino), cache
├── frontend/                # Next.js 14 App Router (porta 3002)
│   ├── app/                 # Pages e layouts
│   └── components/          # ChatInterface, FileExplorer, CodeBlock, etc.
├── electron/                # Shell Electron (main + preload)
├── vscode-extension/        # Extensao VSCode
├── scripts/                 # Setup, indexacao, embeddings, cache
├── docker-compose.yml       # Deploy containerizado
└── .env.example             # Template de configuracao
```

## Scripts

| Comando | Descricao |
|---|---|
| `npm run dev` | Backend + frontend em dev |
| `npm run build` | Build de producao |
| `npm run electron:dev` | App Electron em dev |
| `npm run electron:pack` | Empacotar app desktop |
| `npm run setup:db` | Configurar banco SQLite |
| `npm run index:repos` | Indexar repositorios |
| `npm run index:full` | Reindexacao completa |
| `npm run cache:clean` | Limpar cache |
| `npm test --workspace=backend` | Testes do backend |
| `npm run typecheck --workspace=backend` | Typecheck backend |
| `npm run typecheck --workspace=frontend` | Typecheck frontend |

## Stack

- **Backend**: Express 4, TypeScript 5, Pino, Zod, JWT, Helmet
- **Frontend**: Next.js 14, React 18, Zustand, Tailwind 3, Shiki
- **Desktop**: Electron 39
- **Database**: better-sqlite3 (vetores + cache)
- **LLM**: Ollama + @anthropic-ai/sdk
- **RAG**: nomic-embed-text, busca vetorial cosine similarity

## Licenca

Privado.
