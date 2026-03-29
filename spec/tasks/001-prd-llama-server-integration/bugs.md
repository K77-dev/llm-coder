# Bugs - Integracao llama-server com Electron

## BUG-01: Modelo ativo nunca e destacado na sidebar (mismatch de comparacao)

**Severidade:** Media
**Status:** Corrigido
**Componente:** `frontend/components/Sidebar/ModelSelector.tsx`

### Descricao

O `ModelSelector` compara `model.fileName` (ex: `llama-7b.gguf`) com `serverState.activeModel`, que na producao contem o caminho completo (ex: `/Users/kelsen/models/llama-7b.gguf`). Isso faz com que:

1. O modelo ativo nunca seja destacado visualmente na sidebar (RF13 falha)
2. A guarda de no-op na linha 98 (`if (fileName === serverState.activeModel) return`) nunca seja acionada, permitindo restarts desnecessarios ao clicar no modelo ja ativo (RF14 degradado)

### Causa Raiz

Em `electron/main.ts` linhas 136-138, o handler `llama:select-model` faz:
```typescript
const modelPath = path.join(modelsDir, fileName);
await llamaManager.restart(modelPath);
```

O `LlamaServerManager.start(modelPath)` armazena o `modelPath` completo em `state.activeModel`. Porem, o `ModelSelector` compara com `model.fileName` (apenas o nome do arquivo).

### Reproducao

1. Abrir o app Electron com `LLAMA_MODELS_DIR` configurado
2. Clicar em um modelo para inicia-lo
3. Observar que nenhum modelo fica destacado com indicador verde (dot verde + fundo azul)
4. Clicar no mesmo modelo novamente -- o llama-server reinicia desnecessariamente

### Correcao Sugerida

**Opcao A (recomendada):** Alterar o `LlamaServerManager` para armazenar apenas o `fileName` em `activeModel` em vez do caminho completo. Ou alterar o handler IPC para extrair o `path.basename()` antes de atribuir ao estado.

**Opcao B:** Alterar o `ModelSelector` para comparar usando `model.path === serverState.activeModel` em vez de `model.fileName`.

### Testes Afetados

Os testes unitarios do `ModelSelector` nao detectam esse bug porque o mock de estado usa `activeModel: 'llama-7b.gguf'` (apenas filename), enquanto em producao o valor sera o caminho completo.

---

## BUG-02: Auto-start nao usa primeiro modelo da lista como fallback

**Severidade:** Baixa
**Status:** Corrigido
**Componente:** `electron/main.ts`

### Descricao

O PRD define no Fluxo Principal (secao Experiencia do Usuario): "O app detecta os modelos no diretorio configurado e inicia o llama-server com o ultimo modelo usado (**ou o primeiro da lista**)". Porem, a funcao `autoStartLlama()` apenas tenta carregar o ultimo modelo persistido. Se nao houver modelo persistido (primeira execucao), o llama-server nao e iniciado automaticamente.

### Causa Raiz

Em `electron/main.ts`, a funcao `autoStartLlama()` (linhas 151-169) retorna cedo quando `loadLastActiveModel()` retorna `null`:
```typescript
const lastModel = loadLastActiveModel();
if (!lastModel) {
  console.log('[llama] No last active model found, skipping auto-start');
  return;
}
```

Nao ha fallback para escanear o diretorio e usar o primeiro modelo disponivel.

### Reproducao

1. Iniciar o app pela primeira vez (sem modelo persistido no SQLite)
2. Ter arquivos `.gguf` no diretorio `LLAMA_MODELS_DIR`
3. O app nao inicia o llama-server automaticamente apesar de haver modelos disponiveis

### Correcao Sugerida

Adicionar fallback em `autoStartLlama()`:
```typescript
let modelToLoad = loadLastActiveModel();
if (!modelToLoad) {
  const models = llamaManager.scanModels(modelsDir);
  if (models.length > 0) {
    modelToLoad = models[0].fileName;
  }
}
if (!modelToLoad) {
  console.log('[llama] No models available, skipping auto-start');
  return;
}
```
