# Tarefa 4.0: Adaptacao ollama-client.ts

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Dependencias

- Nenhuma (independente — pode ser executada em paralelo com tasks 2.0 e 3.0)

## Visao Geral

Adaptar o `ollama-client.ts` existente para funcionar tanto com Ollama quanto com llama-server. O llama-server expoe uma API OpenAI-compatible (`/v1/chat/completions`), diferente da API nativa do Ollama (`/api/generate`). A adaptacao detecta automaticamente qual runtime esta respondendo e ajusta o formato de request/response.

<skills>
### Conformidade com Skills Padroes

- **Express 4 + TypeScript 5**: Client HTTP no backend
- **Jest 29 + ts-jest**: Testes unitarios da deteccao e formatacao
</skills>

<requirements>
- RF01 — O app deve funcionar com llama-server na porta configurada
- O chat existente deve continuar funcionando com Ollama (retrocompatibilidade)
</requirements>

## Subtarefas

- [ ] 4.1 Implementar deteccao automatica de API: tentar `GET /health` (llama-server) e `GET /api/tags` (Ollama) para identificar qual runtime esta rodando
- [ ] 4.2 Adaptar `generateResponse()` para formatar request conforme o runtime detectado:
  - Ollama: `POST /api/generate` (formato atual)
  - llama-server: `POST /v1/chat/completions` (formato OpenAI)
- [ ] 4.3 Adaptar `streamResponse()` para parsear SSE de ambos os formatos:
  - Ollama: `{"response": "token"}` por linha
  - llama-server: `data: {"choices": [{"delta": {"content": "token"}}]}` (SSE OpenAI)
- [ ] 4.4 Adaptar `isAvailable()` para funcionar com ambos os endpoints de health check
- [ ] 4.5 Manter `generateEmbedding()` exclusivo para Ollama (llama-server nao serve embeddings) — retornar erro claro se tentado com llama-server
- [ ] 4.6 Cachear o resultado da deteccao para evitar chamadas repetidas (invalidar no proximo `isAvailable()` se falhar)
- [ ] 4.7 Escrever testes unitarios para deteccao e formatacao

## Detalhes de Implementacao

Consultar a secao **Pontos de Integracao > ollama-client.ts** da `techspec.md` para detalhes sobre:
- Deteccao de API: `GET /health` vs `GET /api/tags`
- Formato de request/response para cada runtime
- Restricao de embeddings

## Criterios de Sucesso

- Chat funciona com llama-server via `/v1/chat/completions`
- Chat continua funcionando com Ollama via `/api/generate`
- Deteccao automatica sem configuracao manual do usuario
- `generateEmbedding()` retorna erro claro quando llama-server esta ativo
- Streaming funciona para ambos os runtimes
- Testes passam: `npm test --workspace=backend`
- Typecheck passa: `npm run typecheck --workspace=backend`

## Testes da Tarefa

- [ ] Teste unitario: deteccao identifica Ollama quando `/api/tags` responde 200
- [ ] Teste unitario: deteccao identifica llama-server quando `/health` responde 200
- [ ] Teste unitario: deteccao retorna `unavailable` quando nenhum responde
- [ ] Teste unitario: `generateResponse()` formata request correto para Ollama
- [ ] Teste unitario: `generateResponse()` formata request correto para llama-server (OpenAI format)
- [ ] Teste unitario: `streamResponse()` parseia SSE do Ollama corretamente
- [ ] Teste unitario: `streamResponse()` parseia SSE do llama-server (OpenAI format)
- [ ] Teste unitario: `generateEmbedding()` rejeita com erro quando runtime e llama-server
- [ ] Teste unitario: resultado da deteccao e cacheado

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `backend/src/llm/ollama-client.ts` — Modificar (adicionar deteccao e formatacao dual)
- `backend/src/api/controllers/chat.controller.ts` — Referencia (entender como o client e chamado)
- `backend/src/llm/claude-client.ts` — Referencia (entender padrao de client existente)
