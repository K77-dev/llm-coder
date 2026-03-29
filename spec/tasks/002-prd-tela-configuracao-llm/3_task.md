# Tarefa 3.0: Electron — IPC para dialogs e restart

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Dependencias

- Nenhuma

## Visao Geral

Adicionar handlers IPC no processo principal do Electron para abrir dialogs nativos de selecao de diretorio/arquivo, exibir dialogo de confirmacao e reiniciar o llama-server. Atualizar o preload script para expor esses metodos ao renderer via contextBridge.

<skills>
### Conformidade com Skills Padroes

- Electron 39 — IPC handlers, dialog API
- TypeScript 5 — Tipagem dos novos metodos
</skills>

<requirements>
- `dialog:select-directory` deve abrir dialog nativo e retornar o path selecionado ou null
- `dialog:select-file` deve abrir dialog nativo e retornar o path selecionado ou null
- `dialog:show-confirm` deve exibir dialog nativo com mensagem e retornar boolean
- `llama:restart` deve reiniciar o LlamaServerManager com novas configs
- Preload deve expor os novos metodos sob `window.electronAPI.dialog`
- Types em `electron.d.ts` devem ser atualizados
</requirements>

## Subtarefas

- [ ] 3.1 Adicionar handler `dialog:select-directory` no `electron/main.ts` usando `dialog.showOpenDialog({ properties: ['openDirectory'] })`
- [ ] 3.2 Adicionar handler `dialog:select-file` no `electron/main.ts` usando `dialog.showOpenDialog({ properties: ['openFile'] })`
- [ ] 3.3 Adicionar handler `dialog:show-confirm` no `electron/main.ts` usando `dialog.showMessageBox({ type: 'question', buttons: ['Sim', 'Nao'] })`
- [ ] 3.4 Adicionar handler `llama:restart` no `electron/main.ts` que chama `serverManager.restart()` com os novos parametros
- [ ] 3.5 Atualizar `electron/preload.ts` para expor `dialog.selectDirectory()`, `dialog.selectFile()`, `dialog.showConfirm(message)` via contextBridge
- [ ] 3.6 Atualizar `frontend/types/electron.d.ts` com a interface `dialog` (ver techspec.md secao "Interfaces Principais")

## Detalhes de Implementacao

Consultar techspec.md secoes:
- "Electron IPC (novos handlers)" — tabela de canais
- "Interfaces Principais" — interface `ElectronAPI` com metodos `dialog`
- "Restart do llama-server" — fluxo via Electron IPC

Seguir o padrao existente dos handlers IPC em `electron/main.ts` (ex: `llama:get-models`, `llama:select-model`).

## Criterios de Sucesso

- File picker de diretorio abre e retorna path selecionado
- File picker de arquivo abre e retorna path selecionado
- Dialog de confirmacao exibe mensagem e retorna true/false
- `window.electronAPI.dialog` esta acessivel no renderer
- Typecheck passa com `npx tsc --noEmit` nos arquivos Electron
- Typecheck do frontend passa com `npm run typecheck --workspace=frontend`

## Testes da Tarefa

- [ ] Teste manual: verificar que file picker de diretorio abre e retorna path
- [ ] Teste manual: verificar que file picker de arquivo abre e retorna path
- [ ] Teste manual: verificar que dialog de confirmacao funciona com Sim/Nao
- [ ] Verificacao de tipos: `npm run typecheck --workspace=frontend` passa com os novos tipos

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `electron/main.ts` — adicionar IPC handlers
- `electron/preload.ts` — expor novos metodos via contextBridge
- `electron/llama-server-manager.ts` — referencia para restart
- `frontend/types/electron.d.ts` — adicionar tipos para `dialog`
