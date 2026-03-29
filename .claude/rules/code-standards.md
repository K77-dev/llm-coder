# Padroes de Codificacao

## Idioma

Todo o codigo-fonte deve ser escrito em ingles, incluindo nomes de variaveis, funcoes, classes, comentarios e documentacao.

**Exemplo:**
```typescript
// ❌ Evite
const nomeDoProduto = "Laptop";
function calcularPreco() {}

// ✅ Prefira
const productName = "Laptop";
function calculatePrice() {}
```

## Convencoes de Nomenclatura

### camelCase
Utilize para metodos, funcoes e variaveis.

```typescript
const userName = "John";
const isActive = true;
function getUserById(id: string) {}
```

### PascalCase
Utilize para classes e interfaces.

```typescript
class UserRepository {}
interface PaymentGateway {}
```

### kebab-case
Utilize para arquivos e diretorios.

```
user-repository.ts
payment-gateway.service.ts
api-controllers/
```

## Nomenclatura Clara

Evite abreviacoes, mas tambem nao escreva nomes muito longos (com mais de 30 caracteres).

```typescript
// ❌ Evite
const usrNm = "John";
const userNameFromDatabaseQueryResult = "John";

// ✅ Prefira
const userName = "John";
const dbUserName = "John";
```

## Constantes e Magic Numbers

Declare constantes para representar magic numbers com legibilidade.

```typescript
// ❌ Evite
if (user.age >= 18) {}
setTimeout(() => {}, 3600000);

// ✅ Prefira
const MINIMUM_AGE = 18;
const ONE_HOUR_IN_MS = 60 * 60 * 1000;

if (user.age >= MINIMUM_AGE) {}
setTimeout(() => {}, ONE_HOUR_IN_MS);
```

## Metodos e Funcoes

Os metodos e funcoes devem executar uma acao clara e bem definida, e isso deve ser refletido no seu nome, que deve comecar por um verbo, nunca um substantivo.

```typescript
// ❌ Evite
function user(id: string) {}
function userData() {}

// ✅ Prefira
function getUser(id: string) {}
function fetchUserData() {}
function createUser(data: UserData) {}
```

## Parametros

Sempre que possivel, evite passar mais de 3 parametros. De preferencia para o uso de objetos caso necessario.

```typescript
// ❌ Evite
function createUser(name: string, email: string, age: number, address: string, phone: string) {}

// ✅ Prefira
interface CreateUserParams {
  name: string;
  email: string;
  age: number;
  address: string;
  phone: string;
}

function createUser(params: CreateUserParams) {}
```

## Efeitos Colaterais

Evite efeitos colaterais. Em geral, um metodo ou funcao deve fazer uma mutacao OU consulta, nunca permita que uma consulta tenha efeitos colaterais.

## Estruturas Condicionais

Nunca faca o aninhamento de mais de dois if/else. Sempre de preferencia por early returns.

```typescript
// ✅ Prefira
function processPayment(user: User, amount: number) {
  if (!user) return null;
  if (!user.isActive) return null;
  if (amount <= 0) return null;
  if (user.balance < amount) return null;
  return completePayment(user, amount);
}
```

## Flag Parameters

Nunca utilize flag params para chavear o comportamento de metodos e funcoes. Extraia para metodos e funcoes com comportamentos especificos.

## Tamanho de Metodos e Classes

- Evite metodos longos, com mais de 50 linhas
- Evite classes longas, com mais de 300 linhas

## Formatacao

Evite linhas em branco dentro de metodos e funcoes.

## Comentarios

Evite o uso de comentarios sempre que possivel. O codigo deve ser autoexplicativo.

## Declaracao de Variaveis

Nunca declare mais de uma variavel na mesma linha. Declare as variaveis o mais proximo possivel de onde serao utilizadas.
