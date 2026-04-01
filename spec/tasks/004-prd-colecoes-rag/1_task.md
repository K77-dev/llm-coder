# Tarefa 1.0: Migration SQL + CollectionService

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Dependencias

- Nenhuma

## Visao Geral

Criar a base de dados e a logica de negocio para colecoes de RAG. Isso inclui a migration SQL para criar as tabelas `collections` e `collection_files`, e o servico `CollectionService` com CRUD completo de colecoes e gerenciamento de arquivos.

<skills>
### Conformidade com Skills Padroes

- **Express 4 + TypeScript 5**: Servico com tipagem forte, sem `any`
- **better-sqlite3**: Novas tabelas no SQLite existente, migrations SQL
- **Zod 3.22**: Validacao de parametros no servico
- **Pino 8**: Logs estruturados para operacoes de colecoes
- **Jest 29**: Testes unitarios do servico
</skills>

<requirements>
- Criar migration SQL com tabelas `collections` e `collection_files` conforme schema da techspec.md
- Implementar `CollectionService` com todos os metodos da interface definida na techspec.md
- Garantir constraint UNIQUE(name, scope, project_dir) para nomes de colecao
- Garantir CASCADE na exclusao de colecoes (remover `collection_files` associados)
- Implementar indices `idx_cf_collection` e `idx_cf_repo_path` para performance
</requirements>

## Subtarefas

- [ ] 1.1 Criar arquivo de migration SQL em `backend/src/db/migrations/` com as tabelas `collections` e `collection_files`, indices e constraints conforme techspec.md
- [ ] 1.2 Atualizar `backend/src/db/sqlite-client.ts` para executar a nova migration na inicializacao
- [ ] 1.3 Criar tipos/interfaces (`Collection`, `CollectionFile`, `CreateCollectionParams`, `CollectionFileInput`, `IndexingStatus`) em arquivo de tipos dedicado
- [ ] 1.4 Implementar `CollectionService` em `backend/src/services/collection-service.ts` com os metodos: `createCollection`, `renameCollection`, `deleteCollection`, `listCollections`, `addFiles`, `removeFile`, `getFiles`, `getIndexingStatus`
- [ ] 1.5 Adicionar logs Pino para operacoes de CRUD (info para criar/excluir, debug para operacoes de arquivo, error para falhas)
- [ ] 1.6 Escrever testes unitarios para o `CollectionService`

## Detalhes de Implementacao

Consultar a secao "Modelos de Dados" e "Schema SQL (nova migration)" da techspec.md para o schema completo das tabelas e interfaces TypeScript.

Pontos-chave:
- A tabela `collections` tem constraint `UNIQUE(name, scope, project_dir)` para evitar nomes duplicados no mesmo escopo
- A tabela `collection_files` tem `ON DELETE CASCADE` referenciando `collections(id)`
- O metodo `listCollections` deve retornar colecoes globais + locais do `projectDir` informado
- O metodo `deleteCollection` deve remover a colecao e, por CASCADE, os registros em `collection_files`
- O metodo `addFiles` deve inserir em `collection_files` sem duplicar (UNIQUE constraint em `collection_id, file_path`)

## Criterios de Sucesso

- Migration cria as tabelas corretamente ao inicializar o banco
- CRUD completo funcional: criar, renomear, excluir colecoes
- Gerenciamento de arquivos: adicionar, remover, listar arquivos de uma colecao
- Constraint de unicidade impede nomes duplicados no mesmo escopo/projeto
- Exclusao de colecao remove arquivos associados via CASCADE
- `npm run typecheck --workspace=backend` passa sem erros
- `npm test --workspace=backend` passa com todos os testes

## Testes da Tarefa

- [ ] Testes de unidade:
  - Criar colecao com nome valido retorna objeto Collection
  - Criar colecao com nome duplicado no mesmo escopo/projeto retorna erro
  - Renomear colecao atualiza o nome corretamente
  - Excluir colecao remove a colecao e seus arquivos associados
  - Adicionar arquivos a colecao insere registros em `collection_files`
  - Adicionar arquivo duplicado na mesma colecao retorna erro ou e ignorado
  - Remover arquivo de colecao deleta o registro
  - Listar colecoes retorna globais + locais do projeto informado
  - `getIndexingStatus` retorna status correto
- [ ] Testes de integracao:
  - Fluxo completo: criar colecao -> adicionar arquivos -> listar arquivos -> remover arquivo -> excluir colecao

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `backend/src/db/sqlite-client.ts` (modificado)
- `backend/src/db/migrations/` (novo arquivo de migration)
- `backend/src/services/collection-service.ts` (novo)
- Tipos/interfaces de colecoes (novo)
