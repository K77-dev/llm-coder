# Tech Spec: Tela de Configuracao do LLM

## Resumo Executivo

Esta Tech Spec define a implementacao de um modal de configuracoes de LLM acessivel pelo botao de engrenagem na activity bar. A arquitetura segue o padrao existente do projeto: frontend React com estado local (`useState`), comunicacao via API REST (expandindo `/api/llama`) com fallback Electron IPC para file pickers, e persistencia na tabela `llama_settings` do SQLite. O llama-server sera reiniciado condicionalmente via dialogo nativo do Electron (ou `window.confirm` no browser) quando parametros criticos mudarem.

## Arquitetura do Sistema

### Visao Geral dos Componentes

- **SettingsModal** (novo) — Componente React que renderiza o modal com formulario de configuracoes organizado em secoes (LLM Server, Embedding, Cache). Gerencia estado local e validacao.
- **Toast** (novo) — Componente leve de notificacao com auto-dismiss, usando React portal. Reutilizavel por outros componentes.
- **useToast hook** (novo) — Hook para disparar toasts de qualquer componente.
- **settings.controller.ts** (novo) — Controller Express para GET/PUT de settings. Orquestra leitura/escrita no SQLite e notificacao de mudancas criticas.
- **Llama routes** (modificado) — Adicionar rotas de settings ao router existente `/api/llama`.
- **Electron main.ts** (modificado) — Adicionar handlers IPC para file picker (diretorio e arquivo) e dialog de confirmacao.
- **Electron preload.ts** (modificado) — Expor novos metodos `selectDirectory()`, `selectFile()` e `showConfirmDialog()` via contextBridge.
- **Sidebar/index.tsx** (modificado) — Conectar botao de engrenagem ao SettingsModal.
- **electron.d.ts** (modificado) — Adicionar tipos para os novos metodos IPC.
- **llama-server-manager.ts** (modificado) — Expor metodo para reiniciar com novas configs (port, path, modelsDir).

**Fluxo de dados:**

```
Sidebar (gear click) → SettingsModal (open)
  → GET /api/llama/settings → SQLite (read)
  → Usuario edita campos
  → PUT /api/llama/settings → Zod validation → SQLite (write)
    → Se configs criticas mudaram:
      → IPC dialog.showMessageBox / window.confirm
      → Se confirmou: POST /api/llama/restart (ou IPC llama:restart)
  → Toast (sucesso/erro)
```

## Design de Implementacao

### Interfaces Principais

```typescript
// Settings types (shared or co-located)
interface LlamaSettings {
  llamaModelsDir: string;
  llamaServerPort: number;
  llamaServerPath: string;
  embeddingModel: string;
  maxMemoryMb: number;
  cacheTtl: number;
  lruCacheSize: number;
}

// Defaults
const DEFAULT_SETTINGS: LlamaSettings = {
  llamaModelsDir: '~/models',
  llamaServerPort: 8080,
  llamaServerPath: 'llama-server',
  embeddingModel: 'nomic-embed-text',
  maxMemoryMb: 13000,
  cacheTtl: 3600,
  lruCacheSize: 500,
};
```

```typescript
// Electron preload additions
interface ElectronAPI {
  llama: {
    // ... existing methods
  };
  dialog: {
    selectDirectory(): Promise<string | null>;
    selectFile(): Promise<string | null>;
    showConfirm(message: string): Promise<boolean>;
  };
}
```

```typescript
// Toast component props
interface ToastProps {
  message: string;
  type: 'success' | 'error';
  duration?: number; // default 3000ms
}
```

### Modelos de Dados

A tabela `llama_settings` ja existe com schema key-value:

