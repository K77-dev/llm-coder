---
paths:
  - "backend/src/**/*.ts"
---

# REST/HTTP

## Framework

Utilize Express para mapear os endpoints. Nunca utilize Hono, Fastify ou Koa.

**Exemplo:**
```typescript
import { Router } from 'express';

const router = Router();

router.get('/users', async (req, res) => {
  const users = await getUsers();
  res.json(users);
});

router.get('/users/:userId', async (req, res) => {
  const user = await getUser(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

export default router;
```

## Padrao REST

Utilize o padrao REST para consultas, mantendo o nome dos recursos em ingles e no plural, permitindo a navegabilidade em recursos alinhados.

```typescript
// ✅ Prefira
GET /users
GET /users/:userId
GET /repositories/:repoId/files
GET /chats/:chatId/messages

// ❌ Evite
GET /getUsers
GET /user/:userId (singular)
GET /usuario/:usuarioId (portugues)
```

## Nomenclatura de Recursos

Recursos e verbos compostos devem usar kebab-case.

## Profundidade de Recursos

Evite criar endpoints com mais de 3 recursos.

## Mutacoes e Acoes

Para mutacoes, utilize uma combinacao de REST para navegar nos recursos e verbos para representar acoes que estao sendo executadas, sempre com POST.

```typescript
POST /users/:userId/change-password
POST /chats/:chatId/send-message
POST /repositories/:repoId/reindex
```

## Formato de Dados

O formato do payload de requisicao e resposta deve ser sempre JSON.

## Codigos de Status HTTP

- **200** - OK: requisicao bem-sucedida
- **404** - Not Found: recurso nao encontrado
- **500** - Internal Server Error: erro inesperado
- **422** - Unprocessable Entity: erro de negocio
- **400** - Bad Request: requisicao mal formatada
- **401** - Unauthorized: usuario nao autenticado
- **403** - Forbidden: usuario nao autorizado

## Validacao com Zod

Utilize Zod para validar payloads de entrada.

```typescript
import { z } from 'zod';

const createChatSchema = z.object({
  message: z.string().min(1),
  model: z.enum(['auto', 'local', 'claude']).optional(),
  context: z.string().optional(),
});

router.post('/chats', async (req, res) => {
  const result = createChatSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid request', details: result.error.issues });
  }
  const chat = await createChat(result.data);
  res.json(chat);
});
```

## Middlewares

Utilize middlewares do Express para funcionalidades transversais.

```typescript
import { Request, Response, NextFunction } from 'express';

function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  req.user = user;
  next();
}

router.post('/chats', authenticate, async (req, res) => {
  // ...
});
```

## Cliente HTTP

O projeto usa axios para chamadas HTTP externas. Mantenha consistencia.

```typescript
import axios from 'axios';

async function fetchRepoData(repoUrl: string) {
  const response = await axios.get(repoUrl);
  return response.data;
}
```
