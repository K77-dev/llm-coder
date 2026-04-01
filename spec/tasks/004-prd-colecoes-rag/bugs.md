# Bugs - Colecoes de RAG

## BUG-01: Criar colecao local sem projectDir retorna HTTP 500 ao inves de 400

- **Severidade**: Media
- **Status**: Corrigido
- **Componente**: `backend/src/api/controllers/collection.controller.ts` / `backend/src/services/collection-service.ts`

### Descricao

Ao enviar `POST /api/collections` com `scope: "local"` sem o campo `projectDir`, o servidor retorna HTTP 500 (Internal Server Error) ao inves de HTTP 400 (Bad Request).

### Passos para Reproduzir

```bash
curl -s -X POST http://localhost:3001/api/collections \
  -H "Content-Type: application/json" \
  -d '{"name":"Bad Local","scope":"local"}'
```

### Resultado Atual

```json
{"error":"Internal server error"}
```
HTTP Status: 500

### Resultado Esperado

```json
{"error":"projectDir is required for local scope collections"}
```
HTTP Status: 400

### Causa Raiz

Em `CollectionService.createCollection()`, quando `scope === 'local'` e `projectDir` esta ausente, e lancado um `Error` generico. O `handleServiceError()` no controller so trata `DuplicateNameError` e `NotFoundError`, deixando o `Error` generico cair no handler padrao que retorna 500.

### Correcao Sugerida

Opcao A: Adicionar validacao no schema Zod do controller para exigir `projectDir` quando `scope === 'local'` (via `refine`).

Opcao B: No `handleServiceError`, tratar erros com mensagem especifica como 400, ou criar uma classe `ValidationError` no service.

---

## BUG-02: CreateCollectionModal nao implementa focus trap

- **Severidade**: Baixa
- **Status**: Corrigido
- **Componente**: `frontend/components/CollectionList/CreateCollectionModal.tsx`

### Descricao

O modal de criacao de colecao nao implementa focus trap. Quando o modal esta aberto, o usuario pode navegar com Tab para elementos fora do modal. O `DeleteConfirmDialog` implementa focus trap corretamente, mas o `CreateCollectionModal` nao segue o mesmo padrao.

### Impacto

Afeta acessibilidade (WCAG 2.4.3 - Focus Order). Usuarios que navegam por teclado podem perder o contexto do modal ao usar Tab repetidamente.

### Correcao Sugerida

Adicionar logica de focus trap similar ao `DeleteConfirmDialog`, capturando a tecla Tab e circulando o foco entre os elementos focaveis dentro do modal.
