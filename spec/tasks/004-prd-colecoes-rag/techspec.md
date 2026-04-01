# Tech Spec — Coleções de RAG

## Resumo Executivo

A feature de Coleções adiciona uma camada de organização sobre o sistema RAG existente, permitindo que o usuário agrupe arquivos em coleções temáticas e selecione quais coleções compõem o contexto de uma query. A arquitetura preserva as tabelas `code_chunks` e `vectors` intactas, introduzindo duas novas tabelas (`collections` e `collection_files`) que funcionam como uma camada de metadados sobre os chunks existentes. No frontend, um store Zustand gerencia o estado das coleções com persistência via `localStorage`. A migração de repositórios existentes é feita via SQL migration, convertendo cada `repo` distinto em uma coleção global.

## Arquitetura do Sistema

### Visão Geral dos Componentes

**Componentes novos:**

- **`collections` table** — Nova tabela SQLite para metadados de coleções (nome, escopo, projeto)
- **`collection_files` table** — Tabela de junção que vincula coleções a arquivos (file_path + repo), sem duplicar chunks
- **`CollectionService`** (backend) — Serviço com lógica de CRUD de coleções e gerenciamento de arquivos
- **`collection-route.ts`** (backend) — Rotas REST para coleções
- **`collection.controller.ts`** (backend) — Controller das rotas de coleções
- **`useCollectionStore`** (frontend) — Store Zustand para estado global de coleções
- **`CollectionList`** (frontend) — Componente de sidebar com lista de coleções, checkboxes e ações
- **`CollectionDetail`** (frontend) — Componente de visualização/edição dos arquivos de uma coleção

**Componentes modificados:**

- **`searcher.ts`** — Filtro de busca vetorial por collection IDs (JOIN com `collection_files`)
- **`indexer.ts`** — Indexação vinculada a uma coleção (popula `collection_files` junto com chunks)
- **`chat.controller.ts`** — Receber `collectionIds` no request e repassar ao searcher
- **`sqlite-client.ts`** — Nova migration para criar as tabelas de coleções
- **`Sidebar`** (frontend) — Incluir seção de coleções
- **`ChatInterface`** (frontend) — Enviar coleções selecionadas na request de chat
- **`frontend/lib/api.ts`** — Novos tipos e funções para API de coleções

**Fluxo de dados principal:**

```
Sidebar (seleciona coleções) → ChatInterface (envia collectionIds)
  → POST /api/chat { collectionIds } → chat.controller
  → searcher.searchSimilar({ collectionIds }) → JOIN collection_files + code_chunks + vectors
  → resultados filtrados → resposta LLM
```

## Design de Implementação

### Interfaces Principais

```typescript
// backend/src/services/collection-service.ts
interface CollectionService {
  createCollection(params: CreateCollectionParams): Collection;
  renameCollection(id: number, name: string): Collection;
  deleteCollection(id: number): void;
  listCollections(projectDir?: string): Collection[];
  addFiles(collectionId: number, files: CollectionFileInput[]): void;
  removeFile(collectionId: number, filePath: string): void;
  getFiles(collectionId: number): CollectionFile[];
  getIndexingStatus(collectionId: number): IndexingStatus;
}
```

```typescript
// frontend/stores/collection-store.ts
interface CollectionStore {
  collections: Collection[];
  selectedIds: Set<number>;
  indexingStatus: Record<number, IndexingStatus>;
  fetchCollections: () => Promise<void>;
  toggleSelection: (id: number) => void;
  selectAll: () => void;
  deselectAll: () => void;
}
```

### Modelos de Dados

```typescript
interface Collection {
  id: number;
  name: string;
  scope: 'local' | 'global';
  projectDir: string | null;
  fileCount: number;
  createdAt: string;
}

interface CollectionFile {
  id: number;
  collectionId: number;
  filePath: string;
  repo: string;
  indexedAt: string | null;
}

interface CreateCollectionParams {
  name: string;
  scope: 'local' | 'global';
  projectDir?: string;
}

interface CollectionFileInput {
  filePath: string;
  repo: string;
}

type IndexingStatus = 'idle' | 'indexing' | 'done' | 'error';
```

**Schema SQL (nova migration):**

```sql
CREATE TABLE collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('local', 'global')),
  project_dir TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(name, scope, project_dir)
);

CREATE TABLE collection_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  repo TEXT NOT NULL,
  indexed_at DATETIME,
  UNIQUE(collection_id, file_path)
);

CREATE INDEX idx_cf_collection ON collection_files(collection_id);
CREATE INDEX idx_cf_repo_path ON collection_files(repo, file_path);
```

**Migration de dados existentes:**

