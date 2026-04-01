# PRD — Colecoes de RAG

## Visao Geral

Atualmente, o sistema de RAG do BBTS Code LLM indexa repositorios inteiros como uma unica unidade. Isso funciona bem para projetos pequenos, mas em cenarios reais o usuario frequentemente lida com multiplos repositorios ou subconjuntos de codigo que pertencem a contextos distintos (ex: backend API, documentacao, modulos CNAB).

A mistura de contextos prejudica a qualidade das respostas da LLM, pois trechos irrelevantes competem com trechos relevantes no ranking de similaridade vetorial.

**Colecoes** resolvem esse problema permitindo que o usuario organize arquivos em grupos logicos, cada um com seu proprio indice vetorial. O usuario seleciona quais colecoes compoem o contexto de uma query, garantindo respostas mais precisas e relevantes.

## Objetivos

- **Organizacao**: Permitir que o usuario agrupe arquivos em colecoes tematicas, eliminando a mistura de contextos no RAG
- **Controle de contexto**: Permitir selecao granular de quais colecoes influenciam as respostas da LLM
- **Evolucao do RAG atual**: Manter compatibilidade com o fluxo existente — repositorios indexados via "Indexar projeto" se tornam colecoes automaticamente
- **Metricas de sucesso**:
  - Usuario consegue criar, editar e excluir colecoes sem fricao
  - Queries com colecoes selecionadas retornam resultados mais relevantes que o RAG sem filtro
  - Tempo de indexacao por colecao nao excede o tempo atual de indexacao de repositorio equivalente

## Historias de Usuario

### Primarias

- **Como** desenvolvedor, **eu quero** criar colecoes tematicas de arquivos **para que** eu possa organizar meu contexto de RAG por dominio (ex: "Backend API", "Regras CNAB", "Documentacao")
- **Como** desenvolvedor, **eu quero** selecionar quais colecoes estao ativas via checkbox **para que** a LLM use apenas o contexto relevante para minha pergunta atual
- **Como** desenvolvedor, **eu quero** adicionar arquivos individuais ou pastas inteiras a uma colecao **para que** eu tenha flexibilidade na organizacao

### Secundarias

- **Como** desenvolvedor, **eu quero** que repositorios indexados pelo fluxo atual se tornem colecoes automaticamente **para que** eu nao perca o trabalho ja feito
- **Como** desenvolvedor, **eu quero** colecoes locais (por projeto) e globais (reutilizaveis) **para que** eu possa compartilhar colecoes entre projetos diferentes
- **Como** desenvolvedor, **eu quero** um botao "Selecionar todas" **para que** eu possa rapidamente ativar todas as colecoes quando necessario

## Funcionalidades Principais

### F1 — CRUD de Colecoes

Gerenciamento basico de colecoes.

- **O que faz**: Permite criar, renomear e excluir colecoes
- **Por que e importante**: E a base para toda a organizacao de contexto
- **Como funciona**: Interface na sidebar com opcoes de criar (botao +), renomear (duplo clique ou menu de contexto) e excluir (menu de contexto com confirmacao)

**Requisitos funcionais:**

1. O usuario deve poder criar uma nova colecao informando apenas o nome
2. O nome da colecao deve ser unico dentro do escopo (local ou global)
3. O usuario deve poder renomear uma colecao existente
4. O usuario deve poder excluir uma colecao, com dialogo de confirmacao
5. Ao excluir uma colecao, todos os chunks e vetores associados devem ser removidos do banco

### F2 — Gerenciamento de Arquivos na Colecao

Adicao e remocao de arquivos dentro de uma colecao.

- **O que faz**: Permite adicionar arquivos individuais ou pastas inteiras a uma colecao, e remover arquivos
- **Por que e importante**: E o mecanismo pelo qual o usuario define o conteudo de cada colecao
- **Como funciona**: Seletor de arquivos/pastas (reutilizando o DirectoryPicker existente) dentro do contexto de uma colecao

**Requisitos funcionais:**

6. O usuario deve poder adicionar arquivos individuais a uma colecao
7. O usuario deve poder adicionar uma pasta inteira (todos os arquivos indexaveis recursivamente) a uma colecao
8. O usuario deve poder remover arquivos individuais de uma colecao
9. Arquivos ja adicionados devem ser indicados visualmente para evitar duplicatas
10. Um mesmo arquivo pode pertencer a multiplas colecoes

### F3 — Indexacao Automatica

Indexacao vetorial automatica ao modificar o conteudo de uma colecao.

- **O que faz**: Gera embeddings automaticamente quando arquivos sao adicionados ou removidos
- **Por que e importante**: Elimina a necessidade de o usuario disparar indexacao manualmente, reduzindo fricao
- **Como funciona**: Ao adicionar arquivos, o sistema inicia chunking e geracao de embeddings em background. Ao remover, os chunks/vetores correspondentes sao deletados

**Requisitos funcionais:**

11. Ao adicionar arquivos a uma colecao, a indexacao deve iniciar automaticamente em background
12. O status de indexacao deve ser exibido por colecao (pendente, indexando, concluido, erro)
13. Ao remover um arquivo, seus chunks e vetores devem ser removidos imediatamente
14. A indexacao nao deve bloquear a interface do usuario
15. Se a indexacao falhar, o erro deve ser exibido e o usuario pode retentar

