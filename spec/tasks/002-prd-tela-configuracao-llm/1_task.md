# Tarefa 1.0: Backend — Endpoints de Settings (GET/PUT /api/llama/settings)

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Dependencias

- Nenhuma

## Visao Geral

Criar os endpoints REST para leitura e escrita de configuracoes do LLM. O GET retorna as configuracoes atuais usando a hierarquia SQLite → .env → defaults. O PUT valida o payload com Zod, persiste no SQLite e indica se o llama-server precisa ser reiniciado.

<skills>
### Conformidade com Skills Padroes

- Express 4 + TypeScript 5 — Controller e rotas
- Zod 3.22 — Validacao do payload
- better-sqlite3 — Persistencia via `getLlamaSetting`/`setLlamaSetting`
- Pino 8 — Logging de operacoes
</skills>

<requirements>
- GET /api/llama/settings deve retornar todas as 7 configuracoes com merge SQLite → .env → defaults
- PUT /api/llama/settings deve validar com Zod: porta 1024-65535, numericos > 0
- PUT deve persistir todas as keys na tabela `llama_settings`
- PUT deve retornar `restartRequired: true` quando `llamaModelsDir`, `llamaServerPort` ou `llamaServerPath` mudarem em relacao ao valor atual
- Valores numericos devem ser convertidos de string (SQLite) para number na resposta
- Logar em nivel `info` quando settings sao salvas
</requirements>

## Subtarefas

- [ ] 1.1 Criar interface `LlamaSettings` e constante `DEFAULT_SETTINGS` com os 7 campos e valores padrao (ver techspec.md secao "Interfaces Principais")
- [ ] 1.2 Criar funcao `getSettings(): LlamaSettings` que le cada key do SQLite via `getLlamaSetting`, faz fallback para `process.env` e depois para `DEFAULT_SETTINGS`
- [ ] 1.3 Criar funcao `saveSettings(settings: LlamaSettings): { settings: LlamaSettings; restartRequired: boolean }` que persiste via `setLlamaSetting` e compara valores criticos com os atuais
- [ ] 1.4 Criar schema Zod `llamaSettingsSchema` para validacao do body do PUT (ver techspec.md secao "Endpoints de API")
- [ ] 1.5 Criar handlers `getSettingsHandler` e `updateSettingsHandler` no controller
- [ ] 1.6 Adicionar rotas `GET /settings` e `PUT /settings` ao router `/api/llama` existente (`backend/src/api/routes/llama.ts`)
- [ ] 1.7 Escrever testes unitarios para `getSettings` (merge hierarchy) e `saveSettings` (deteccao de restart)
- [ ] 1.8 Escrever testes de integracao para os endpoints GET e PUT com banco SQLite real

## Detalhes de Implementacao

Consultar techspec.md secoes:
- "Interfaces Principais" — definicao de `LlamaSettings` e `DEFAULT_SETTINGS`
- "Modelos de Dados" — tabela `llama_settings` e mapeamento de keys
- "Endpoints de API" — contratos GET e PUT

Utilizar as funcoes existentes `getLlamaSetting(key)` e `setLlamaSetting(key, value)` de `backend/src/db/sqlite-client.ts`. Nao criar nova tabela — a `llama_settings` ja existe.

Mapeamento de keys do interface para o banco:

| Campo interface | Key no SQLite | Env var |
|-----------------|---------------|---------|
| `llamaModelsDir` | `llama_models_dir` | `LLAMA_MODELS_DIR` |
| `llamaServerPort` | `llama_server_port` | `LLAMA_SERVER_PORT` |
| `llamaServerPath` | `llama_server_path` | `LLAMA_SERVER_PATH` |
| `embeddingModel` | `embedding_model` | `EMBEDDING_MODEL` |
| `maxMemoryMb` | `max_memory_mb` | `MAX_MEMORY_MB` |
| `cacheTtl` | `cache_ttl` | `CACHE_TTL` |
| `lruCacheSize` | `lru_cache_size` | `LRU_CACHE_SIZE` |

## Criterios de Sucesso

- `GET /api/llama/settings` retorna 200 com todos os 7 campos tipados corretamente
- `PUT /api/llama/settings` com payload valido retorna 200 com `settings` e `restartRequired`
- `PUT /api/llama/settings` com porta fora de range retorna 400
- `PUT /api/llama/settings` com numero negativo retorna 400
- Valores persistidos no SQLite sao retornados no proximo GET (prevalecendo sobre .env)
- Testes passam com `npm test --workspace=backend`
- Typecheck passa com `npm run typecheck --workspace=backend`

## Testes da Tarefa

- [ ] Teste unitario: `getSettings` retorna defaults quando SQLite e .env estao vazios
- [ ] Teste unitario: `getSettings` prioriza SQLite sobre .env
- [ ] Teste unitario: `saveSettings` detecta `restartRequired` quando porta muda
- [ ] Teste unitario: `saveSettings` retorna `restartRequired: false` quando so cache muda
- [ ] Teste unitario: Schema Zod rejeita porta < 1024 e porta > 65535
- [ ] Teste unitario: Schema Zod rejeita numeros negativos em campos numericos
- [ ] Teste integracao: GET /api/llama/settings retorna defaults inicialmente
- [ ] Teste integracao: PUT /api/llama/settings persiste e retorna valores salvos
- [ ] Teste integracao: PUT com payload invalido retorna 400

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `backend/src/api/controllers/llama.controller.ts` — adicionar handlers de settings
- `backend/src/api/routes/llama.ts` — adicionar rotas GET/PUT /settings
- `backend/src/db/sqlite-client.ts` — usar `getLlamaSetting`/`setLlamaSetting` existentes
- `backend/src/db/migrations/add-llama-settings.ts` — referencia do schema da tabela
- `backend/src/__tests__/` — testes unitarios e de integracao
