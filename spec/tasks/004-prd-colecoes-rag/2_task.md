# Tarefa 2.0: Rotas REST de Colecoes

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Dependencias

- 1.0 (Migration SQL + CollectionService)

## Visao Geral

Criar os endpoints REST para colecoes, incluindo controller, rotas Express e validacao Zod. Expor toda a funcionalidade do `CollectionService` via API HTTP seguindo o padrao existente do projeto.

<skills>
### Conformidade com Skills Padroes

- **Express 4 + TypeScript 5**: Rotas REST com controllers separados
- **Zod 3.22**: Validacao de payloads nos endpoints
- **Pino 8**: Logs estruturados
- **Jest 29**: Testes unitarios e de integracao
</skills>

<requirements>
- Implementar todos os 8 endpoints listados na tabela de API da techspec.md
- Validar payloads com schemas Zod
- Retornar codigos HTTP corretos (200, 201, 204, 400, 404, 422)
- Seguir o padrao de controllers separados conforme `.claude/rules/http.md`
</requirements>

## Subtarefas

- [ ] 2.1 Criar schemas Zod para validacao dos payloads (createCollection, renameCollection, addFiles)
- [ ] 2.2 Criar `backend/src/api/controllers/collection.controller.ts` com handlers para todos os endpoints
- [ ] 2.3 Criar `backend/src/api/routes/collection-route.ts` com definicao das rotas e middleware de validacao
- [ ] 2.4 Registrar as rotas de colecoes no router principal da aplicacao
- [ ] 2.5 Escrever testes unitarios e de integracao para os endpoints

## Detalhes de Implementacao

Consultar a secao "Endpoints de API" da techspec.md para a tabela completa de endpoints:

| Metodo | Caminho | Descricao |
|--------|---------|-----------|
| GET /api/collections | Lista colecoes (query: projectDir) |
| POST /api/collections | Cria colecao |
| PUT /api/collections/:id | Renomeia colecao |
| DELETE /api/collections/:id | Exclui colecao |
| GET /api/collections/:id/files | Lista arquivos |
| POST /api/collections/:id/files | Adiciona arquivos |
| DELETE /api/collections/:id/files/:fileId | Remove arquivo |
| GET /api/collections/:id/status | Status de indexacao |

O controller deve delegar toda logica ao `CollectionService` e tratar erros adequadamente (ex: nome duplicado -> 422, colecao nao encontrada -> 404).

## Criterios de Sucesso

- Todos os 8 endpoints respondem corretamente
- Validacao Zod rejeita payloads invalidos com erro 400
- Nome duplicado retorna 422
- Colecao inexistente retorna 404
- `npm run typecheck --workspace=backend` passa sem erros
- `npm test --workspace=backend` passa com todos os testes

## Testes da Tarefa

- [ ] Testes de unidade:
  - Cada endpoint retorna status HTTP correto para cenarios de sucesso
  - Payload invalido retorna 400
  - Nome duplicado retorna 422
  - ID inexistente retorna 404
- [ ] Testes de integracao:
  - Fluxo completo via HTTP: criar colecao -> listar -> renomear -> adicionar arquivos -> listar arquivos -> remover arquivo -> excluir colecao

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `backend/src/api/controllers/collection.controller.ts` (novo)
- `backend/src/api/routes/collection-route.ts` (novo)
- `backend/src/api/routes/` (registro no router principal)
- `backend/src/services/collection-service.ts` (dependencia)