### F4 — Selecao de Colecoes para Query

Controle de quais colecoes compoem o contexto da LLM.

- **O que faz**: Permite selecionar/deselecionar colecoes via checkboxes e um botao "Selecionar todas"
- **Por que e importante**: E o mecanismo principal de controle de contexto — o diferencial da feature
- **Como funciona**: Checkboxes na sidebar ao lado de cada colecao. A busca vetorial no chat filtra apenas pelas colecoes selecionadas

**Requisitos funcionais:**

16. Cada colecao deve ter um checkbox de selecao na sidebar
17. O usuario deve poder selecionar multiplas colecoes simultaneamente
18. Deve existir um botao/checkbox "Selecionar todas" que ativa/desativa todas as colecoes
19. A query de chat deve buscar apenas nos indices das colecoes selecionadas
20. Se nenhuma colecao estiver selecionada, a busca RAG nao deve retornar resultados (query sem contexto)
21. A selecao de colecoes deve persistir entre sessoes

### F5 — Escopo Local e Global

Colecoes podem ser vinculadas a um projeto ou reutilizadas globalmente.

- **O que faz**: Diferencia colecoes locais (vinculadas ao diretorio do projeto) de colecoes globais (disponiveis em qualquer projeto)
- **Por que e importante**: Permite reutilizar colecoes de referencia (ex: documentacao de framework) entre projetos
- **Como funciona**: Ao criar uma colecao, o usuario escolhe o escopo. Colecoes locais aparecem apenas quando o projeto correspondente esta aberto. Colecoes globais aparecem sempre

**Requisitos funcionais:**

22. Ao criar uma colecao, o usuario deve poder escolher entre escopo "Local" (projeto atual) ou "Global"
23. Colecoes locais devem aparecer apenas quando o projeto correspondente esta aberto
24. Colecoes globais devem aparecer independentemente do projeto aberto
25. A interface deve distinguir visualmente colecoes locais de globais (ex: icone ou badge)

### F6 — Migracao do RAG Atual

Compatibilidade com repositorios ja indexados.

- **O que faz**: Converte repositorios indexados pelo sistema atual em colecoes automaticamente
- **Por que e importante**: Garante que o usuario nao perca trabalho ja feito e que a transicao seja suave
- **Como funciona**: Na primeira execucao apos a atualizacao, cada repositorio existente na tabela `code_chunks` se torna uma colecao local com o nome do repositorio

**Requisitos funcionais:**

26. Na primeira execucao apos deploy, repositorios existentes devem ser migrados para colecoes automaticamente
27. A migracao deve preservar todos os chunks e vetores existentes (sem reindexacao)
28. O usuario deve ser notificado sobre a migracao realizada

## Experiencia do Usuario

### Sidebar — Secao Colecoes

A secao "Colecoes" deve ser adicionada a sidebar existente, abaixo da secao de indexacao ou substituindo-a. Layout esperado:

```
Colecoes                    [+] [Selecionar todas]
  [x] Backend API           (12 arquivos) [local]
  [ ] Documentacao IA       (8 arquivos)  [global]
  [x] Regras CNAB           (3 arquivos)  [local]
```

### Fluxos Principais

1. **Criar colecao**: Botao "+" > Modal com nome e escopo > Confirmar > Colecao aparece na lista
2. **Adicionar arquivos**: Clicar na colecao > Botao "Adicionar" > Seletor de arquivo/pasta > Indexacao automatica
3. **Selecionar para query**: Marcar checkbox > Enviar mensagem no chat > Resposta usa apenas colecoes marcadas
4. **Excluir colecao**: Menu de contexto > "Excluir" > Confirmacao > Colecao e indices removidos

### Acessibilidade

- Checkboxes devem ser navegaveis por teclado (Tab + Space)
- Labels descritivos para leitores de tela (ex: "Selecionar colecao Backend API para contexto RAG")
- Indicadores de status de indexacao devem ter texto alternativo alem de cor
- Dialogo de confirmacao de exclusao deve capturar foco (focus trap)

## Restricoes Tecnicas de Alto Nivel

- **Banco de dados**: Deve utilizar o SQLite existente (`better-sqlite3`) — nao introduzir novo banco
- **Embeddings**: Deve reutilizar o pipeline de embeddings existente (chunker + gerador de embeddings)
- **API**: Deve expor endpoints REST consistentes com o padrao Express existente
- **Performance**: Indexacao em background nao deve degradar a responsividade do chat
- **Armazenamento**: Vetores continuam como BLOBs no SQLite; o volume de dados cresce linearmente com o numero de colecoes
- **Compatibilidade**: Deve manter o endpoint `POST /api/chat` funcional, adicionando filtro por colecoes

## Fora de Escopo

- **Compartilhamento de colecoes** entre usuarios ou maquinas
- **Permissoes e controle de acesso** por colecao
- **Busca full-text** dentro de colecoes (apenas busca vetorial)
- **Versionamento** de colecoes ou historico de alteracoes
- **Sincronizacao automatica** de arquivos (se o arquivo mudar no disco, o usuario deve reindexar manualmente)
- **Interface drag-and-drop** para mover arquivos entre colecoes (pode ser adicionada futuramente)
- **Limites rigidos** de colecoes ou arquivos por colecao (o limite natural e o disco/memoria)
