# Tarefa 2.0: Backend — Restart endpoint e refactor do manager

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Dependencias

- 1.0 (Endpoints de Settings)

## Visao Geral

Estender o `LlamaServerManager` para aceitar configuracoes dinamicas (porta, path do executavel, diretorio de modelos) e criar o endpoint `POST /api/llama/restart` para reiniciar o llama-server com as novas configs. Tambem refatorar `autoStartLlamaServer()` para usar a hierarquia de configuracao SQLite → .env → defaults.

<skills>
### Conformidade com Skills Padroes

- Express 4 + TypeScript 5 — Controller e rotas
- Pino 8 — Logging de operacoes de restart
</skills>

<requirements>
- `LlamaServerManager` deve aceitar `port`, `serverPath` e `modelsDir` como parametros de configuracao
- `POST /api/llama/restart` deve ler configs do SQLite e reiniciar o servidor
- `autoStartLlamaServer()` deve consultar SQLite primeiro, depois .env, depois defaults
- Logar em nivel `warn` quando restart e solicitado
- Logar em nivel `error` se restart falhar
</requirements>

## Subtarefas

- [ ] 2.1 Estender `LlamaServerManager` para receber configs dinamicas no construtor e/ou no metodo `restart()` — atualmente so aceita `modelPath`
- [ ] 2.2 Criar handler `restartServerHandler` no controller que le configs do SQLite e chama `LlamaServerManager.restart()`
- [ ] 2.3 Adicionar rota `POST /restart` ao router `/api/llama`
- [ ] 2.4 Refatorar `autoStartLlamaServer()` para usar hierarquia SQLite → .env → defaults (reutilizar `getSettings()` da task 1.0)
- [ ] 2.5 Escrever testes unitarios para o manager com configs dinamicas
- [ ] 2.6 Escrever teste de integracao para o endpoint POST /api/llama/restart

## Detalhes de Implementacao

Consultar techspec.md secoes:
- "Restart do llama-server" — fluxo via HTTP
- "Hierarquia de configuracao (inicializacao)" — prioridade SQLite → .env → defaults

O `LlamaServerManager` atual usa `process.env.LLAMA_SERVER_PORT` e `process.env.LLAMA_SERVER_PATH` diretamente. A refatoracao deve permitir que esses valores sejam passados como parametros, mantendo backward compatibility (se nao forem passados, usa env/defaults).

## Criterios de Sucesso

- `POST /api/llama/restart` reinicia o servidor com configs do SQLite
- `autoStartLlamaServer()` usa configs do SQLite quando disponiveis
- Servidor reinicia corretamente com nova porta/path
- Testes passam com `npm test --workspace=backend`
- Typecheck passa com `npm run typecheck --workspace=backend`

## Testes da Tarefa

- [ ] Teste unitario: `LlamaServerManager` aceita port e serverPath como parametros
- [ ] Teste unitario: `restart()` para o servidor e inicia com novos parametros
- [ ] Teste integracao: POST /api/llama/restart retorna 200 e reinicia servidor
- [ ] Teste unitario: `autoStartLlamaServer()` prioriza SQLite sobre .env

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `electron/llama-server-manager.ts` — estender para configs dinamicas
- `backend/src/api/controllers/llama.controller.ts` — adicionar handler de restart
- `backend/src/api/routes/llama.ts` — adicionar rota POST /restart
- `backend/src/db/sqlite-client.ts` — ler settings para hierarquia de config
