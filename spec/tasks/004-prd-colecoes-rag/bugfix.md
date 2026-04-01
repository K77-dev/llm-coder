# Relatorio de Bugfix - Colecoes RAG

**Data**: 2026-03-29
**Branch**: 004-prd-colecoes-rag

---

## BUG-01: Criar colecao local sem projectDir retorna HTTP 500 ao inves de 400

**Severidade**: Media
**Status**: Corrigido

### Causa Raiz

Em `CollectionService.createCollection()`, quando `scope === 'local'` e `projectDir` esta ausente, era lancado um `Error` generico. O `handleServiceError()` no controller so tratava `DuplicateNameError` e `NotFoundError`, deixando o `Error` generico cair no handler padrao do Express que retorna 500.

### Correcao Aplicada

1. Criada classe `ValidationError` em `backend/src/services/collection-types.ts` para representar erros de validacao de negocio
2. Alterado `CollectionService.createCollection()` para lancar `ValidationError` ao inves de `Error` generico
3. Adicionado tratamento de `ValidationError` em `handleServiceError()` no controller, mapeando para HTTP 400

### Arquivos Alterados

- `backend/src/services/collection-types.ts` - Nova classe `ValidationError`
- `backend/src/services/collection-service.ts` - Import e uso de `ValidationError`
- `backend/src/api/controllers/collection.controller.ts` - Import e tratamento de `ValidationError` no `handleServiceError()`

### Testes de Regressao

- `backend/src/__tests__/collection-api.test.ts` - Novo teste: `should return 400 for local scope without projectDir`
- `backend/src/__tests__/collection-service.test.ts` - Testes atualizados para validar tipo `ValidationError`

---

## BUG-02: CreateCollectionModal nao implementa focus trap

**Severidade**: Baixa
**Status**: Corrigido

### Causa Raiz

O `CreateCollectionModal` capturava apenas a tecla Escape para fechar o modal, mas nao implementava focus trap. Ao pressionar Tab repetidamente, o foco escapava do modal para elementos da pagina. O `DeleteConfirmDialog` ja implementava focus trap corretamente, mas o padrao nao foi replicado no modal de criacao.

### Correcao Aplicada

Adicionada logica de focus trap no handler de `keydown` do modal, seguindo o mesmo padrao do `DeleteConfirmDialog`:
- Ao pressionar Tab no ultimo elemento focavel, o foco retorna ao primeiro
- Ao pressionar Shift+Tab no primeiro elemento focavel, o foco vai para o ultimo
- Elementos focaveis considerados: `input`, `button`, `[tabindex]:not([tabindex="-1"])`

### Arquivos Alterados

- `frontend/components/CollectionList/CreateCollectionModal.tsx` - Logica de focus trap no useEffect de keydown

### Testes de Regressao

- `frontend/components/CollectionList/__tests__/CollectionList.test.tsx` - Dois novos testes:
  - `should trap focus within the create modal on Tab`
  - `should trap focus within the create modal on Shift+Tab`

---

## Verificacao Final

| Check | Resultado |
|-------|-----------|
| `npm test --workspace=backend` | 223 testes passando |
| `npm test --workspace=frontend` (CollectionList) | 39 testes passando |
| `npm run typecheck --workspace=backend` | Sem erros |
| `npm run typecheck --workspace=frontend` | Sem erros |
