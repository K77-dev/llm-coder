---
paths:
  - "backend/src/**/*.ts"
---

# Logging

## Framework

Utilize Pino para logging no backend. Nunca use `console.log` ou `console.error` diretamente — use a instancia do logger em `backend/src/utils/logger.ts`.

```typescript
import logger from '../utils/logger';

logger.info({ userId }, 'User authenticated');
logger.error({ error: error.message, orderId }, 'Payment processing failed');
logger.debug({ query, duration }, 'Database query executed');
```

## Niveis de Log

- **debug** — informacoes de desenvolvimento e troubleshooting
- **info** — eventos normais do sistema (startup, requests, etc.)
- **warn** — situacoes inesperadas mas nao criticas
- **error** — erros que precisam atencao

## Armazenamento

Nunca armazene logs em arquivos via codigo. Os logs vao para stdout/stderr via Pino e sao redirecionados pelo ambiente.

## Dados Sensiveis

Nunca registre dados sensiveis como senhas, tokens, chaves API ou dados pessoais.

```typescript
// ❌ Evite
logger.info({ apiKey, password }, 'User login');

// ✅ Prefira
logger.info({ userId }, 'User login successful');
```

## Mensagens Claras

Seja claro e conciso nas mensagens de log.

## Contexto nos Logs

Sempre inclua contexto relevante como primeiro argumento (objeto) do Pino.

```typescript
// ❌ Evite
logger.info('Operation completed');

// ✅ Prefira
logger.info({ repoId, filesIndexed: 150, duration: '3.2s' }, 'Repository indexing completed');
```

## Tratamento de Excecoes

Nunca silencie exceptions. Sempre registre com o logger antes de re-throw ou retornar erro.

```typescript
try {
  await indexRepository(repoId);
} catch (error) {
  logger.error({ repoId, error: error instanceof Error ? error.message : 'Unknown error' }, 'Repository indexing failed');
  throw error;
}
```
