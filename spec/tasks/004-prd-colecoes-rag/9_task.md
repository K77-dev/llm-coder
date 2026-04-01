# Tarefa 9.0: Integracao ChatInterface

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Dependencias

- 6.0 (Store Zustand + API Client Frontend)
- 7.0 (Componente CollectionList + Sidebar)

## Visao Geral

Integrar a selecao de colecoes ao fluxo de chat. O `ChatInterface` deve ler as colecoes selecionadas do `useCollectionStore` e envia-las como `collectionIds` no payload de `POST /api/chat`. Isso fecha o loop completo: selecionar colecoes na sidebar -> enviar mensagem -> resposta filtrada pelo contexto RAG das colecoes.

<skills>
### Conformidade com Skills Padroes

- **Next.js 14 (App Router) + React 18**: Modificacao de componente existente
- **Zustand 4.5**: Consumir `useCollectionStore`
- **TypeScript 5**: Tipagem forte
</skills>

<requirements>
- O ChatInterface deve enviar `collectionIds` (array dos IDs selecionados) no body de `POST /api/chat` (PRD requisito 19)
- Se nenhuma colecao selecionada, enviar array vazio (PRD requisito 20 — sem resultados RAG)
- A selecao de colecoes deve persistir entre sessoes (ja garantido pelo store na task 6.0)
- O fluxo de chat existente nao deve quebrar para usuarios sem colecoes
</requirements>

## Subtarefas

- [ ] 9.1 Modificar a funcao de envio de mensagem no `ChatInterface` para incluir `collectionIds` do store no payload
- [ ] 9.2 Atualizar tipos do request de chat no frontend para incluir `collectionIds: number[]`
- [ ] 9.3 Adicionar indicador visual no chat mostrando quantas colecoes estao ativas (ex: badge "3 colecoes ativas")
- [ ] 9.4 Garantir compatibilidade: chat sem colecoes selecionadas funciona normalmente (sem contexto RAG)
- [ ] 9.5 Escrever testes

## Detalhes de Implementacao

Consultar a secao "Fluxo de dados principal" da techspec.md:

```
Sidebar (seleciona colecoes) -> ChatInterface (envia collectionIds)
  -> POST /api/chat { collectionIds } -> chat.controller
  -> searcher.searchSimilar({ collectionIds }) -> JOIN collection_files + code_chunks + vectors
  -> resultados filtrados -> resposta LLM
```

O ChatInterface deve acessar `useCollectionStore.getState().selectedIds` e converter o `Set<number>` para `number[]` antes de enviar.

## Criterios de Sucesso

- Mensagens de chat incluem `collectionIds` no payload
- Respostas da LLM usam apenas contexto das colecoes selecionadas
- Sem colecoes selecionadas, chat funciona sem contexto RAG
- Indicador visual mostra quantas colecoes estao ativas
- Fluxo de chat existente nao quebra
- `npm run typecheck --workspace=frontend` passa sem erros

## Testes da Tarefa

- [ ] Testes de unidade:
  - Envio de mensagem inclui collectionIds do store no payload
  - Com colecoes selecionadas, payload contem array com IDs corretos
  - Sem colecoes selecionadas, payload contem array vazio
  - Indicador de colecoes ativas renderiza corretamente

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `frontend/components/ChatInterface/index.tsx` (modificado)
- `frontend/lib/api.ts` (modificado — tipo do request de chat)
- `frontend/stores/collection-store.ts` (dependencia)
