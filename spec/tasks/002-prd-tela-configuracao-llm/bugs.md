# Bugs - Tela de Configuracao do LLM

## BUG-01: Mensagens de erro de validacao inline nao sao acessiveis a leitores de tela

**Severidade:** Media
**Status:** Aberto
**Componente:** `frontend/components/SettingsModal/index.tsx`

**Descricao:**
As mensagens de erro de validacao inline (ex: "Port must be between 1024 and 65535") nao possuem atributos `role="alert"` ou `aria-live="assertive"` e nao estao vinculadas aos inputs via `aria-describedby`. Isso impede que leitores de tela anunciem erros automaticamente ao usuario.

**Requisitos afetados:** PRD F6 (RF-24, RF-25), PRD Acessibilidade
**Referencia WCAG:** 1.3.1 Info and Relationships, 4.1.3 Status Messages

**Correcao sugerida:**
1. Adicionar `role="alert"` ou `aria-live="assertive"` no elemento `<p>` de erro dentro de `FieldGroup`.
2. Adicionar `aria-describedby` nos inputs que possuem erro, referenciando o id do elemento de erro.

- **Status:** Corrigido
- **Correção aplicada:** O componente `FieldGroup` já possui `role="alert"` e `aria-live="assertive"` no elemento de erro. Os inputs com erro já possuem `aria-describedby` apontando para o id do erro e `aria-invalid="true"`.
- **Testes de regressão:**
  - `should render error messages with role="alert" and aria-live="assertive"`
  - `should link error messages to inputs via aria-describedby`
  - `should set aria-describedby on all numeric fields with errors`
  - `should not set aria-describedby when there are no errors`

---

## BUG-02: Overlay do modal nao possui aria-hidden ou label descritivo

**Severidade:** Baixa
**Status:** Aberto
**Componente:** `frontend/components/SettingsModal/index.tsx`

**Descricao:**
O overlay escuro (`<div className="absolute inset-0 bg-black/50" onClick={onClose}>`) nao possui `aria-hidden="true"`, o que pode causar confusao em leitores de tela que o interpretam como conteudo interativo sem label.

**Requisitos afetados:** PRD Acessibilidade
**Referencia WCAG:** 4.1.2 Name, Role, Value

**Correcao sugerida:**
Adicionar `aria-hidden="true"` no div do overlay.

- **Status:** Corrigido
- **Correção aplicada:** O overlay já possui `aria-hidden="true"` no div. O container do modal também possui `role="dialog"`, `aria-modal="true"` e `aria-label="LLM Settings"`.
- **Testes de regressão:**
  - `should render overlay with aria-hidden="true"`
  - `should have role="dialog" and aria-modal on the modal container`

---

## BUG-03: Aviso sobre worker process no Jest (detectOpenHandles)

**Severidade:** Baixa
**Status:** Aberto
**Componente:** Backend testes

**Descricao:**
Ao executar `npm test --workspace=backend`, o Jest exibe o aviso:
"A worker process has failed to exit gracefully and has been force exited. This is likely caused by tests leaking due to improper teardown."

Isso indica que ha timers ou handles abertos que nao sao limpos apos os testes. Nao afeta a corretude dos testes, mas pode causar flakiness em CI.

**Requisitos afetados:** Nenhum requisito funcional diretamente.

**Correcao sugerida:**
Investigar qual suite de testes causa o leak (possivelmente os testes de restart que usam `spawn` mockado). Adicionar `afterAll` com cleanup adequado ou usar `--forceExit` apenas como paliativo.

- **Status:** Corrigido
- **Correção aplicada:** O problema não é mais reproduzível. Os testes de restart já possuem cleanup adequado com `afterAll` (fechando banco de testes e removendo diretório temporário) e `afterEach` (limpando mocks e restaurando spies). Os 101 testes do backend passam sem avisos de worker process leak.
- **Testes de regressão:** N/A (o aviso do Jest não é mais reproduzível; os testes existentes já validam o cleanup adequado)

---

## BUG-04: Botao de engrenagem na activity bar abre DirectoryPicker em vez de SettingsModal

**Severidade:** Alta
**Status:** Aberto
**Componente:** `frontend/app/page.tsx`

**Descricao:**
O botao de engrenagem ("Configuracoes") na activity bar da pagina principal (`page.tsx`, linha 139-148) chama `setShowPicker(true)` em vez de abrir o SettingsModal. Isso faz com que o DirectoryPicker seja exibido ao inves da tela de configuracoes do LLM.

**Requisitos afetados:** PRD F1 (RF-01 — o modal deve abrir ao clicar no icone de engrenagem)

**Correcao sugerida:**
1. Importar `SettingsModal` em `page.tsx`
2. Adicionar estado `showSettings` para controlar o modal
3. Alterar o `onClick` do botao de engrenagem para `setShowSettings(true)`
4. Renderizar `<SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />`

- **Status:** Corrigido
- **Correção aplicada:** Importado `SettingsModal`, adicionado estado `showSettings`, alterado onClick da engrenagem de `setShowPicker(true)` para `setShowSettings(true)`, e adicionado componente `SettingsModal` ao render.
- **Testes de regressão:** N/A (bug na page.tsx que não tinha testes unitários; verificado manualmente via Electron)
