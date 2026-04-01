# Tarefa 5.0: Migration de Dados Existentes

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Dependencias

- 1.0 (Migration SQL + CollectionService)

## Visao Geral

Implementar a migracao automatica de repositorios ja indexados para colecoes globais. Na primeira execucao apos a atualizacao, cada repositorio existente na tabela `code_chunks` se torna uma colecao global, preservando todos os chunks e vetores existentes sem necessidade de reindexacao.

<skills>
### Conformidade com Skills Padroes

- **better-sqlite3**: Migration SQL para converter dados existentes
- **Pino 8**: Logs de migracao
- **Jest 29**: Testes unitarios e de integracao
</skills>

<requirements>
- Converter cada `repo` distinto em `code_chunks` para uma colecao global (PRD requisito 26)
- Preservar todos os chunks e vetores existentes sem reindexacao (PRD requisito 27)
- Vincular arquivos existentes as novas colecoes via `collection_files`
- A migracao deve ser idempotente (nao duplicar se executada novamente)
- Registrar log da migracao realizada para notificacao ao usuario (PRD requisito 28)
</requirements>

## Subtarefas

- [ ] 5.1 Criar migration SQL que converte repos existentes em colecoes globais conforme SQL da techspec.md
- [ ] 5.2 Garantir idempotencia da migracao (usar INSERT OR IGNORE ou verificar existencia)
- [ ] 5.3 Adicionar log info indicando quantas colecoes foram criadas na migracao
- [ ] 5.4 Adicionar mecanismo de notificacao ao usuario sobre a migracao (ex: flag no endpoint de health ou resposta na primeira listagem)
- [ ] 5.5 Escrever testes unitarios e de integracao

## Detalhes de Implementacao

Consultar a secao "Migration de dados existentes" da techspec.md para o SQL:

```sql
-- Para cada repo distinto em code_chunks, criar uma colecao global
INSERT INTO collections (name, scope, project_dir)
  SELECT DISTINCT repo, 'global', NULL FROM code_chunks;

-- Vincular arquivos existentes as novas colecoes
INSERT INTO collection_files (collection_id, file_path, repo, indexed_at)
  SELECT c.id, cc.file_path, cc.repo, cc.indexed_at
  FROM collections c
  JOIN (SELECT DISTINCT repo, file_path, MAX(indexed_at) as indexed_at
        FROM code_chunks GROUP BY repo, file_path) cc
    ON c.name = cc.repo;
```

## Criterios de Sucesso

- Repositorios existentes sao convertidos em colecoes globais automaticamente
- Todos os chunks e vetores existentes sao preservados (sem reindexacao)
- Arquivos vinculados corretamente as colecoes via `collection_files`
- Migracao e idempotente (executar multiplas vezes nao causa duplicatas)
- Log indica quantas colecoes foram criadas
- `npm run typecheck --workspace=backend` passa sem erros
- `npm test --workspace=backend` passa com todos os testes

## Testes da Tarefa

- [ ] Testes de unidade:
  - Banco com 3 repos distintos cria 3 colecoes globais
  - Banco vazio nao cria colecoes
  - Executar migracao duas vezes nao duplica colecoes
  - Arquivos vinculados corretamente (count de `collection_files` bate com arquivos distintos)
- [ ] Testes de integracao:
  - Popular banco com dados no formato antigo -> rodar migracao -> listar colecoes via API -> verificar colecoes criadas corretamente

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `backend/src/db/migrations/` (migration de dados)
- `backend/src/db/sqlite-client.ts` (execucao da migration)
- `backend/src/services/collection-service.ts` (dependencia)
