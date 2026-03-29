# Tarefa 5.0: ModelSelector UI + integracao Sidebar

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Dependencias

- 3.0 (Preload IPC bridge — necessario para `window.electronAPI.llama`)

## Visao Geral

Criar o componente `ModelSelector` para a sidebar do Electron que exibe os modelos `.gguf` disponiveis, o status do llama-server e permite trocar de modelo com um clique. Integrar na sidebar existente como secao "Modelos Locais".

<skills>
### Conformidade com Skills Padroes

- **Next.js 14 (App Router) + React 18**: Componente funcional TSX
- **Tailwind 3.4**: Estilizacao com tema claro/escuro
- **TypeScript 5**: Tipagem forte usando interfaces de `electron/types.ts`
</skills>

<requirements>
- RF03 — Exibir status (iniciando, rodando, erro, parado) na sidebar
- RF07 — Listar todos os arquivos .gguf do diretorio configurado
- RF09 — Botao de refresh para atualizar lista manualmente
- RF10 — Exibir nome do arquivo (sem extensao) e tamanho
- RF11 — Mensagem orientativa se diretorio vazio ou inexistente
- RF12 — Secao "Modelos Locais" na sidebar
- RF13 — Modelo ativo destacado visualmente
- RF14 — Clique em modelo diferente reinicia llama-server automaticamente
- RF15 — Indicador de loading durante troca de modelo
- RF16 — Ultimo modelo utilizado carregado automaticamente
</requirements>

## Subtarefas

- [ ] 5.1 Criar `frontend/components/Sidebar/ModelSelector.tsx` com:
  - Lista de modelos com nome (sem extensao) e tamanho formatado (ex: "3.2 GB")
  - Indicador visual do modelo ativo (dot verde + fundo destacado)
  - Status do servidor (dot colorido + texto: "Rodando", "Iniciando...", "Erro", "Parado")
  - Botao de refresh para recarregar lista de modelos
- [ ] 5.2 Implementar interacao: clique em modelo chama `window.electronAPI.llama.selectModel(fileName)`
- [ ] 5.3 Implementar subscription ao estado via `window.electronAPI.llama.onStateChange()` com cleanup no unmount
- [ ] 5.4 Adicionar indicador de loading (spinner/skeleton) durante troca de modelo (status `starting`)
- [ ] 5.5 Tratar estado vazio: se nenhum modelo detectado, exibir mensagem "Nenhum modelo encontrado. Adicione arquivos .gguf ao diretorio configurado em LLAMA_MODELS_DIR"
- [ ] 5.6 Tratar estado de erro: se llama-server nao encontrado, exibir mensagem orientando instalacao
- [ ] 5.7 Integrar `ModelSelector` na `Sidebar/index.tsx` como secao colapsavel "Modelos Locais"
- [ ] 5.8 Garantir suporte a tema claro/escuro (usar classes Tailwind existentes)
- [ ] 5.9 Adicionar acessibilidade: navegacao por teclado, `aria-live` no status, `role="listbox"` na lista
- [ ] 5.10 Adicionar type guard para `window.electronAPI` (componente deve funcionar gracefully fora do Electron, ex: no dev com Next.js puro)

## Detalhes de Implementacao

Consultar a secao **Interfaces Principais** (ElectronAPI) da `techspec.md` para os metodos disponiveis em `window.electronAPI.llama`.

Consultar a secao **Experiencia do Usuario** do `prd.md` para o fluxo principal e consideracoes de UI/UX.

O componente deve usar `useState` para estado local (lista de modelos, estado do servidor). Nao e necessario Zustand — o estado vem via IPC subscription.

## Criterios de Sucesso

- Lista de modelos exibida corretamente na sidebar
- Modelo ativo destacado visualmente
- Troca de modelo funciona com um clique + loading indicator
- Status do servidor atualizado em tempo real
- Mensagens de erro/vazio sao claras e uteis
- Tema claro/escuro funciona
- Acessibilidade: keyboard navigation + aria-live
- Componente nao quebra fora do Electron (type guard)
- Typecheck passa: `npm run typecheck --workspace=frontend`

## Testes da Tarefa

- [ ] Teste unitario: renderiza lista de modelos corretamente
- [ ] Teste unitario: destaca modelo ativo
- [ ] Teste unitario: exibe status do servidor (cada estado)
- [ ] Teste unitario: exibe mensagem quando nenhum modelo disponivel
- [ ] Teste unitario: exibe loading durante troca de modelo
- [ ] Teste unitario: botao refresh chama getModels()
- [ ] Teste unitario: funciona gracefully sem window.electronAPI (type guard)

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `frontend/components/Sidebar/ModelSelector.tsx` — Novo (componente principal)
- `frontend/components/Sidebar/index.tsx` — Modificar (adicionar secao ModelSelector)
- `electron/types.ts` — Referencia (tipos ElectronAPI, LlamaServerState, ModelInfo)
- `frontend/components/ThemeProvider.tsx` — Referencia (entender tema existente)
