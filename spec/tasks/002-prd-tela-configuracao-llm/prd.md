# PRD: Tela de Configuracao do LLM

## Visao Geral

O BBTS Code LLM atualmente exige que o usuario configure parametros do LLM server (diretorio de modelos, porta, path do executavel), modelo de embedding e cache diretamente no arquivo `.env`. Isso cria uma barreira de usabilidade — o usuario precisa saber onde esta o arquivo, qual formato usar e reiniciar o app manualmente apos cada alteracao.

Esta funcionalidade adiciona uma tela de configuracao acessivel via botao de engrenagem na activity bar, apresentada como modal/dialog sobre a tela principal. O usuario podera visualizar e alterar todas as configuracoes de LLM sem sair do app, com persistencia automatica no banco SQLite e feedback visual sobre reinicializacao do servidor.

## Objetivos

- **Eliminar dependencia do .env para configuracoes de LLM**: 100% das configuracoes de LLM server, embedding e cache devem ser gerenciaveis pela UI.
- **Reduzir fricao de configuracao**: o usuario deve conseguir configurar o app em menos de 1 minuto, sem editar arquivos.
- **Manter estabilidade do servidor**: alteracoes que impactam o llama-server devem avisar o usuario e pedir confirmacao antes de reiniciar.
- **Persistencia entre sessoes**: todas as configuracoes salvas devem sobreviver ao fechamento e reabertura do app.

## Historias de Usuario

- Como **usuario iniciante**, eu quero configurar o diretorio de modelos e a porta do servidor pela interface grafica para que eu nao precise editar arquivos de configuracao manualmente.
- Como **usuario avancado**, eu quero ajustar parametros de cache e performance (memoria maxima, TTL, tamanho do LRU) para que eu possa otimizar o comportamento do app para minha maquina.
- Como **usuario que troca de modelo frequentemente**, eu quero alterar o path do executavel do llama-server pela interface para que eu possa testar diferentes builds sem reiniciar o app.
- Como **usuario que utiliza RAG**, eu quero selecionar o modelo de embedding pela interface para que eu possa trocar entre modelos sem editar o .env.

## Funcionalidades Principais

### F1. Modal de Configuracoes

O modal sera aberto ao clicar no botao de engrenagem (ja existente no activity bar). Apresenta as configuracoes organizadas em secoes com scroll vertical.

**Requisitos funcionais:**

1. O modal deve abrir ao clicar no icone de engrenagem no activity bar.
2. O modal deve fechar ao clicar no botao de fechar (X), no botao "Cancelar" ou ao pressionar a tecla ESC.
3. O modal deve ter overlay escuro semitransparente sobre o conteudo principal.
4. O modal deve ser responsivo e centralizado na tela.
5. Ao fechar sem salvar, alteracoes pendentes devem ser descartadas (sem confirmacao extra).

### F2. Secao LLM Server

Configuracoes do llama-server local.

**Requisitos funcionais:**

6. Campo para diretorio de modelos (LLAMA_MODELS_DIR) com input de texto e botao de selecao de diretorio (file picker nativo via Electron).
7. Campo para porta do servidor (LLAMA_SERVER_PORT) com input numerico e validacao de range (1024-65535).
8. Campo para path do executavel (LLAMA_SERVER_PATH) com input de texto e botao de selecao de arquivo (file picker nativo via Electron).
9. Quando executando no browser (sem Electron), os botoes de file picker devem ser ocultados e o usuario digita o path manualmente.

### F3. Secao Modelo de Embedding

Configuracao do modelo usado para embeddings/RAG.

**Requisitos funcionais:**

10. Campo para nome do modelo de embedding (EMBEDDING_MODEL) com input de texto.
11. Exibir o valor padrao como placeholder ("nomic-embed-text").

### F4. Secao Cache e Performance

Parametros de cache e uso de memoria.

**Requisitos funcionais:**

12. Campo para memoria maxima em MB (MAX_MEMORY_MB) com input numerico.
13. Campo para TTL do cache em segundos (CACHE_TTL) com input numerico.
14. Campo para tamanho do cache LRU (LRU_CACHE_SIZE) com input numerico.
15. Exibir valores padrao como placeholders.