```sql
CREATE TABLE IF NOT EXISTS llama_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**Keys utilizadas:**

| Key | Tipo | Default | Requer restart |
|-----|------|---------|----------------|
| `llama_models_dir` | string | `~/models` | sim |
| `llama_server_port` | number (string) | `8080` | sim |
| `llama_server_path` | string | `llama-server` | sim |
| `embedding_model` | string | `nomic-embed-text` | nao |
| `max_memory_mb` | number (string) | `13000` | nao |
| `cache_ttl` | number (string) | `3600` | nao |
| `lru_cache_size` | number (string) | `500` | nao |

Valores numericos sao armazenados como string no SQLite e convertidos no controller.

### Endpoints de API

Adicionados ao router existente `/api/llama`:

**`GET /api/llama/settings`**

Retorna todas as configuracoes atuais. Para cada key, prioridade: SQLite → .env → default.

```typescript
// Response 200
{
  llamaModelsDir: string;
  llamaServerPort: number;
  llamaServerPath: string;
  embeddingModel: string;
  maxMemoryMb: number;
  cacheTtl: number;
  lruCacheSize: number;
}
```

**`PUT /api/llama/settings`**

Salva configuracoes no SQLite. Retorna as configuracoes salvas e indica se restart e necessario.

```typescript
// Request body (validado com Zod)
{
  llamaModelsDir: string;
  llamaServerPort: number;      // 1024-65535
  llamaServerPath: string;
  embeddingModel: string;
  maxMemoryMb: number;          // > 0
  cacheTtl: number;             // > 0
  lruCacheSize: number;         // > 0
}

