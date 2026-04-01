# Tarefa 6.0: Store Zustand + API Client Frontend

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Dependencias

- 2.0 (Rotas REST de Colecoes)

## Visao Geral

Criar o store Zustand `useCollectionStore` para gerenciar o estado global de colecoes no frontend, com persistencia via `localStorage`. Criar as funcoes de API no client frontend para comunicacao com os endpoints REST de colecoes.

<skills>
### Conformidade com Skills Padroes

- **Next.js 14 (App Router) + React 18**: Componentes funcionais com TypeScript
- **Zustand 4.5**: Store com persistencia nativa
- **TypeScript 5**: Tipagem forte, interfaces definidas
</skills>

<requirements>
- Implementar `useCollectionStore` com a interface definida na techspec.md
- Persistir `selectedIds` via `localStorage` para manter selecao entre sessoes (PRD requisito 21)
- Criar funcoes de API para todos os endpoints de colecoes
- Tipos TypeScript alinhados com os modelos da techspec.md
</requirements>

## Subtarefas

- [ ] 6.1 Criar tipos/interfaces de colecoes no frontend (`Collection`, `CollectionFile`, `IndexingStatus`, etc.)
- [ ] 6.2 Criar funcoes de API em `frontend/lib/api.ts` para todos os endpoints de colecoes (fetchCollections, createCollection, renameCollection, deleteCollection, addFiles, removeFile, getFiles, getStatus)
- [ ] 6.3 Criar `frontend/stores/collection-store.ts` com `useCollectionStore` incluindo: state (collections, selectedIds, indexingStatus), actions (fetchCollections, toggleSelection, selectAll, deselectAll)
- [ ] 6.4 Implementar persistencia de `selectedIds` via Zustand persist middleware com `localStorage`
- [ ] 6.5 Escrever testes unitarios para o store e funcoes de API

## Detalhes de Implementacao

Consultar a secao "Interfaces Principais" da techspec.md para a interface do store:

```typescript
interface CollectionStore {
  collections: Collection[];
  selectedIds: Set<number>;
  indexingStatus: Record<number, IndexingStatus>;
  fetchCollections: () => Promise<void>;
  toggleSelection: (id: number) => void;
  selectAll: () => void;
  deselectAll: () => void;
}
```

Nota: Zustand ja esta no `package.json` do frontend (nao requer nova instalacao).

## Criterios de Sucesso

- Store gerencia corretamente o estado de colecoes, selecao e status de indexacao
- `selectedIds` persiste entre reloads da pagina via localStorage
- Funcoes de API se comunicam corretamente com todos os endpoints
- Tipos TypeScript alinhados com backend
- `npm run typecheck --workspace=frontend` passa sem erros

## Testes da Tarefa

- [ ] Testes de unidade:
  - `fetchCollections` atualiza `collections` no store
  - `toggleSelection` adiciona/remove ID do `selectedIds`
  - `selectAll` seleciona todas as colecoes
  - `deselectAll` limpa a selecao
  - `selectedIds` persiste via localStorage
  - Funcoes de API fazem requests corretos para cada endpoint

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `frontend/stores/collection-store.ts` (novo)
- `frontend/lib/api.ts` (modificado — novos tipos e funcoes)
