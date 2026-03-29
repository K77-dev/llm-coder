# Tarefa 4.0: Frontend — Componente Toast

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Dependencias

- Nenhuma

## Visao Geral

Criar um componente Toast leve e reutilizavel para exibir notificacoes de sucesso e erro. Usar React portal para renderizar fora da arvore DOM do componente pai, com auto-dismiss apos timeout configuravel.

<skills>
### Conformidade com Skills Padroes

- Next.js 14 (App Router) + React 18 — Componente funcional com portal
- Tailwind 3.4 — Estilizacao
</skills>

<requirements>
- Toast deve renderizar via React portal no body
- Suporte a tipos `success` e `error` com cores distintas (verde/vermelho)
- Auto-dismiss apos 3 segundos (configuravel via prop `duration`)
- Animacao de entrada/saida (fade ou slide)
- Posicionado no canto inferior direito
- Hook `useToast` para disparar toasts de qualquer componente
- Multiplos toasts simultaneos (empilhados)
- Visual consistente com tema escuro/claro do app
</requirements>

## Subtarefas

- [ ] 4.1 Criar componente `Toast` em `frontend/components/Toast/index.tsx` com React portal, auto-dismiss e estilizacao Tailwind
- [ ] 4.2 Criar contexto `ToastContext` e provider `ToastProvider` para gerenciar lista de toasts ativos
- [ ] 4.3 Criar hook `useToast` em `frontend/lib/hooks/useToast.ts` que expoe `showToast({ message, type, duration? })`
- [ ] 4.4 Integrar `ToastProvider` no layout raiz (`frontend/app/layout.tsx`)
- [ ] 4.5 Escrever testes unitarios para o componente Toast e hook useToast

## Detalhes de Implementacao

Consultar techspec.md secao "Interfaces Principais" para `ToastProps`.

O componente deve usar `ReactDOM.createPortal` para renderizar no body, evitando problemas de z-index com modais. O `ToastProvider` gerencia um array de toasts ativos com `useState`, e cada toast remove a si mesmo apos o timeout via `setTimeout` + `useEffect`.

## Criterios de Sucesso

- Toast aparece no canto inferior direito ao chamar `showToast()`
- Toast desaparece automaticamente apos 3 segundos
- Toast de sucesso tem indicador verde, erro tem indicador vermelho
- Multiplos toasts empilham verticalmente
- Funciona em tema escuro e claro
- Typecheck passa com `npm run typecheck --workspace=frontend`

## Testes da Tarefa

- [ ] Teste unitario: Toast renderiza com mensagem correta
- [ ] Teste unitario: Toast de tipo `success` tem classe/estilo verde
- [ ] Teste unitario: Toast de tipo `error` tem classe/estilo vermelho
- [ ] Teste unitario: `useToast` adiciona e remove toasts corretamente

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `frontend/components/Toast/index.tsx` — novo componente Toast + ToastProvider
- `frontend/lib/hooks/useToast.ts` — novo hook useToast
- `frontend/app/layout.tsx` — integrar ToastProvider
- `frontend/components/ThemeProvider.tsx` — referencia para tema escuro/claro
