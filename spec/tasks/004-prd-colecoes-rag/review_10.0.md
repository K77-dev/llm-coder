# Relatorio de Code Review - Testes E2E (Task 10.0)

## Resumo
- Data: 2026-03-29
- Branch: 004-prd-colecoes-rag
- Status: APROVADO COM RESSALVAS
- Arquivos Modificados: 2 (package.json, frontend/app/page.tsx)
- Arquivos Novos: 3 (playwright.config.ts, e2e/helpers/api-mocks.ts, e2e/collections.spec.ts)
- Linhas Adicionadas: ~890 (novos) + 19 (modificados)
- Linhas Removidas: 2

## Conformidade com Rules

| Rule | Status | Observacoes |
|------|--------|-------------|
| Codigo em ingles | OK | Todos os nomes, comentarios e strings em ingles |
| camelCase para variaveis/funcoes | OK | Consistente em todo o codigo |
| PascalCase para interfaces | OK | MockCollection, MockCollectionFile |
| kebab-case para arquivos | OK | api-mocks.ts, collections.spec.ts |
| Nomenclatura clara | OK | Nomes descritivos sem abreviacoes |
| Constantes para magic numbers | OK | Nenhum magic number sem constante |
| TypeScript forte (sem any) | OK | Tipagem adequada em todo o codigo |
| npm como gerenciador | OK | Playwright instalado via npm |
| Testes independentes | OK | Cada teste configura seus proprios mocks |

## Aderencia a TechSpec

| Decisao Tecnica | Implementado | Observacoes |
|-----------------|--------------|-------------|
| Playwright para testes E2E | SIM | Configuracao correta com webServer para backend e frontend |
| Criar colecao via sidebar | SIM | 5 testes cobrindo criacao local, global, validacao, cancel e Escape |
| Selecionar checkboxes e verificar persistencia | SIM | Testes de toggle, select all, deselect all e persistencia apos reload |
| Chat com collectionIds | SIM | 4 testes verificando envio de collectionIds no request |
| Renomear e excluir colecao | SIM | 3 testes de rename + 2 testes de delete com confirmacao |
| Acessibilidade (teclado + focus trap) | SIM | 3 testes de teclado + 2 testes de focus trap no dialogo |
| Migration (repos como colecoes) | SIM | 1 teste verificando repos migrados como colecoes globais |

## Tasks Verificadas

| Task | Status | Observacoes |
|------|--------|-------------|
| 10.1 Configurar Playwright | COMPLETA | playwright.config.ts com webServer, timeout, reporter |
| 10.2 Criar colecao via sidebar | COMPLETA | 5 testes (local, global, validacao, cancel, Escape) |
| 10.3 Adicionar arquivos e verificar indexacao | INCOMPLETA | Nenhum teste E2E cobre adicao de arquivos a uma colecao ou verificacao de indexacao |
| 10.4 Selecionar colecoes e persistencia apos reload | COMPLETA | 4 testes incluindo persistencia via localStorage |
| 10.5 Chat com colecoes selecionadas | COMPLETA | 4 testes verificando collectionIds e resposta |
| 10.6 Renomear e excluir colecao | COMPLETA | 3 testes rename + 2 testes delete |
| 10.7 Acessibilidade (teclado + focus trap) | COMPLETA | 5 testes cobrindo Tab, Space, focus trap e Escape |
| 10.8 Selecionar todas | COMPLETA | 2 testes (toggle all + indeterminate state) |

## Testes

- Total de Testes E2E: 30
- Listados com sucesso: 30
- Backend Tests: 222 passando, 0 falhando
- Backend Typecheck: OK
- Frontend Typecheck: OK
- Nota: Testes E2E nao foram executados (requerem servidores ativos), apenas listados

## Problemas Encontrados

| Severidade | Arquivo | Linha | Descricao | Sugestao |
|------------|---------|-------|-----------|----------|
| Media | e2e/collections.spec.ts | - | Subtask 10.3 nao implementada: nao ha teste E2E para adicionar arquivos a uma colecao e verificar indexacao. A task exige explicitamente "Adicionar arquivos e verificar indexacao" | Adicionar teste que abre CollectionDetail, clica em "Add files", seleciona arquivos via DirectoryPicker, e verifica que os arquivos aparecem na lista com status "Indexed" |
| Baixa | e2e/collections.spec.ts | 158, 173, 185 | Testes de rename fazem double-click/right-click no checkbox (`checkbox-1`, `checkbox-2`) em vez do collection item (`collection-item-1`). Funciona por event bubbling, mas nao reflete a interacao real do usuario | Alterar para `page.getByTestId('collection-item-1').click({ button: 'right' })` e `page.getByTestId('collection-item-1').dblclick()` |
| Baixa | e2e/collections.spec.ts | 238-243 | Teste de navegacao por Tab (linha 238-243) tem asseracao fraca: `expect(focusedElement).toBeTruthy()` nao valida que o foco foi para o proximo elemento esperado. Qualquer elemento focado passaria este teste | Verificar que o foco foi para um elemento especifico (ex: `collection-name-1` ou `checkbox-2`) |
| Baixa | playwright.config.ts | 22-34 | A configuracao inicia servidores backend e frontend reais. Em CI, isso pode causar flakiness por depender de banco SQLite, Ollama, etc. | Considerar adicionar variavel de ambiente para modo de teste que desabilite dependencias externas, ou documentar que os testes E2E dependem de mocks via page.route() e nao precisam de backend real funcionando |

## Pontos Positivos

- Mock layer (api-mocks.ts) bem estruturado e completo, cobrindo todos os endpoints necessarios incluindo health, models, llama/status e index/status
- Boa cobertura de cenarios de acessibilidade: navegacao por teclado, Space para toggle, focus trap no dialogo de exclusao
- Teste de persistencia de selecao apos reload e bem implementado, reconfigurando mocks antes do reload
- Teste de estado indeterminate do checkbox "Select all" demonstra atencao a detalhes de UX
- Teste do fluxo completo (create -> select -> chat) valida a integracao end-to-end dos componentes
- Mock do chat endpoint suporta tanto streaming (SSE) quanto JSON, preparado para ambos os modos
- Boa separacao entre helpers de mock e testes, facilitando manutencao

## Recomendacoes

1. **Implementar teste E2E para adicao de arquivos (subtask 10.3)**: Este e o unico fluxo principal ausente. Deve testar a abertura do CollectionDetail, clique em "Add files", interacao com o DirectoryPicker e verificacao dos arquivos adicionados na lista
2. **Corrigir alvos de interacao nos testes de rename**: Usar `collection-item-*` ao inves de `checkbox-*` para double-click e right-click, refletindo melhor a interacao real do usuario
3. **Fortalecer asseracao de navegacao por Tab**: Substituir `toBeTruthy()` por verificacao do elemento especifico que deveria receber foco
4. **Considerar adicionar testes de erro**: Ex: falha na API ao criar colecao (mock retornando 500), timeout de request, etc.

## Conclusao

A implementacao cobre 7 das 8 subtasks da task 10.0, com 30 testes E2E bem estruturados. O mock layer e robusto e os testes cobrem cenarios importantes incluindo acessibilidade, persistencia e fluxo completo. A principal lacuna e a ausencia de teste para adicao de arquivos a uma colecao (subtask 10.3), que e um dos fluxos principais da feature. Os demais problemas sao de baixa severidade e nao bloqueiam a aprovacao. Recomenda-se implementar o teste da subtask 10.3 para completar a cobertura antes de considerar a task totalmente finalizada.
