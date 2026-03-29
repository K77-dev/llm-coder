# Tarefa 6.0: Integracao Sidebar + Testes E2E

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Dependencias

- 5.0 (SettingsModal)
- 2.0 (Restart endpoint)

## Visao Geral

Conectar o botao de engrenagem existente na sidebar ao SettingsModal e implementar testes E2E com Playwright cobrindo o fluxo completo de configuracao: abrir modal, editar campos, salvar, verificar persistencia e validacao.

<skills>
### Conformidade com Skills Padroes

- Next.js 14 (App Router) + React 18 — Integracao de componentes
- Tailwind 3.4 — Ajustes de estilo se necessario
</skills>

<requirements>
- Botao de engrenagem na activity bar deve abrir o SettingsModal
- Fluxo E2E completo: abrir → editar → salvar → verificar persistencia
- Testar validacao inline (porta invalida)
- Testar cancelamento (alteracoes descartadas)
- Testar acessibilidade basica (focus trap, ESC)
</requirements>

## Subtarefas

- [ ] 6.1 Modificar `frontend/components/Sidebar/index.tsx` para importar `SettingsModal` e controlar abertura/fechamento via estado local
- [ ] 6.2 Conectar o click handler do botao de engrenagem existente para abrir o SettingsModal
- [ ] 6.3 Escrever teste E2E: abrir modal via gear icon, verificar que campos estao preenchidos com valores atuais
- [ ] 6.4 Escrever teste E2E: alterar campo de embedding, salvar, reabrir modal e verificar valor persistido
- [ ] 6.5 Escrever teste E2E: tentar salvar porta invalida (ex: 999), verificar erro inline
- [ ] 6.6 Escrever teste E2E: alterar campo, clicar Cancelar, reabrir e verificar valor original mantido
- [ ] 6.7 Escrever teste E2E: verificar que modal fecha ao pressionar ESC

## Detalhes de Implementacao

Consultar techspec.md secoes:
- "Fluxo de dados" — sequencia completa
- "Abordagem de Testes" — cenarios E2E

O botao de engrenagem ja existe na sidebar (ver `frontend/components/Sidebar/index.tsx`). A integracao consiste em adicionar estado `isSettingsOpen` e renderizar `<SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />`.

Para os testes E2E, usar Playwright seguindo o padrao do projeto. Os testes devem rodar contra o app completo (backend + frontend).

## Criterios de Sucesso

- Clicar no gear icon abre o SettingsModal
- Todos os testes E2E passam
- Fluxo completo funciona: abrir → editar → salvar → reabrir → verificar
- Validacao inline bloqueia salvamento com dados invalidos
- Cancelamento descarta alteracoes corretamente
- Typecheck passa com `npm run typecheck --workspace=frontend`

## Testes da Tarefa

- [ ] Teste E2E: abrir modal via gear icon
- [ ] Teste E2E: campos preenchidos com valores atuais
- [ ] Teste E2E: salvar alteracao e verificar persistencia
- [ ] Teste E2E: validacao inline para porta invalida
- [ ] Teste E2E: cancelamento descarta alteracoes
- [ ] Teste E2E: ESC fecha o modal

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `frontend/components/Sidebar/index.tsx` — conectar gear icon ao modal
- `frontend/components/SettingsModal/index.tsx` — componente do modal (task 5.0)
- `backend/src/api/controllers/llama.controller.ts` — endpoints de settings (task 1.0)
- `backend/src/api/routes/llama.ts` — rotas (task 1.0)
