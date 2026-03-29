# Tech Spec: Integracao llama-server com Electron

## Resumo Executivo

Esta spec descreve a integracao do llama-server (llama.cpp) ao ciclo de vida do Electron, permitindo que o app gerencie o processo de inferencia local diretamente. A arquitetura usa o main process do Electron para spawn/kill do llama-server via `child_process`, comunicacao IPC (preload bridge) entre renderer e main process para controle do servidor, e reutiliza o `ollama-client.ts` existente para consumir a API OpenAI-compatible do llama-server. A persistencia do ultimo modelo ativo usa o banco SQLite ja existente.

## Arquitetura do Sistema

### Visao Geral dos Componentes

**Componentes novos:**

- **`electron/llama-server-manager.ts`** — Gerenciador do processo llama-server. Responsavel por spawn, monitor, restart e kill do processo filho. Emite eventos de status.
- **`electron/preload.ts` (modificado)** — Bridge IPC expondo `window.electronAPI` com metodos para controle do llama-server e scan de modelos.
- **`frontend/components/Sidebar/ModelSelector.tsx`** — Componente de selecao de modelos na sidebar com lista, status e controle.
- **`backend/src/db/migrations/add-llama-settings.ts`** — Migration para tabela de configuracoes do llama-server.

**Componentes modificados:**

- **`electron/main.ts`** — Integra o `LlamaServerManager`, registra handlers IPC e conecta ao ciclo de vida do app.
- **`backend/src/llm/ollama-client.ts`** — Adaptar para funcionar com a API do llama-server (OpenAI-compatible no mesmo host/port).
- **`frontend/components/Sidebar/index.tsx`** — Adicionar secao "Modelos Locais" com o `ModelSelector`.
- **`.env.example`** — Documentar novas variaveis `LLAMA_*`.

**Fluxo de dados:**

```
[Electron Main] --spawn/kill--> [llama-server process]
[Electron Main] <--IPC--> [Preload Bridge] <--window.electronAPI--> [Renderer/Sidebar]
[Renderer/Chat] --HTTP--> [Backend Express] --HTTP--> [llama-server :8080]
```

O controle do processo (start/stop/status/scan) flui via IPC. O chat e completions fluem via HTTP pelo backend Express, que usa o `ollama-client.ts` para se comunicar com o llama-server na porta configurada.

## Design de Implementacao

### Interfaces Principais

```typescript
// electron/llama-server-manager.ts
type ServerStatus = 'stopped' | 'starting' | 'running' | 'error';

interface LlamaServerState {
  status: ServerStatus;
  activeModel: string | null;
  port: number;
  pid: number | null;
  error: string | null;
}

interface LlamaServerManager {
  start(modelPath: string): Promise<void>;
  stop(): Promise<void>;
  restart(modelPath: string): Promise<void>;
  getState(): LlamaServerState;
  onStateChange(cb: (state: LlamaServerState) => void): void;
}
```

```typescript
// electron/preload.ts — exposed via contextBridge
interface ElectronAPI {
  llama: {
    getModels(): Promise<ModelInfo[]>;
    getState(): Promise<LlamaServerState>;
    selectModel(fileName: string): Promise<void>;
    onStateChange(cb: (state: LlamaServerState) => void): () => void;
  };
}

interface ModelInfo {
  fileName: string;
  displayName: string;
  sizeBytes: number;
  path: string;
}
```

### Modelos de Dados

**Tabela SQLite `llama_settings`** (nova):

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| key | TEXT PRIMARY KEY | Chave da config |
| value | TEXT NOT NULL | Valor serializado |
| updated_at | TEXT NOT NULL | ISO timestamp |

Chaves iniciais: `last_active_model` (nome do arquivo `.gguf`).

### Endpoints de API

Nenhum endpoint REST novo. O controle do llama-server flui via IPC, nao via backend Express. O chat continua usando `POST /api/chat` que internamente chama o `ollama-client.ts`.

## Pontos de Integracao

### llama-server (processo externo)

- **Spawn**: `child_process.spawn(execPath, ['-m', modelPath, '--port', port])` com `stdio: 'pipe'`
- **Health check**: `GET http://localhost:{port}/health` — poll ate retornar 200 (timeout 60s para modelos grandes)
- **API**: `POST http://localhost:{port}/v1/chat/completions` — OpenAI-compatible, ja suportado pelo formato que o `ollama-client` usa
- **Shutdown**: `SIGTERM` → aguarda 5s → `SIGKILL` se nao encerrou
- **Stderr/Stdout**: Pipe para logger Pino com prefixo `[llama-server]`

### ollama-client.ts (adaptacao)

O `ollama-client.ts` atualmente usa a API do Ollama (`/api/generate`, `/api/embeddings`). O llama-server usa endpoints OpenAI-compatible (`/v1/chat/completions`). A adaptacao consiste em:

- Detectar qual API esta respondendo via `GET /health` (llama-server) vs `GET /api/tags` (Ollama)
- Ajustar o formato de request/response conforme o endpoint detectado
- Manter `isAvailable()` e `streamResponse()` funcionando para ambos
- `generateEmbedding()` permanece exclusivo do Ollama (llama-server nao serve embeddings por padrao)

### IPC Channels

| Channel | Direcao | Payload |
|---------|---------|---------|
| `llama:get-models` | renderer → main | — |
| `llama:get-state` | renderer → main | — |
| `llama:select-model` | renderer → main | `{ fileName: string }` |
| `llama:state-changed` | main → renderer | `LlamaServerState` |

## Abordagem de Testes

### Testes Unitarios