### F5. Persistencia e Aplicacao

Salvar e aplicar configuracoes.

**Requisitos funcionais:**

16. Botao "Salvar" persiste todas as configuracoes no banco SQLite (tabela `llama_settings`).
17. Botao "Cancelar" descarta alteracoes e fecha o modal.
18. Ao salvar, se a porta, diretorio de modelos ou path do executavel mudaram, exibir aviso informando que o llama-server precisa ser reiniciado e pedir confirmacao do usuario.
19. Se o usuario confirmar o reinicio, o llama-server deve ser parado e reiniciado com as novas configuracoes.
20. Se o usuario negar o reinicio, as configuracoes sao salvas mas aplicadas somente na proxima inicializacao do servidor.
21. Configuracoes de cache e embedding devem ser aplicadas imediatamente sem reinicio do servidor.
22. Na inicializacao do app, configuracoes salvas no SQLite devem ter precedencia sobre valores do .env.
23. Se nao houver valor salvo no SQLite, usar o valor do .env como fallback; se nenhum existir, usar o valor padrao.

### F6. Validacao e Feedback

**Requisitos funcionais:**

24. Porta fora do range 1024-65535 deve exibir mensagem de erro inline.
25. Campos numericos (memoria, TTL, LRU) devem aceitar apenas numeros positivos.
26. Apos salvar com sucesso, exibir toast/notificacao de confirmacao.
27. Se houver erro ao salvar, exibir mensagem de erro com detalhes.

## Experiencia do Usuario

### Fluxo Principal

1. Usuario clica no icone de engrenagem no activity bar (sidebar esquerda).
2. Modal abre com overlay escuro, exibindo as configuracoes atuais nos campos.
3. Usuario altera os campos desejados.
4. Usuario clica em "Salvar".
5. Se configuracoes do llama-server mudaram, aparece dialogo de confirmacao de reinicio.
6. Configuracoes sao persistidas e aplicadas. Toast confirma o sucesso.
7. Modal fecha automaticamente apos salvar.

### Consideracoes de UI/UX

- Visual consistente com o tema atual do app (escuro/claro, Tailwind).
- Secoes claramente separadas com titulos e descricoes curtas.
- Campos com labels claros e placeholders mostrando valores padrao.
- Botoes de acao (Salvar/Cancelar) fixos no rodape do modal.
- Toast de feedback posicionado no canto inferior direito.

### Acessibilidade

- Modal deve ter focus trap (Tab navega apenas dentro do modal).
- Campos devem ter labels associados via `htmlFor`/`id`.
- Botao de fechar deve ser acessivel via teclado.
- Contraste de cores deve atender WCAG 2.1 AA.
- Suporte a navegacao por teclado (Tab, Shift+Tab, Enter, ESC).

## Restricoes Tecnicas de Alto Nivel

- Persistencia via SQLite usando a infraestrutura existente (`getLlamaSetting`/`setLlamaSetting`).
- Comunicacao com Electron via IPC (preload/contextBridge) para file pickers e restart do servidor.
- Fallback HTTP para quando o app roda no browser sem Electron.
- Valores do `.env` servem apenas como fallback inicial; apos o primeiro save, o SQLite prevalece.
- O llama-server so deve ser reiniciado com confirmacao explicita do usuario.

## Fora de Escopo

- **Configuracao da Claude API** (key, modelo): sera abordada em funcionalidade futura.
- **Configuracao de paths do banco de dados** (DB_PATH, DB_CACHE_PATH): requer logica complexa de migracao.
- **Interface de gerenciamento de modelos** (download, delete de .gguf): o model selector na sidebar ja cobre selecao.
- **Configuracao de temas/aparencia**: fora do escopo desta funcionalidade.
- **Export/import de configuracoes**: pode ser considerado futuramente.
- **Atalho de teclado (Ctrl+,)**: pode ser adicionado em iteracao futura.
