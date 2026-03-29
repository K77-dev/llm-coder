---
paths: ["**/__tests__/**", "**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts"]
---

# Testes

## Framework

Utilize Jest com ts-jest para testes. Nunca utilize Vitest.

```typescript
import { describe, it, expect } from '@jest/globals';

describe('UserService', () => {
  it('should create a new user', () => {
    const user = createUser({ name: 'John', email: 'john@example.com' });
    expect(user.name).toBe('John');
  });
});
```

## Execucao

```bash
# Rodar todos os testes do backend
npm test --workspace=backend

# Rodar teste especifico
npm test --workspace=backend -- --testPathPattern=user
```

## Independencia

Nao crie dependencia entre os testes. Deve ser possivel rodar cada um deles de forma independente.

## Estrutura AAA/GWT

Siga o principio **Arrange, Act, Assert** ou **Given, When, Then**.

```typescript
it('should calculate total price with discount', () => {
  // Arrange
  const items = [
    { price: 100, quantity: 2 },
    { price: 50, quantity: 1 },
  ];
  const discountPercentage = 10;
  // Act
  const total = calculateTotal(items, discountPercentage);
  // Assert
  expect(total).toBe(225);
});
```

## Mocks e Tempo

Se estiver testando comportamento que depende de Date, utilize jest.useFakeTimers().

```typescript
it('should set created date correctly', () => {
  const mockDate = new Date('2024-01-01T12:00:00Z');
  jest.useFakeTimers();
  jest.setSystemTime(mockDate);
  const user = createUser({ name: 'John' });
  expect(user.createdAt).toEqual(mockDate);
  jest.useRealTimers();
});
```

## Foco e Clareza

Foque em testar um comportamento por teste. Evite escrever testes muito grandes.

## Expectativas Consistentes

Garanta que tudo que estiver sendo testado esta de fato sendo conferido.

## Nomenclatura de Testes

Use descricoes claras e descritivas que expliquem o comportamento esperado.

```typescript
// ❌ Evite
it('test user', () => {});

// ✅ Prefira
it('should create user with valid email', () => {});
it('should throw error when email is invalid', () => {});
it('should return null when user not found', () => {});
```
