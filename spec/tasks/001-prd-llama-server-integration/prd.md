# PRD: Integracaoo llama-server com Electron

## Visao Geral

O BBTS Code LLM atualmente depende do Ollama como runtime para LLMs locais. Esta funcionalidade integra o **llama-server** (llama.cpp) diretamente ao ciclo de vida do Electron, permitindo que o app inicie, gerencie e troque modelos GGUF sem depender de servicos externos. O usuario configura um diretorio de modelos no `.env`, e o app detecta automaticamente todos os arquivos `.gguf` disponiveis, exibindo-os em um seletor na sidebar para ativacao com um clique.

**Problema**: Hoje o usuario precisa iniciar e gerenciar o Ollama manualmente fora do app, alem de lidar com conversao de modelos para o formato Ollama. Com llama-server nativo, o usuario carrega qualquer modelo GGUF diretamente, sem etapas intermediarias.

**Valor**: Experiencia simplificada de uso de LLMs locais — abrir o app e ja ter um modelo rodando, com troca rapida entre modelos via sidebar.

## Objetivos

- Eliminar a necessidade de iniciar manualmente um servidor LLM externo antes de usar o app
- Permitir que o usuario troque de modelo GGUF em menos de 3 cliques (selecionar na sidebar)
- Manter compatibilidade com o fluxo existente do Ollama como alternativa
- Detectar automaticamente todos os modelos `.gguf` disponiveis no diretorio configurado

## Historias de Usuario

- Como **desenvolvedor usando o app**, eu quero que o llama-server inicie automaticamente ao abrir o Electron para que eu nao precise gerenciar processos manualmente
- Como **desenvolvedor com multiplos modelos**, eu quero ver todos os meus modelos GGUF listados na sidebar para escolher qual ativar rapidamente
- Como **desenvolvedor trocando de contexto**, eu quero trocar de modelo com um clique na sidebar para que o llama-server reinicie automaticamente com o novo modelo
- Como **desenvolvedor configurando o app**, eu quero definir o diretorio de modelos e porta no `.env` para manter a configuracao simples e versionavel

## Funcionalidades Principais

### F1. Gerenciamento do Processo llama-server

O Electron inicia o llama-server como processo filho ao subir o app, e o encerra ao fechar.

- **O que faz**: Spawna o processo `llama-server` com o modelo selecionado e porta configurada
- **Por que e importante**: Elimina a etapa manual de iniciar um servidor LLM separado
- **Como funciona**: O main process do Electron usa `child_process.spawn` para iniciar o llama-server, monitora o processo e o mata no evento `before-quit`

**Requisitos funcionais:**
1. RF01 — O app deve iniciar o llama-server automaticamente ao subir o Electron
2. RF02 — O app deve encerrar o processo llama-server ao fechar o Electron (incluindo `SIGTERM` e `SIGKILL` como fallback)
3. RF03 — O app deve monitorar o processo e exibir status (iniciando, rodando, erro, parado) na sidebar
4. RF04 — O app deve logar stdout/stderr do llama-server no sistema de logs do app
5. RF05 — Se o llama-server nao for encontrado no PATH, o app deve exibir mensagem clara orientando a instalacao
6. RF06 — O caminho do executavel llama-server deve ser configuravel via `.env` (variavel `LLAMA_SERVER_PATH`), com fallback para o PATH do sistema

### F2. Deteccao Automatica de Modelos

O app escaneia o diretorio configurado e lista todos os arquivos `.gguf` disponiveis.

- **O que faz**: Le o diretorio de modelos e apresenta a lista na sidebar
- **Por que e importante**: Evita configuracao manual de cada modelo; basta colocar o arquivo `.gguf` no diretorio
- **Como funciona**: Na inicializacao e sob demanda, o app le o diretorio e filtra arquivos `.gguf`

**Requisitos funcionais:**
7. RF07 — O app deve ler o diretorio configurado em `LLAMA_MODELS_DIR` no `.env` e listar todos os arquivos `.gguf`
8. RF08 — A lista de modelos deve ser atualizada automaticamente ao abrir o app
9. RF09 — O usuario deve poder atualizar a lista manualmente (botao de refresh na sidebar)
10. RF10 — Cada modelo deve exibir o nome do arquivo (sem extensao) e o tamanho do arquivo
11. RF11 — Se o diretorio nao existir ou estiver vazio, exibir mensagem orientativa na sidebar

