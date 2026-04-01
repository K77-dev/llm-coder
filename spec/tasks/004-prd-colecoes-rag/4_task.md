# Tarefa 4.0: Modificacao do Indexer

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Dependencias

- 1.0 (Migration SQL + CollectionService)

## Visao Geral

Modificar o `indexer.ts` para vincular automaticamente chunks a colecoes via `collection_files`. Ao adicionar arquivos a uma colecao, o sistema deve verificar se os chunks ja existem e, se nao, executar o pipeline de chunking + embedding existente. Atualizar `indexed_at` apos a indexacao.

<skills>
### Conformidade com Skills Padroes

- **Express 4 + TypeScript 5**: Modificacao de modulo existente
- **better-sqlite3**: Queries para verificar chunks existentes e atualizar `indexed_at`
- **Pino 8**: Logs de progresso de indexacao
- **Jest 29**: Testes unitarios e de integracao
</skills>

<requirements>
- Ao adicionar arquivos a uma colecao, inserir registros em `collection_files`
- Verificar se chunks ja existem em `code_chunks` (mesmo repo + file_path) antes de reindexar
- Se chunks nao existem: executar pipeline de chunking + embedding existente
- Atualizar `indexed_at` em `collection_files` apos indexacao bem-sucedida
- A indexacao nao deve bloquear a interface (execucao em background)
- O status de indexacao deve ser atualizavel por colecao (idle, indexing, done, error)
</requirements>

## Subtarefas

- [ ] 4.1 Adicionar logica ao fluxo de adicao de arquivos no `CollectionService.addFiles` para disparar indexacao em background
- [ ] 4.2 Implementar verificacao de chunks existentes: se `code_chunks` ja tem chunks para o mesmo repo+file_path, pular reindexacao
- [ ] 4.3 Integrar com pipeline existente de chunking + embedding para arquivos novos
- [ ] 4.4 Atualizar campo `indexed_at` em `collection_files` apos indexacao concluida
- [ ] 4.5 Implementar controle de status de indexacao por colecao (idle -> indexing -> done/error)
- [ ] 4.6 Garantir que remocao de arquivo de colecao nao remove chunks usados por outras colecoes
- [ ] 4.7 Escrever testes unitarios e de integracao

## Detalhes de Implementacao

Consultar a secao "Indexer — Vinculacao a Colecao" da techspec.md para o fluxo:

1. Inserir registros em `collection_files`
2. Para cada arquivo, verificar se ja existe chunk em `code_chunks` (mesmo repo + file_path)
3. Se nao existir: executar chunking + embedding (pipeline existente)
4. Atualizar `indexed_at` em `collection_files`

Consultar tambem "Riscos Conhecidos" sobre concorrencia na indexacao — manter o padrao singleton do indexer existente (fila de indexacao).

## Criterios de Sucesso

- Arquivos adicionados a colecao sao indexados automaticamente em background
- Arquivos ja indexados nao sao reindexados (apenas vinculados via `collection_files`)
- Status de indexacao reflete corretamente o estado (idle, indexing, done, error)
- Remocao de arquivo de uma colecao nao afeta chunks usados por outras colecoes
- `npm run typecheck --workspace=backend` passa sem erros
- `npm test --workspace=backend` passa com todos os testes

## Testes da Tarefa

- [ ] Testes de unidade:
  - Adicionar arquivo novo dispara indexacao e atualiza `indexed_at`
  - Adicionar arquivo ja indexado nao reprocessa chunks
  - Status muda corretamente: idle -> indexing -> done
  - Status muda para error quando indexacao falha
  - Remover arquivo de colecao nao remove chunks usados por outra colecao
- [ ] Testes de integracao:
  - Fluxo: adicionar arquivo a colecao -> verificar chunks criados -> verificar `indexed_at` atualizado

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `backend/src/rag/indexer.ts` (modificado)
- `backend/src/services/collection-service.ts` (modificado — integracao com indexer)
- `backend/src/rag/chunker.ts` (dependencia — pipeline existente)
