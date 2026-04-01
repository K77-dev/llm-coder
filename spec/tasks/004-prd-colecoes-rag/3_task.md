# Tarefa 3.0: Modificacao do Searcher + Chat Controller

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Dependencias

- 1.0 (Migration SQL + CollectionService)
- 2.0 (Rotas REST de Colecoes)

## Visao Geral

Modificar o `searcher.ts` para filtrar a busca vetorial por `collectionIds`, e atualizar o `chat.controller.ts` para aceitar e repassar `collectionIds` ao searcher. Este e o ponto central da feature — conecta a selecao de colecoes ao pipeline de busca RAG.

<skills>
### Conformidade com Skills Padroes

- **Express 4 + TypeScript 5**: Modificacao de controller existente
- **better-sqlite3**: JOIN com tabelas de colecoes na busca vetorial
- **Zod 3.22**: Atualizacao do schema do endpoint de chat
- **Jest 29**: Testes unitarios e de integracao
</skills>

<requirements>
- O metodo `searchSimilar` deve aceitar parametro opcional `collectionIds?: number[]`
- Quando `collectionIds` fornecido, fazer JOIN com `collection_files` para filtrar chunks
- Quando `collectionIds` vazio ou ausente, nenhum resultado e retornado (PRD requisito 20)
- O endpoint `POST /api/chat` deve aceitar campo opcional `collectionIds: number[]` no body
- O chat controller deve repassar collectionIds ao searcher
</requirements>

## Subtarefas

- [ ] 3.1 Adicionar parametro `collectionIds?: number[]` ao metodo `searchSimilar` em `backend/src/rag/searcher.ts`
- [ ] 3.2 Implementar o JOIN com `collection_files` na query de busca vetorial conforme SQL da techspec.md
- [ ] 3.3 Implementar comportamento: collectionIds vazio/ausente retorna array vazio (sem resultados)
- [ ] 3.4 Atualizar schema Zod do `POST /api/chat` para aceitar `collectionIds: number[]` opcional
- [ ] 3.5 Atualizar `chat.controller.ts` para extrair `collectionIds` do request e repassar ao searcher
- [ ] 3.6 Escrever testes unitarios e de integracao

## Detalhes de Implementacao

Consultar a secao "Searcher — Filtro por Colecoes" da techspec.md para o SQL do JOIN:

```
chunks candidatos = SELECT cc.*, v.embedding
  FROM code_chunks cc
  JOIN vectors v ON v.chunk_id = cc.id
  JOIN collection_files cf ON cf.repo = cc.repo AND cf.file_path = cc.file_path
  WHERE cf.collection_id IN (collectionIds)
```

Consultar tambem a secao "Modificacao no endpoint existente" da techspec.md para o formato do body do chat.

## Criterios de Sucesso

- Busca com collectionIds retorna apenas chunks vinculados as colecoes selecionadas
- Busca sem collectionIds retorna array vazio
- Arquivo em multiplas colecoes aparece nos resultados quando qualquer uma das colecoes esta selecionada
- Chat funciona normalmente com collectionIds (end-to-end do fluxo backend)
- `npm run typecheck --workspace=backend` passa sem erros
- `npm test --workspace=backend` passa com todos os testes

## Testes da Tarefa

- [ ] Testes de unidade:
  - `searchSimilar` com collectionIds retorna apenas chunks das colecoes selecionadas
  - `searchSimilar` sem collectionIds retorna array vazio
  - `searchSimilar` com collectionIds de colecoes vazias retorna array vazio
  - Arquivo em multiplas colecoes aparece quando qualquer colecao esta selecionada
- [ ] Testes de integracao:
  - POST /api/chat com collectionIds filtra resultados corretamente
  - POST /api/chat sem collectionIds funciona sem erro (retorna resposta sem contexto RAG)

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `backend/src/rag/searcher.ts` (modificado)
- `backend/src/api/controllers/chat.controller.ts` (modificado)
- `backend/src/api/routes/chat.ts` (modificado — schema Zod)
