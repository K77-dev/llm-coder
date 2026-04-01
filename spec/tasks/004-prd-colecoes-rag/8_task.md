# Tarefa 8.0: Componente CollectionDetail + DirectoryPicker

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Dependencias

- 6.0 (Store Zustand + API Client Frontend)
- 7.0 (Componente CollectionList + Sidebar)

## Visao Geral

Criar o componente `CollectionDetail` para visualizacao e gerenciamento dos arquivos de uma colecao, e adaptar o `DirectoryPicker` existente para suportar selecao de arquivos individuais (modo `files`).

<skills>
### Conformidade com Skills Padroes

- **Next.js 14 (App Router) + React 18**: Componentes funcionais
- **Zustand 4.5**: Consumir `useCollectionStore`
- **Tailwind 3.4**: Estilizacao com classes utilitarias
- **TypeScript 5**: Tipagem forte
</skills>

<requirements>
- Exibir lista de arquivos da colecao selecionada
- Permitir adicionar arquivos individuais a uma colecao (PRD requisito 6)
- Permitir adicionar pasta inteira (recursivamente) a uma colecao (PRD requisito 7)
- Permitir remover arquivos individuais da colecao (PRD requisito 8)
- Indicar visualmente arquivos ja adicionados (PRD requisito 9)
- Adaptar DirectoryPicker para aceitar prop `mode: 'directory' | 'files'`
</requirements>

## Subtarefas

- [ ] 8.1 Adaptar `DirectoryPicker` para aceitar prop `mode: 'directory' | 'files'` — no modo `files`, permitir selecao de arquivos individuais alem de pastas
- [ ] 8.2 Criar componente `CollectionDetail` em `frontend/components/CollectionDetail/index.tsx`
- [ ] 8.3 Implementar listagem de arquivos da colecao com indicador de status de indexacao por arquivo
- [ ] 8.4 Implementar botao "Adicionar" que abre o DirectoryPicker em modo `files`
- [ ] 8.5 Implementar remocao individual de arquivo da colecao
- [ ] 8.6 Indicar visualmente arquivos ja presentes na colecao no seletor
- [ ] 8.7 Implementar navegacao: clicar em uma colecao na CollectionList abre o CollectionDetail
- [ ] 8.8 Escrever testes

## Detalhes de Implementacao

Consultar a secao "DirectoryPicker — Selecao de Arquivos" da techspec.md para a adaptacao do componente existente.

Consultar a secao "Fluxos Principais" do prd.md:
- **Adicionar arquivos**: Clicar na colecao > Botao "Adicionar" > Seletor de arquivo/pasta > Indexacao automatica

O componente `CollectionDetail` deve se comunicar com a API via funcoes do `frontend/lib/api.ts` para adicionar/remover arquivos e com o `useCollectionStore` para status de indexacao.

## Criterios de Sucesso

- DirectoryPicker funciona em modo `files` (selecao de arquivos individuais)
- CollectionDetail exibe arquivos da colecao com status de indexacao
- Adicionar arquivos/pastas funciona e dispara indexacao automatica
- Remover arquivo funciona corretamente
- Arquivos ja presentes sao indicados visualmente no seletor
- `npm run typecheck --workspace=frontend` passa sem erros

## Testes da Tarefa

- [ ] Testes de unidade:
  - DirectoryPicker renderiza corretamente em modo `files`
  - CollectionDetail exibe lista de arquivos
  - Botao adicionar abre seletor
  - Remocao de arquivo chama API corretamente
  - Arquivos ja adicionados aparecem com indicador visual

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `frontend/components/CollectionDetail/index.tsx` (novo)
- `frontend/components/DirectoryPicker/` (modificado — modo files)
- `frontend/stores/collection-store.ts` (dependencia)
- `frontend/lib/api.ts` (dependencia)