- **`LlamaServerManager`**: Testar state machine (stopped→starting→running→error), mock de `child_process.spawn`. Cenarios: start sucesso, start com executavel nao encontrado, stop graceful, stop forcado, restart.
- **Scan de modelos**: Mock de `fs.readdir`/`fs.stat`. Cenarios: diretorio com .gguf, diretorio vazio, diretorio inexistente, arquivos sem permissao.
- **Adaptacao ollama-client**: Testar deteccao de API (llama-server vs Ollama) e formatacao correta de requests.

### Testes de Integracao

- **IPC round-trip**: Testar que chamadas do renderer via preload chegam ao main process e retornam dados corretos (usando `@electron/remote` ou test harness).
- **Persistencia SQLite**: Testar save/load do ultimo modelo ativo.

### Testes E2E

- **Fluxo de selecao de modelo**: Abrir app → verificar lista de modelos na sidebar → clicar em modelo → verificar indicador de loading → verificar status "running" (requer llama-server instalado no CI ou mock).

## Sequenciamento de Desenvolvimento

### Ordem de Construcao

1. **Migration SQLite + persistencia** — Base de dados para configuracoes (sem dependencias)
2. **`LlamaServerManager`** — Core do gerenciamento de processo (depende apenas de Node.js APIs)
3. **Preload bridge IPC** — Conecta main ↔ renderer (depende de #2)
4. **Integracao `electron/main.ts`** — Lifecycle hooks, auto-start, cleanup (depende de #2 e #3)
5. **Adaptacao `ollama-client.ts`** — Deteccao de API e compatibilidade (independente de #2-4)
6. **`ModelSelector` component** — UI na sidebar (depende de #3)
7. **Integracao Sidebar** — Montar o ModelSelector na sidebar existente (depende de #6)
8. **Variaveis `.env.example`** — Documentacao (independente)
9. **Testes** — Unitarios e integracao (apos #1-7)

### Dependencias Tecnicas

- llama-server deve estar instalado no ambiente de desenvolvimento
- Pelo menos um arquivo `.gguf` no diretorio configurado para testes manuais

## Monitoramento e Observabilidade

- **Logs**: Pino com child logger `{ component: 'llama-server' }`. Niveis:
  - `info`: start, stop, modelo carregado, troca de modelo
  - `warn`: shutdown forcado (SIGKILL), health check lento (>30s)
  - `error`: processo crashou, executavel nao encontrado, diretorio invalido
- **Metricas**: Tempo de startup do modelo (log), tempo de restart, crashes acumulados (counter em memoria)

## Consideracoes Tecnicas

### Decisoes Principais

| Decisao | Justificativa | Alternativa rejeitada |
|---------|--------------|----------------------|
| IPC via preload (nao backend REST) | Controle direto do processo sem indirection. O llama-server e filho do Electron, nao do backend | Endpoints REST no Express — adicionaria hop desnecessario |
| Reutilizar ollama-client | Evita duplicacao. llama-server e Ollama servem em portas similares com APIs HTTP | Novo llama-client.ts — codigo duplicado para mesma funcionalidade |
| SQLite para persistencia | Banco ja existe no projeto, nao adiciona dependencia | electron-store — nova dependencia; localStorage — nao acessivel no main process |
| Deteccao de API automatica | Usuario nao precisa configurar qual runtime esta usando | Flag manual no .env — mais uma config para gerenciar |

### Riscos Conhecidos

- **Processos orfaos**: Se o Electron crashar sem executar cleanup, o llama-server fica rodando. Mitigacao: no startup, verificar se a porta ja esta em uso e tentar kill do processo anterior.
- **Tempo de carregamento de modelos grandes**: Modelos >20GB podem levar >60s para carregar. Mitigacao: health check com timeout configuravel, feedback de progresso na UI.
- **Permissoes de arquivo**: Modelos em diretorios protegidos podem falhar silenciosamente. Mitigacao: validar acesso de leitura antes de tentar carregar.
- **Embeddings**: llama-server nao serve embeddings. Se o usuario trocar de Ollama para llama-server, o RAG perde a capacidade de gerar embeddings. Mitigacao: documentar que embeddings requerem Ollama ou outro servico.

### Conformidade com Skills Padroes

| Skill | Aplicacao |
|-------|-----------|
| Express 4 + TypeScript 5 | Backend mantido (sem novos endpoints, mas ollama-client adaptado) |
| Next.js 14 (App Router) + React 18 | ModelSelector como componente funcional TSX |
| Electron 39 | Main process, preload, IPC |
| Tailwind 3.4 | Estilizacao do ModelSelector |
| Zustand 4.5 | Nao necessario — estado do llama vem via IPC subscription |
| better-sqlite3 | Persistencia de configuracoes |
| Pino 8 | Logs do llama-server manager |
| Jest 29 + ts-jest | Testes unitarios e integracao |

### Arquivos relevantes e dependentes

| Arquivo | Acao |
|---------|------|
| `electron/main.ts` | Modificar — integrar LlamaServerManager |
| `electron/preload.ts` | Modificar — adicionar bridge IPC |
| `backend/src/llm/ollama-client.ts` | Modificar — detectar API e adaptar requests |
| `backend/src/db/sqlite-client.ts` | Modificar — adicionar metodos para llama_settings |
| `frontend/components/Sidebar/index.tsx` | Modificar — adicionar secao ModelSelector |
| `frontend/components/Sidebar/ModelSelector.tsx` | Novo — componente de selecao de modelos |
| `electron/llama-server-manager.ts` | Novo — gerenciador do processo |
| `backend/src/db/migrations/add-llama-settings.ts` | Novo — migration SQLite |
| `.env.example` | Modificar — documentar variaveis LLAMA_* |