```sql
-- Para cada repo distinto em code_chunks, criar uma coleção global
INSERT INTO collections (name, scope, project_dir)
  SELECT DISTINCT repo, 'global', NULL FROM code_chunks;

-- Vincular arquivos existentes às novas coleções
INSERT INTO collection_files (collection_id, file_path, repo, indexed_at)
  SELECT c.id, cc.file_path, cc.repo, cc.indexed_at
  FROM collections c
  JOIN (SELECT DISTINCT repo, file_path, MAX(indexed_at) as indexed_at FROM code_chunks GROUP BY repo, file_path) cc
    ON c.name = cc.repo;
```

### Endpoints de API

| Método | Caminho | Descrição |
|--------|---------|-----------|
| `GET /api/collections` | Lista coleções (query: `projectDir`) | Retorna coleções globais + locais do projeto |
| `POST /api/collections` | Cria coleção | Body: `{ name, scope, projectDir? }` |
| `PUT /api/collections/:id` | Renomeia coleção | Body: `{ name }` |
| `DELETE /api/collections/:id` | Exclui coleção e arquivos associados | Remove `collection_files` via CASCADE |
| `GET /api/collections/:id/files` | Lista arquivos da coleção | Retorna `CollectionFile[]` |
| `POST /api/collections/:id/files` | Adiciona arquivos | Body: `{ files: [{ filePath, repo }] }` — dispara indexação |
| `DELETE /api/collections/:id/files/:fileId` | Remove arquivo | Remove da coleção e limpa chunks órfãos |
| `GET /api/collections/:id/status` | Status de indexação | Retorna `{ status: IndexingStatus }` |

**Modificação no endpoint existente:**

- `POST /api/chat` — Adicionar campo opcional `collectionIds: number[]` ao body. Quando presente, o searcher filtra por esses IDs.

## Pontos de Integração

### Searcher — Filtro por Coleções

O `searchSimilar` ganha um parâmetro `collectionIds?: number[]`. Quando fornecido, a busca vetorial faz JOIN com `collection_files` para restringir os chunks considerados:

```
chunks candidatos = SELECT cc.*, v.embedding
  FROM code_chunks cc
  JOIN vectors v ON v.chunk_id = cc.id
  JOIN collection_files cf ON cf.repo = cc.repo AND cf.file_path = cc.file_path
  WHERE cf.collection_id IN (collectionIds)
```

Quando `collectionIds` está vazio ou ausente, nenhum resultado é retornado (conforme PRD requisito 20).

### Indexer — Vinculação a Coleção

Ao adicionar arquivos a uma coleção, o fluxo de indexação é:

1. Inserir registros em `collection_files`
2. Para cada arquivo, verificar se já existe chunk em `code_chunks` (mesmo `repo` + `file_path`)
3. Se não existir: executar chunking + embedding (pipeline existente)
4. Atualizar `indexed_at` em `collection_files`

Isso evita reindexação de arquivos já presentes no banco — o custo é apenas o INSERT na tabela de junção.

### DirectoryPicker — Seleção de Arquivos

O `DirectoryPicker` existente será adaptado para aceitar um prop `mode: 'directory' | 'files'`. No modo `files`, permitirá seleção de arquivos individuais além de pastas, reutilizando a mesma UI de navegação.

## Abordagem de Testes

### Testes Unitários

- **CollectionService**: CRUD completo (criar, renomear, excluir), validação de unicidade de nome, gerenciamento de arquivos
- **Searcher (filtro por coleções)**: Busca com collectionIds retorna apenas chunks vinculados, busca sem collectionIds retorna vazio
- **Migration**: Verificar que repos existentes são convertidos em coleções globais corretamente

Cenários críticos:
- Excluir coleção não remove chunks usados por outras coleções
- Arquivo em múltiplas coleções aparece nos resultados de ambas
- Nome duplicado no mesmo escopo/projeto retorna erro 422

### Testes de Integração

- Fluxo completo: criar coleção → adicionar arquivo → indexar → buscar via chat com collectionIds → verificar que resultado está filtrado
- Migration: popular banco com dados no formato antigo, rodar migration, verificar coleções criadas

### Testes de E2E

- Usando Playwright: criar coleção via sidebar, adicionar arquivos, selecionar checkboxes, enviar mensagem e verificar que sources retornadas pertencem à coleção selecionada

## Sequenciamento de Desenvolvimento

### Ordem de Construção

