# Histórico de Mudanças

## v1.0 — Março 2026

### Arquitetura implementada

O projeto saiu de um design baseado em cloud (Pinecone + Claude API + Vercel/Railway) para uma arquitetura **local-first** rodando inteiramente no MacBook Pro M4.

**Stack atual:**
- **LLM**: `qwen2.5-coder:7b` via Ollama (local, ~5GB RAM)
- **Embeddings**: `nomic-embed-text` via Ollama (768 dimensões)
- **Vector DB**: SQLite (`~/.code-llm/vectors.db`) com cosine similarity em memória
- **Backend**: Node.js/Express + TypeScript (porta 3001)
- **Frontend**: Next.js 14 + React 18 + Tailwind (porta 3002)

---

### Mudanças por componente

#### Backend

**`backend/src/index.ts`**
- CORS configurado para aceitar origens nas portas 3000, 3001 e 3002

**`backend/src/rag/searcher.ts`**
- Adicionado filtro de score mínimo `MIN_SCORE = 0.45` — chunks com similaridade abaixo são descartados, evitando contexto irrelevante
- Adicionada deduplicação por `filePath` antes de retornar os resultados — quando o mesmo arquivo é indexado com nomes de repo diferentes, só o de maior score entra no contexto

**`backend/src/api/routes/index-route.ts`** *(novo)*
- `POST /api/index` — inicia indexação de um diretório local em background
- `GET /api/index/status` — retorna `{ isIndexing: boolean }`
- `DELETE /api/index/:repo` — remove todos os chunks e vetores de um repo específico
- `DELETE /api/index` — limpa o índice inteiro

**`backend/src/api/routes/index.ts`**
- Registrado `indexRouter` em `/index`

**`backend/src/llm/prompt-templates/index.ts`**
- Removidas todas as referências a "BBTS" dos system prompts
- `buildRAGPrompt`: "Contexto relevante do codebase BBTS:" → "Contexto relevante do codebase:"

**`backend/package.json`**
- Script `dev` corrigido para carregar `.env` do diretório pai (`dotenv_config_path=../.env`) — necessário ao rodar via npm workspaces

**`backend/src/db/sqlite-client.ts`**
- Caminho padrão do banco: `~/.code-llm/vectors.db` (era `~/.bbts-llm/`)

#### Frontend

**`frontend/package.json`**
- Porta alterada de 3000 para **3002** (3000 ocupada pelo Open WebUI do Ollama)

**`frontend/app/page.tsx`**
- Estava redirecionando para `/chat`, que não existe (route group `(chat)` não cria segmento de URL no App Router)
- Corrigido: renderiza `ChatInterface` + `Sidebar` diretamente na raiz `/`

**`frontend/lib/api.ts`**
- Adicionada `indexDirectory(dirPath, name?)` → `POST /api/index`
- Adicionada `getIndexStatus()` → `GET /api/index/status`
- Adicionada `clearIndex(repo?)` → `DELETE /api/index` ou `DELETE /api/index/:repo`

**`frontend/components/Sidebar/index.tsx`**
- Adicionado painel **"Indexar projeto"** com:
  - Input de caminho do diretório
  - Input de nome (opcional)
  - Botão **Indexar** (polling de status a cada 2s enquanto em andamento)
  - Botão **Limpar índice** (remove todo o índice via `DELETE /api/index`)
  - Mensagens de sucesso/erro
- Status de indexação exibido em tempo real na seção **Status**
- Largura da sidebar aumentada de `w-64` para `w-72`

#### Ambiente

**`.env`** *(criado)*
```env
LLM_MODEL=qwen2.5-coder:7b
EMBEDDING_MODEL=nomic-embed-text
DB_PATH=~/.code-llm/vectors.db
JWT_SECRET=dev-secret-local-only
```

**`.nvmrc`** *(criado)*
```
20
```
Garante uso do Node.js v20 (obrigatório — `better-sqlite3` falha no v25+).

---

### Problemas resolvidos

| Problema | Causa | Solução |
|----------|-------|---------|
| `better-sqlite3` falhou ao compilar | Node.js v25 incompatível | Trocar para Node.js v20 via nvm |
| "Failed to fetch" no frontend | CORS bloqueando porta 3002 | Adicionado `localhost:3002` à lista CORS |
| Frontend 404 em `/chat` | Route group `(chat)` não cria URL `/chat` | Renderizar chat diretamente em `app/page.tsx` |
| `.env` não carregado no backend | CWD era `backend/` mas `.env` está na raiz | `dotenv_config_path=../.env` no script dev |
| Contexto irrelevante nas respostas | Sem threshold de similaridade | `MIN_SCORE = 0.45` em `searcher.ts` |
| Duplicatas no índice | Mesmo projeto indexado duas vezes com nomes diferentes | Deduplicação por `filePath` + endpoint `DELETE /api/index` |
