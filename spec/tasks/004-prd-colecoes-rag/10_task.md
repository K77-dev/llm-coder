# Tarefa 10.0: Testes E2E

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Dependencias

- 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0 (todas as tarefas anteriores)

## Visao Geral

Implementar testes end-to-end com Playwright cobrindo os fluxos principais da feature de Colecoes de RAG. Os testes devem validar o fluxo completo desde a criacao de colecoes na UI ate a verificacao de que as respostas do chat sao filtradas pelas colecoes selecionadas.

<skills>
### Conformidade com Skills Padroes

- **Playwright**: Testes E2E
- **TypeScript 5**: Tipagem forte
</skills>

<requirements>
- Testar fluxo completo: criar colecao -> adicionar arquivos -> selecionar -> enviar chat -> verificar filtro
- Testar acessibilidade: navegacao por teclado, focus trap em dialogos
- Testar persistencia: selecao de colecoes sobrevive reload da pagina
- Testar migracao: verificar que repos existentes aparecem como colecoes
</requirements>

## Subtarefas

- [ ] 10.1 Configurar Playwright no projeto (se nao configurado)
- [ ] 10.2 Implementar teste E2E: criar colecao via sidebar (nome + escopo)
- [ ] 10.3 Implementar teste E2E: adicionar arquivos a uma colecao e verificar indexacao
- [ ] 10.4 Implementar teste E2E: selecionar colecoes via checkbox e verificar persistencia apos reload
- [ ] 10.5 Implementar teste E2E: enviar mensagem no chat com colecoes selecionadas e verificar que sources retornadas pertencem a colecao
- [ ] 10.6 Implementar teste E2E: renomear e excluir colecao (com confirmacao)
- [ ] 10.7 Implementar teste E2E: acessibilidade — navegacao por teclado nos checkboxes e focus trap no dialogo de exclusao
- [ ] 10.8 Implementar teste E2E: "Selecionar todas" marca/desmarca todas as colecoes

## Detalhes de Implementacao

Consultar a secao "Testes de E2E" da techspec.md:
- Usando Playwright: criar colecao via sidebar, adicionar arquivos, selecionar checkboxes, enviar mensagem e verificar que sources retornadas pertencem a colecao selecionada

Consultar a secao "Fluxos Principais" e "Acessibilidade" do prd.md para os cenarios a testar.

## Criterios de Sucesso

- Todos os testes E2E passam com sucesso
- Fluxo completo (criar -> adicionar -> selecionar -> chat -> verificar filtro) funciona end-to-end
- Acessibilidade validada (teclado, focus trap)
- Persistencia de selecao validada

## Testes da Tarefa

- [ ] Testes E2E:
  - Criar colecao local e global
  - Adicionar arquivos e verificar indexacao
  - Selecionar/deselecionar colecoes via checkbox
  - "Selecionar todas" funciona
  - Chat com colecoes retorna sources filtradas
  - Renomear colecao
  - Excluir colecao com confirmacao
  - Navegacao por teclado nos checkboxes
  - Focus trap no dialogo de exclusao
  - Selecao persiste apos reload

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- Pasta de testes E2E (a definir, ex: `e2e/` ou `tests/e2e/`)
- Todos os componentes frontend (dependencias)
- Todos os endpoints backend (dependencias)
