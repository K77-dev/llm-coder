# Tarefa 7.0: Componente CollectionList + Sidebar

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Dependencias

- 6.0 (Store Zustand + API Client Frontend)

## Visao Geral

Criar o componente `CollectionList` que exibe as colecoes com checkboxes de selecao, botao "Selecionar todas", acoes de criar/renomear/excluir, e integra-lo na Sidebar existente. Este componente e a interface principal de interacao do usuario com colecoes.

<skills>
### Conformidade com Skills Padroes

- **Next.js 14 (App Router) + React 18**: Componentes funcionais
- **Zustand 4.5**: Consumir `useCollectionStore`
- **Tailwind 3.4**: Estilizacao com classes utilitarias
- **TypeScript 5**: Tipagem forte
</skills>

<requirements>
- Exibir lista de colecoes com checkbox de selecao ao lado de cada uma (PRD requisitos 16-17)
- Botao/checkbox "Selecionar todas" que ativa/desativa todas as colecoes (PRD requisito 18)
- Botao "+" para criar nova colecao (abre modal com nome e escopo)
- Duplo clique ou menu de contexto para renomear colecao
- Menu de contexto para excluir colecao com dialogo de confirmacao
- Distinguir visualmente colecoes locais de globais (badge/icone) (PRD requisito 25)
- Exibir contagem de arquivos por colecao
- Exibir status de indexacao por colecao
- Acessibilidade: checkboxes navegaveis por teclado, labels descritivos, focus trap no dialogo de exclusao
</requirements>

## Subtarefas

- [ ] 7.1 Criar componente `CollectionList` em `frontend/components/CollectionList/index.tsx`
- [ ] 7.2 Implementar item de colecao com: checkbox, nome, contagem de arquivos, badge local/global, indicador de status de indexacao
- [ ] 7.3 Implementar checkbox "Selecionar todas" no header da secao
- [ ] 7.4 Implementar modal de criacao de colecao (campo nome + selecao de escopo local/global)
- [ ] 7.5 Implementar renomeacao inline (duplo clique) ou via menu de contexto
- [ ] 7.6 Implementar exclusao via menu de contexto com dialogo de confirmacao (focus trap)
- [ ] 7.7 Integrar componente `CollectionList` na Sidebar existente
- [ ] 7.8 Garantir acessibilidade (navegacao por teclado, labels descritivos, texto alternativo para status)
- [ ] 7.9 Escrever testes

## Detalhes de Implementacao

Consultar a secao "Sidebar — Secao Colecoes" do prd.md para o layout esperado:

```
Colecoes                    [+] [Selecionar todas]
  [x] Backend API           (12 arquivos) [local]
  [ ] Documentacao IA       (8 arquivos)  [global]
  [x] Regras CNAB           (3 arquivos)  [local]
```

Consultar a secao "Acessibilidade" do prd.md para requisitos de acessibilidade.

Consultar a techspec.md para o componente `CollectionList` e integracao com `useCollectionStore`.

## Criterios de Sucesso

- Lista de colecoes renderiza corretamente na Sidebar
- Checkboxes funcionam para selecao individual e "Selecionar todas"
- Modal de criacao funciona com nome e escopo
- Renomeacao e exclusao funcionam corretamente
- Badge distingue colecoes locais de globais
- Status de indexacao e exibido visualmente
- Navegacao por teclado funciona (Tab + Space em checkboxes)
- `npm run typecheck --workspace=frontend` passa sem erros

## Testes da Tarefa

- [ ] Testes de unidade:
  - Renderiza lista de colecoes com checkboxes
  - Toggle de checkbox atualiza selecao no store
  - "Selecionar todas" marca/desmarca todas
  - Modal de criacao envia dados corretos
  - Exclusao exibe dialogo de confirmacao
  - Badge local/global renderiza corretamente

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `frontend/components/CollectionList/index.tsx` (novo)
- `frontend/components/Sidebar/` (modificado — incluir secao de colecoes)
- `frontend/stores/collection-store.ts` (dependencia)