### F3. Seletor de Modelos na Sidebar

Interface na sidebar do Electron para visualizar e ativar modelos.

- **O que faz**: Exibe a lista de modelos disponiveis e permite ativar um com um clique
- **Por que e importante**: Proporciona troca rapida de modelo sem sair do fluxo de trabalho
- **Como funciona**: Secao dedicada na sidebar com lista de modelos, indicador de modelo ativo e status do servidor

**Requisitos funcionais:**
12. RF12 — A sidebar deve conter uma secao "Modelos Locais" com a lista de modelos detectados
13. RF13 — O modelo atualmente ativo deve ser destacado visualmente (indicador de status)
14. RF14 — Ao clicar em um modelo diferente, o app deve automaticamente parar o llama-server atual e reinicia-lo com o novo modelo
15. RF15 — Durante a troca de modelo, exibir indicador de loading/progresso na sidebar
16. RF16 — O ultimo modelo utilizado deve ser persistido e carregado automaticamente na proxima abertura do app

### F4. Configuracao via .env

Variaveis de ambiente para configurar o comportamento do llama-server.

- **O que faz**: Centraliza a configuracao em variaveis de ambiente
- **Por que e importante**: Permite configuracao simples sem alterar codigo

**Requisitos funcionais:**
17. RF17 — Variavel `LLAMA_MODELS_DIR` — caminho do diretorio contendo os modelos `.gguf`
18. RF18 — Variavel `LLAMA_SERVER_PORT` — porta do llama-server (default: `8080`)
19. RF19 — Variavel `LLAMA_SERVER_PATH` — caminho do executavel (default: `llama-server` no PATH)
20. RF20 — As variaveis devem ser documentadas no `.env.example`

## Experiencia do Usuario

### Persona Principal
Desenvolvedor que usa o BBTS Code LLM diariamente e possui modelos GGUF baixados localmente.

### Fluxo Principal
1. Usuario abre o app Electron
2. O app detecta os modelos no diretorio configurado e inicia o llama-server com o ultimo modelo usado (ou o primeiro da lista)
3. A sidebar exibe a secao "Modelos Locais" com a lista de modelos e o status do servidor
4. Usuario clica em outro modelo na lista
5. O app reinicia o llama-server com o novo modelo (indicador de loading durante a troca)
6. O modelo ativo e atualizado na sidebar e o chat passa a usar o novo modelo

### Consideracoes de UI/UX
- A secao de modelos deve respeitar o tema claro/escuro existente
- Status do servidor deve ser visivel sem ocupar muito espaco (icone + texto curto)
- A troca de modelo nao deve limpar o historico de chat existente
- Indicador de loading durante restart do servidor para feedback visual

### Acessibilidade
- Todos os elementos interativos devem ser acessiveis via teclado
- Status do servidor deve ter `aria-live` para leitores de tela
- Contraste adequado nos indicadores de status (ativo/inativo/erro)

## Restricoes Tecnicas de Alto Nivel

- O llama-server deve ser um processo filho do Electron (nao um servico separado)
- A comunicacao com o llama-server usa a API HTTP compativel com OpenAI (endpoint `/v1/chat/completions`)
- O app deve funcionar em macOS (plataforma principal do projeto)
- O scan de diretorio deve lidar com permissoes de arquivo e paths com espacos
- O processo llama-server deve ser encerrado de forma limpa ao fechar o app (evitar processos orfaos)

## Fora de Escopo

- Download ou instalacao automatica do llama-server — o usuario deve te-lo instalado
- Download de modelos GGUF — o usuario deve baixa-los manualmente
- Parametros avancados do llama-server (ctx-size, threads, gpu-layers) — apenas modelo e porta
- Execucao de multiplos llama-server simultaneamente — apenas um modelo ativo por vez
- Suporte a Windows/Linux nesta versao — foco em macOS
- Substituicao do Ollama — ambos coexistem como opcoes de runtime
