# Tarefa 3.0: Preload IPC bridge + integracao main.ts

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Dependencias

- 2.0 (LlamaServerManager — necessario para os handlers IPC)

## Visao Geral

Criar a ponte IPC entre o main process e o renderer via `preload.ts`, e integrar o `LlamaServerManager` ao ciclo de vida do Electron em `main.ts`. Isso permite que o frontend controle o llama-server (selecionar modelo, verificar status) via `window.electronAPI.llama`.

<skills>
### Conformidade com Skills Padroes

- **Electron 39**: IPC, contextBridge, preload script, lifecycle hooks
- **TypeScript 5**: Tipagem das interfaces IPC
</skills>

<requirements>
- RF01 — O app deve iniciar o llama-server automaticamente ao subir o Electron
- RF02 — O app deve encerrar o processo ao fechar o Electron
- RF03 — Monitorar processo e exibir status na sidebar
- RF09 — Usuario pode atualizar lista de modelos manualmente
- RF14 — Ao clicar em modelo diferente, parar e reiniciar llama-server
- RF16 — Ultimo modelo persistido e carregado automaticamente
</requirements>

## Subtarefas

- [ ] 3.1 Modificar `electron/preload.ts`: usar `contextBridge.exposeInMainWorld` para expor `window.electronAPI.llama` com metodos: `getModels()`, `getState()`, `selectModel(fileName)`, `onStateChange(callback)`
- [ ] 3.2 Registrar IPC handlers no `electron/main.ts`: `llama:get-models`, `llama:get-state`, `llama:select-model`
- [ ] 3.3 Configurar emissao de `llama:state-changed` do main para renderer via `webContents.send` quando o estado do LlamaServerManager mudar
- [ ] 3.4 No `main.ts`, instanciar `LlamaServerManager` e integrar ao lifecycle:
  - No `app.whenReady()`: ler `LLAMA_MODELS_DIR` do .env, carregar ultimo modelo do SQLite, chamar `manager.start()`
  - No `app.on('before-quit')`: chamar `manager.stop()`
- [ ] 3.5 Criar arquivo de tipos compartilhado `electron/types.ts` com `ElectronAPI`, `LlamaServerState`, `ModelInfo` (usado pelo preload e frontend)
- [ ] 3.6 Escrever testes de integracao para os IPC handlers

## Detalhes de Implementacao

Consultar as secoes **Interfaces Principais** (ElectronAPI) e **IPC Channels** da `techspec.md` para:
- Definicao de `window.electronAPI.llama`
- Channels: `llama:get-models`, `llama:get-state`, `llama:select-model`, `llama:state-changed`
- Fluxo de dados: renderer → preload → ipcMain → LlamaServerManager → ipcMain → preload → renderer

## Criterios de Sucesso

- `window.electronAPI.llama` disponivel no renderer com todos os metodos
- IPC handlers respondem corretamente (get-models, get-state, select-model)
- Estado do servidor e propagado automaticamente ao renderer via `state-changed`
- App inicia llama-server automaticamente com ultimo modelo usado
- App encerra llama-server no `before-quit` sem processos orfaos
- Typecheck passa: `npm run typecheck --workspace=frontend`

## Testes da Tarefa

- [ ] Teste integracao: IPC handler `llama:get-models` retorna lista de modelos
- [ ] Teste integracao: IPC handler `llama:get-state` retorna estado atual
- [ ] Teste integracao: IPC handler `llama:select-model` chama restart com modelo correto
- [ ] Teste integracao: `state-changed` e emitido ao renderer quando estado muda
- [ ] Teste integracao: cleanup no `before-quit` encerra o processo

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `electron/preload.ts` — Modificar (adicionar bridge IPC)
- `electron/main.ts` — Modificar (integrar LlamaServerManager + IPC handlers)
- `electron/types.ts` — Novo (tipos compartilhados)
- `electron/llama-server-manager.ts` — Referencia (criado na tarefa 2.0)
- `backend/src/db/sqlite-client.ts` — Referencia (ler ultimo modelo)
