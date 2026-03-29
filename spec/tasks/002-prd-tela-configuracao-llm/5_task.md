# Tarefa 5.0: Frontend — SettingsModal

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Dependencias

- 1.0 (Endpoints de Settings)
- 3.0 (Electron IPC para dialogs)
- 4.0 (Componente Toast)

## Visao Geral

Criar o modal de configuracoes do LLM com formulario organizado em 3 secoes (LLM Server, Embedding, Cache). O modal carrega valores atuais via API, permite edicao com validacao inline, salva via PUT e exibe feedback via Toast. File pickers usam IPC do Electron (ocultos no browser). Ao salvar configs criticas, exibe dialog de confirmacao de restart.

<skills>
### Conformidade com Skills Padroes

- Next.js 14 (App Router) + React 18 — Componente funcional com estado local
- Tailwind 3.4 — Estilizacao do modal e formulario
- Zod 3.22 — Validacao no frontend (opcional, pode ser inline)
</skills>

<requirements>
- Modal abre sobre overlay escuro semitransparente
- Modal fecha ao clicar X, "Cancelar" ou ESC
- Ao abrir, carrega configuracoes via GET /api/llama/settings
- 3 secoes: LLM Server (3 campos), Embedding (1 campo), Cache e Performance (3 campos)
- Campos de diretorio/arquivo com botao file picker (via IPC Electron), oculto no browser
- Validacao inline: porta 1024-65535, numericos > 0
- Botoes Salvar/Cancelar fixos no rodape
- Ao salvar, chama PUT /api/llama/settings
- Se `restartRequired: true`, exibe dialog de confirmacao (IPC ou window.confirm)
- Se usuario confirma restart, chama POST /api/llama/restart (ou IPC llama:restart)
- Toast de sucesso apos salvar, toast de erro se falhar
- Modal fecha automaticamente apos salvar com sucesso
- Focus trap (Tab navega apenas dentro do modal)
- Labels associados via htmlFor/id
- Suporte a navegacao por teclado (Tab, Shift+Tab, Enter, ESC)
</requirements>

## Subtarefas

- [ ] 5.1 Criar componente `SettingsModal` em `frontend/components/SettingsModal/index.tsx` com overlay, header, body com scroll e footer com botoes
- [ ] 5.2 Implementar carregamento de dados via `GET /api/llama/settings` ao abrir o modal (usar axios do `frontend/lib/api.ts`)
- [ ] 5.3 Implementar secao "LLM Server" com campos `llamaModelsDir` (texto + file picker), `llamaServerPort` (numerico), `llamaServerPath` (texto + file picker)
- [ ] 5.4 Implementar secao "Modelo de Embedding" com campo `embeddingModel` (texto com placeholder "nomic-embed-text")
- [ ] 5.5 Implementar secao "Cache e Performance" com campos `maxMemoryMb`, `cacheTtl`, `lruCacheSize` (numericos com placeholders dos defaults)
- [ ] 5.6 Implementar validacao inline nos campos (porta range, numericos positivos) com mensagens de erro
- [ ] 5.7 Implementar logica de salvar: PUT /api/llama/settings → checar restartRequired → dialog de confirmacao → POST restart se confirmado → toast de feedback
- [ ] 5.8 Implementar deteccao de ambiente Electron (`window.electronAPI`) para mostrar/ocultar botoes de file picker e usar dialog nativo vs window.confirm
- [ ] 5.9 Implementar focus trap e acessibilidade (htmlFor/id, ESC para fechar, aria-modal)
- [ ] 5.10 Escrever testes unitarios para o SettingsModal (renderizacao, validacao, estados)

## Detalhes de Implementacao

Consultar techspec.md secoes:
- "Fluxo de dados" — sequencia completa de abertura a salvamento
- "Interfaces Principais" — `LlamaSettings`, `ElectronAPI`
- "Endpoints de API" — contratos GET e PUT
- "Pontos de Integracao" — IPC e fallback browser

Para detectar Electron, usar o padrao existente do `ModelSelector.tsx`: `typeof window !== 'undefined' && window.electronAPI`.

Estado gerenciado com `useState` local — sem Zustand.

## Criterios de Sucesso

- Modal abre com dados carregados da API
- Validacao inline impede salvamento com dados invalidos
- Salvar persiste configs e exibe toast de sucesso
- Dialog de restart aparece apenas quando configs criticas mudam
- File pickers funcionam no Electron e sao ocultos no browser
- Modal e acessivel via teclado (focus trap, ESC, Tab)
- Typecheck passa com `npm run typecheck --workspace=frontend`

## Testes da Tarefa

- [ ] Teste unitario: Modal renderiza com 3 secoes e 7 campos
- [ ] Teste unitario: Modal fecha ao clicar Cancelar
- [ ] Teste unitario: Modal fecha ao pressionar ESC
- [ ] Teste unitario: Validacao inline exibe erro para porta fora de range
- [ ] Teste unitario: Validacao inline exibe erro para numero negativo
- [ ] Teste unitario: Botoes de file picker sao ocultos quando `window.electronAPI` nao existe
- [ ] Teste unitario: Botao Salvar chama PUT /api/llama/settings com dados do formulario

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `frontend/components/SettingsModal/index.tsx` — novo componente
- `frontend/lib/api.ts` — cliente axios existente
- `frontend/components/Sidebar/ModelSelector.tsx` — referencia para deteccao Electron
- `frontend/types/electron.d.ts` — tipos do IPC
- `frontend/components/Toast/index.tsx` — componente Toast (task 4.0)
- `frontend/lib/hooks/useToast.ts` — hook useToast (task 4.0)
