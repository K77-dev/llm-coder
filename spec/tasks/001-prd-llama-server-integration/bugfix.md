# Bugfix Report - Integracao llama-server com Electron

## BUG-01: Modelo ativo nunca e destacado na sidebar (mismatch de comparacao)

**Status:** Corrigido
**Severidade:** Media

### Causa Raiz

O metodo `LlamaServerManager.start(modelPath)` armazenava o caminho completo (ex: `/Users/kelsen/models/llama-7b.gguf`) em `state.activeModel`. O `ModelSelector` comparava `model.fileName` (ex: `llama-7b.gguf`) com `serverState.activeModel`, resultando em mismatch permanente. Isso impedia o destaque visual do modelo ativo (RF13) e a guarda de no-op ao clicar no modelo ja ativo (RF14).

### Correcao Aplicada

Alterado `LlamaServerManager.start()` em `electron/llama-server-manager.ts` para extrair apenas o filename via `path.basename(modelPath)` antes de armazenar em `state.activeModel`. A abordagem escolhida foi a Opcao A do bugs.md (alterar o manager), pois centraliza a correcao no ponto de origem do dado, sem exigir mudancas no frontend.

### Arquivos Modificados

- `electron/llama-server-manager.ts` (linha 61): `activeModel` agora recebe `path.basename(modelPath)`
- `backend/src/__tests__/llama-server-manager.test.ts`: Ajustados expects de `activeModel` para filename only

### Testes de Regressao

- `LlamaServerManager > activeModel stores filename only (BUG-01 regression) > should store only the filename in activeModel, not the full path`
- `LlamaServerManager > activeModel stores filename only (BUG-01 regression) > should allow ModelSelector comparison with fileName after start`
- `ModelSelector > highlights active model when activeModel is filename only (BUG-01 regression)`
- `ModelSelector > does not call selectModel when clicking the active model with filename match (BUG-01 regression)`

---

## BUG-02: Auto-start nao usa primeiro modelo da lista como fallback

**Status:** Corrigido
**Severidade:** Baixa

### Causa Raiz

A funcao `autoStartLlama()` em `electron/main.ts` retornava cedo quando `loadLastActiveModel()` retornava `null` (primeira execucao sem modelo persistido no SQLite). Nao havia fallback para escanear o diretorio e usar o primeiro modelo disponivel, violando o fluxo principal descrito no PRD: "inicia o llama-server com o ultimo modelo usado (ou o primeiro da lista)".

### Correcao Aplicada

Adicionado fallback em `autoStartLlama()`: quando `loadLastActiveModel()` retorna `null`, a funcao agora chama `llamaManager.scanModels(modelsDir)` e utiliza `availableModels[0].fileName` como modelo a carregar. Se nenhum modelo estiver disponivel no diretorio, loga a mensagem e retorna sem iniciar.

### Arquivos Modificados

- `electron/main.ts` (funcao `autoStartLlama`): Adicionado bloco de fallback com `scanModels()`

### Testes de Regressao

A funcao `autoStartLlama()` depende de modulos Electron (`ipcMain`, `BrowserWindow`) e do ciclo de vida do app, tornando-a testavel apenas em testes de integracao E2E. A logica de fallback foi validada por inspecao e os componentes subjacentes (`scanModels`, `start`) ja possuem cobertura unitaria completa.

---

## Verificacoes

| Check | Resultado |
|-------|-----------|
| `npm test --workspace=backend` | 55 testes passando |
| Frontend tests (`npx jest` em frontend/) | 17 testes passando |
| Electron tests (`npx jest` em electron/) | 11 testes passando |
| `npm run typecheck --workspace=backend` | Sem erros |
| `npm run typecheck --workspace=frontend` | Sem erros |