1. **Migration SQL + CollectionService** — Base de dados e lógica de negócio (sem dependências externas)
2. **Rotas REST de coleções** — CRUD endpoints com validação Zod
3. **Modificação do Searcher** — Filtro por collectionIds no pipeline de busca vetorial
4. **Modificação do Indexer** — Vinculação automática de chunks a coleções via `collection_files`
5. **Modificação do Chat Controller** — Aceitar e repassar collectionIds
6. **Migration de dados existentes** — Converter repos em coleções globais
7. **Store Zustand (frontend)** — `useCollectionStore` com persistência
8. **Componente CollectionList** — Sidebar com checkboxes e ações
9. **Componente CollectionDetail** — Gerenciamento de arquivos (adaptação do DirectoryPicker)
10. **Integração ChatInterface** — Enviar collectionIds selecionados nas requests
11. **Testes unitários e de integração**
12. **Testes E2E com Playwright**

### Dependências Técnicas

- Zustand (`zustand@^4.5`) já está no `package.json` do frontend mas não é utilizado — não requer nova instalação
- Nenhuma dependência externa nova necessária
- Pipeline de embeddings existente (Ollama) deve estar funcional

## Monitoramento e Observabilidade

- **Logs (Pino)**: Log `info` ao criar/excluir coleções, log `debug` para operações de arquivo, log `error` para falhas de indexação
- **Métricas no endpoint de health**: Adicionar `collection_count` e `collection_files_count` ao `GET /api/health`
- **Status de indexação**: Polling via `GET /api/collections/:id/status` (o frontend faz polling enquanto status === 'indexing')

## Considerações Técnicas

### Decisões Principais

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Schema | Tabela de junção (`collection_files`) | Evita duplicar chunks/vetores quando um arquivo pertence a múltiplas coleções |
| State management | Zustand | Alinhado com stack declarada, persistência nativa, compartilhamento entre componentes |
| File picker | Reutilizar DirectoryPicker | Consistência visual, menos código novo |
| Migração de repos existentes | Coleções globais | Sem project_dir disponível, global é o padrão seguro; usuário reclassifica depois |
| Busca sem coleções | Retorna vazio | Conforme PRD requisito 20 — força seleção consciente de contexto |

### Riscos Conhecidos

- **Performance do JOIN em busca vetorial**: O JOIN de `collection_files` com `code_chunks` pode impactar a busca quando houver muitos arquivos. Mitigação: índice composto em `(repo, file_path)` na `collection_files` e avaliação de performance com volumes reais
- **Consistência de dados na remoção**: Ao remover arquivo de coleção, chunks podem se tornar órfãos (não vinculados a nenhuma coleção). Mitigação: manter chunks existentes (são úteis para cache de embeddings) e limpar apenas se explicitamente solicitado
- **Concorrência na indexação**: Múltiplas coleções indexando simultaneamente podem sobrecarregar o Ollama. Mitigação: manter o padrão singleton do indexer existente (fila de indexação)

### Conformidade com Skills Padrões

- **Express 4**: Rotas REST com controllers separados e validação Zod (conforme `.claude/rules/http.md`)
- **TypeScript 5**: Tipagem forte, sem `any`, interfaces definidas (conforme `.claude/rules/typescript.md`)
- **better-sqlite3**: Novas tabelas no SQLite existente, migrations SQL
- **Zustand 4.5**: Store com persistência para estado de coleções (conforme `.claude/rules/react.md`)
- **Tailwind 3.4**: Componentes estilizados com classes utilitárias
- **Pino 8**: Logs estruturados para operações de coleções (conforme `.claude/rules/logging.md`)
- **Jest 29**: Testes unitários e de integração (conforme `.claude/rules/tests.md`)
- **Zod 3.22**: Validação de payloads nos endpoints de coleções

### Arquivos relevantes e dependentes

**Backend (modificados):**
- `backend/src/db/sqlite-client.ts` — Inicialização e migrations
- `backend/src/db/migrations/` — Nova migration para tabelas de coleções
- `backend/src/rag/searcher.ts` — Filtro por collectionIds
- `backend/src/rag/indexer.ts` — Vinculação a coleções
- `backend/src/api/controllers/chat.controller.ts` — Aceitar collectionIds
- `backend/src/api/routes/chat.ts` — Schema Zod atualizado

**Backend (novos):**
- `backend/src/services/collection-service.ts` — Lógica de negócio
- `backend/src/api/routes/collection-route.ts` — Rotas REST
- `backend/src/api/controllers/collection.controller.ts` — Controller

**Frontend (modificados):**
- `frontend/components/Sidebar/` — Incluir seção de coleções
- `frontend/components/ChatInterface/index.tsx` — Enviar collectionIds
- `frontend/components/DirectoryPicker/` — Modo de seleção de arquivos
- `frontend/lib/api.ts` — Tipos e funções de API

**Frontend (novos):**
- `frontend/stores/collection-store.ts` — Store Zustand
- `frontend/components/CollectionList/index.tsx` — Lista com checkboxes
- `frontend/components/CollectionDetail/index.tsx` — Gerenciamento de arquivos