// Response 200
{
  settings: LlamaSettings;
  restartRequired: boolean;     // true se port, path ou modelsDir mudaram
}
```

## Pontos de Integracao

### Electron IPC (novos handlers)

| Canal | Direcao | Descricao |
|-------|---------|-----------|
| `dialog:select-directory` | renderer → main | Abre dialog nativo de selecao de diretorio |
| `dialog:select-file` | renderer → main | Abre dialog nativo de selecao de arquivo |
| `dialog:show-confirm` | renderer → main | Exibe dialog de confirmacao nativo |

No browser (sem Electron), file pickers sao ocultados e `window.confirm()` substitui o dialog nativo.

### Restart do llama-server

Quando o usuario confirma o restart:

1. **Via Electron (IPC):** O renderer envia `llama:restart` com as novas configs. O main process chama `LlamaServerManager.restart()` com os novos parametros (port, path, modelsDir).
2. **Via HTTP (browser):** `POST /api/llama/restart` no backend. O controller para o servidor atual e reinicia com as novas configs lidas do SQLite.

O `LlamaServerManager` precisa ser estendido para aceitar novos parametros de configuracao no restart, alem do modelPath atual.

### Hierarquia de configuracao (inicializacao)

```
SQLite (llama_settings) → .env → defaults hardcoded
```

Na inicializacao do app, `autoStartLlamaServer()` deve consultar SQLite primeiro. Apenas se a key nao existir no SQLite, usa process.env, e em ultimo caso o default.

## Abordagem de Testes

### Testes Unitarios

- **settings.controller.ts**: Testar GET (merge SQLite + env + defaults), PUT (validacao Zod, persistencia, deteccao de restart required).
- **Validacao Zod**: Testar rejeicao de porta fora de range, numeros negativos, tipos invalidos.
- **Hierarquia de config**: Testar que SQLite prevalece sobre .env, e .env sobre defaults.

### Testes de Integracao

- **API endpoints**: Testar GET/PUT `/api/llama/settings` com banco SQLite real (seguindo padrao existente em `llama-settings.test.ts`).
- **Persistencia**: Salvar settings, reiniciar contexto, verificar que valores persistiram.

### Testes E2E

- **Fluxo completo com Playwright**: Abrir modal via gear icon, alterar campos, salvar, verificar toast de sucesso, reabrir modal e confirmar valores persistidos.
- **Validacao**: Tentar salvar porta invalida, verificar erro inline.
- **Cancelamento**: Alterar campos, cancelar, reabrir e verificar valores originais.

## Sequenciamento de Desenvolvimento

### Ordem de Construcao

1. **Backend: endpoints de settings** — GET/PUT `/api/llama/settings` com controller, validacao Zod e logica de merge (SQLite/env/defaults). Fundacao para tudo.
2. **Backend: restart endpoint e refactor do manager** — Estender `LlamaServerManager` para aceitar configs dinamicas. Adicionar `POST /api/llama/restart`.
3. **Electron: IPC para dialogs** — Handlers para `dialog:select-directory`, `dialog:select-file`, `dialog:show-confirm` no main process + preload.
4. **Frontend: componente Toast** — Componente reutilizavel com portal React, hook `useToast`, auto-dismiss.
5. **Frontend: SettingsModal** — Modal completo com secoes, formulario, validacao inline, integracao com API e IPC.
6. **Frontend: integracao Sidebar** — Conectar botao de engrenagem ao SettingsModal.
7. **Backend: hierarquia de config na inicializacao** — Refatorar `autoStartLlamaServer()` para usar hierarquia SQLite → .env → defaults.
8. **Testes** — Unitarios no controller, integracao nos endpoints, E2E do fluxo completo.

### Dependencias Tecnicas

- Tasks 1-2 (backend) e task 3 (Electron) podem ser desenvolvidas em paralelo.
- Task 4 (Toast) pode ser desenvolvida em paralelo com tasks 1-3.
- Task 5 (SettingsModal) depende de tasks 1, 3 e 4.
- Task 6 depende de task 5.
- Task 7 pode ser desenvolvida em paralelo com tasks 5-6.

## Monitoramento e Observabilidade

- **Logs (Pino)**: Logar em nivel `info` quando settings sao salvas, e em nivel `warn` quando restart do llama-server e solicitado. Logar em nivel `error` falhas de persistencia ou restart.
- **Metricas**: Nao aplicavel para esta funcionalidade (operacao local, nao ha necessidade de metricas Prometheus).
- **Dashboards**: Nao aplicavel (app desktop local).

## Consideracoes Tecnicas

### Decisoes Principais

| Decisao | Justificativa | Alternativa rejeitada |
|---------|---------------|-----------------------|
| Toast custom com Tailwind | Evita dependencia externa; componente simples (~50 linhas) atende ao requisito | react-hot-toast — adiciona dependencia para uso minimo |
| useState local no modal | Settings e estado local do modal; padrao consistente com o resto do projeto | Zustand — instalado mas nao usado; nao ha necessidade de estado global para settings |
| Dialog nativo do Electron | Experiencia nativa do OS para confirmacao critica; fallback simples com window.confirm | Modal custom — mais codigo, experiencia menos nativa |
| Expandir /api/llama | Settings sao do dominio llama; coesao com rotas existentes | Novo /api/settings — over-engineering para escopo atual |
| Key-value no SQLite existente | Tabela `llama_settings` ja existe com schema adequado; zero migracao necessaria | Tabela relacional — complexidade desnecessaria para ~7 configs |

### Riscos Conhecidos

- **Restart do server durante operacao**: Se o usuario reiniciar o llama-server enquanto um chat esta em andamento, a requisicao falhara. Mitigacao: o dialog de confirmacao avisa sobre o impacto.
- **Permissoes de file system**: O diretorio de modelos ou path do executavel informado pode nao existir ou nao ter permissao. Mitigacao: validacao no backend ao salvar (verificar existencia do path).
- **Conflito .env vs SQLite**: Apos salvar no SQLite, o .env fica desatualizado. Mitigacao: documentar que SQLite prevalece; .env serve apenas como fallback inicial.

### Conformidade com Skills Padroes

| Skill | Aplicacao |
|-------|-----------|
| Express 4 + TypeScript 5 | Controller e rotas de settings |
| Next.js 14 (App Router) + React 18 | SettingsModal e Toast components |
| Electron 39 | IPC handlers para dialogs e restart |
| Tailwind 3.4 | Estilizacao do modal e toast |
| better-sqlite3 | Persistencia via `getLlamaSetting`/`setLlamaSetting` |
| Zod 3.22 | Validacao do payload PUT |
| Pino 8 | Logging de operacoes de settings |

### Arquivos relevantes e dependentes

| Arquivo | Acao |
|---------|------|
| `backend/src/api/routes/llama.ts` | Modificar — adicionar rotas settings |
| `backend/src/api/controllers/llama.controller.ts` | Modificar — adicionar handlers GET/PUT settings, restart |
| `backend/src/db/sqlite-client.ts` | Ler — usar `getLlamaSetting`/`setLlamaSetting` existentes |
| `electron/main.ts` | Modificar — adicionar IPC handlers para dialogs e restart |
| `electron/preload.ts` | Modificar — expor novos metodos via contextBridge |
| `electron/llama-server-manager.ts` | Modificar — aceitar configs dinamicas no restart |
| `frontend/components/Sidebar/index.tsx` | Modificar — conectar gear icon ao SettingsModal |
| `frontend/components/SettingsModal/index.tsx` | Novo — modal de configuracoes |
| `frontend/components/Toast/index.tsx` | Novo — componente de notificacao |
| `frontend/lib/hooks/useToast.ts` | Novo — hook para disparar toasts |
| `frontend/types/electron.d.ts` | Modificar — adicionar tipos para novos IPC methods |
