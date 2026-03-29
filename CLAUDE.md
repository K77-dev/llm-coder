# CLAUDE.md

Guia para agentes de IA ao trabalhar com o código deste repositório.

BBTS Code LLM — Assistente de código com IA que combina LLMs locais (Ollama) e Claude API para chat, code review, geração de testes e RAG sobre repositórios indexados. App Electron com backend Express, frontend Next.js e extensão VSCode.

### Idioma

- **Codigo-fonte**: ingles (variaveis, funcoes, classes, comentarios)
- **Specs e documentacao de projeto** (PRD, tech spec, tasks, reviews): portugues Brasil

### Prioridades

- **Sempre use npm** — nunca use bun, yarn ou pnpm
- **Execute os checks** antes de concluir: `npm test --workspace=backend`, `npm run typecheck --workspace=backend`, `npm run typecheck --workspace=frontend`
- **Nao use workarounds** — prefira correcoes de causa raiz
- **Valide tipagem** com `tsc --noEmit` nos workspaces antes de finalizar

### Comandos do projeto

```bash
# Raiz
npm run dev                    # Inicia backend + frontend (concurrently)
npm run build                  # Build backend + frontend
npm run electron:dev           # Compila e executa app Electron em dev
npm run electron:build         # Build completo para Electron
npm run electron:pack          # Empacota app Electron (dmg/AppImage/nsis)
npm run setup:db               # Configura banco SQLite
npm run index:repos            # Indexa repositorios para RAG
npm run index:full             # Reindexacao completa
npm run cache:clean            # Limpa cache

# Backend (@bbts/code-llm-backend)
npm run dev --workspace=backend       # Dev server (ts-node-dev, porta 3001)
npm run build --workspace=backend     # Compila TypeScript
npm test --workspace=backend          # Testes com Jest
npm run typecheck --workspace=backend # Verificacao de tipos

# Frontend (@bbts/code-llm-frontend)
npm run dev --workspace=frontend       # Next.js dev (porta 3002)
npm run build --workspace=frontend     # Build Next.js
npm run typecheck --workspace=frontend # Verificacao de tipos

# VSCode Extension
npm run build --workspace=vscode-extension  # Compila extensao
npm run watch --workspace=vscode-extension  # Watch mode
```

### Stack e skills recomendadas

| Area              | Tecnologia                                  | Skill sugerida       |
| ----------------- | ------------------------------------------- | -------------------- |
| Backend           | Express 4 + TypeScript 5                    | —                    |
| Frontend          | Next.js 14 (App Router) + React 18          | —                    |
| Desktop           | Electron 39                                 | —                    |
| VSCode Extension  | VSCode Extension API                        | —                    |
| CSS               | Tailwind 3.4 + PostCSS                      | —                    |
| State             | Zustand 4.5                                 | —                    |
| Database          | better-sqlite3 (vetores + cache)            | —                    |
| LLM               | Ollama + @anthropic-ai/sdk                  | claude-api           |
| Validacao         | Zod 3.22                                    | —                    |
| Logging           | Pino 8 + pino-pretty                        | —                    |
| Auth              | JWT (jsonwebtoken)                          | —                    |
| Testes            | Jest 29 + ts-jest                           | —                    |
| Git ops           | simple-git                                  | —                    |
| Markdown          | react-markdown + rehype-raw + shiki         | —                    |

### Estrutura do projeto

```
/
├── backend/                    # API Express (porta 3001)
│   └── src/
│       ├── index.ts            # Entry point do servidor
│       ├── api/
│       │   ├── controllers/    # Controllers das rotas
│       │   ├── middleware/      # Auth, CORS, etc.
│       │   └── routes/         # Definicao de rotas REST
│       ├── db/
│       │   ├── sqlite-client.ts # Cliente SQLite (vetores + cache)
│       │   └── migrations/     # Migrations do banco
│       ├── llm/
│       │   ├── ollama-client.ts      # Cliente Ollama (LLM local)
│       │   ├── claude-client.ts      # Cliente Claude API (fallback)
│       │   ├── response-parser.ts    # Parser de respostas LLM
│       │   └── prompt-templates/     # Templates de prompts
│       ├── rag/
│       │   ├── chunker.ts     # Chunking de codigo para embeddings
│       │   ├── indexer.ts     # Indexacao de repositorios
│       │   └── searcher.ts   # Busca vetorial
│       └── utils/
│           ├── cache.ts       # Cache LRU
│           └── logger.ts      # Logger Pino
├── frontend/                   # Next.js 14 App Router (porta 3002)
│   ├── app/
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Pagina principal (IDE-like)
│   │   └── globals.css        # Estilos globais + Tailwind
│   └── components/
│       ├── ChatInterface/     # Chat estilo Warp
│       ├── CodeBlock/         # Blocos de codigo com syntax highlight
│       ├── CodeViewer/        # Visualizador de arquivos
│       ├── DirectoryPicker/   # Seletor de diretorios
│       ├── FileExplorer/      # Explorador de arquivos (sidebar)
│       ├── Sidebar/           # Sidebar principal
│       └── ThemeProvider.tsx   # Tema claro/escuro
├── electron/                   # Shell Electron
│   ├── main.ts                # Main process
│   └── preload.ts             # Preload script
├── vscode-extension/           # Extensao VSCode
│   └── src/                   # Extension com chat, explain, review, tests
├── scripts/                    # Scripts utilitarios
│   ├── setup.ts               # Setup inicial do banco
│   ├── index-repos.ts         # Indexacao de repositorios
│   ├── generate-embeddings.ts # Geracao de embeddings
│   └── cache-clean.ts         # Limpeza de cache
├── docs/                       # Documentacao
├── docker-compose.yml          # Ollama container
└── .env.example                # Variaveis de ambiente
```

### Express (Backend)

Rotas REST com controllers separados, middleware de auth JWT e Helmet para seguranca. Validacao com Zod. Detalhes em `.claude/rules/http.md`.

### Next.js + React (Frontend)

App Router, componentes funcionais com TypeScript, Zustand para state, Tailwind 3 para estilos. Layout IDE-like com sidebar, chat e code viewer. Detalhes em `.claude/rules/react.md`.

### Testes

Jest 29 + ts-jest no backend. Detalhes em `.claude/rules/tests.md`.

### Logging

Pino com niveis estruturados no backend. Detalhes em `.claude/rules/logging.md`.

### Git

- **Nao execute** `git restore`, `git reset`, `git clean` ou comandos destrutivos **sem permissao explicita do usuario**

### Anti-padroes

1. Usar bun/yarn/pnpm em vez de npm
2. Usar Hono em vez de Express — o backend usa Express
3. Usar Vitest em vez de Jest — os testes usam Jest
4. Usar Tailwind v4 — o projeto usa Tailwind v3
5. Usar shadcn/ui — o projeto nao usa shadcn
6. Referenciar `frontend/src/` — o frontend usa App Router (`frontend/app/` e `frontend/components/`)
7. Esquecer verificacao de tipos antes de marcar tarefa concluida
8. Executar comandos git destrutivos sem permissao do usuario
