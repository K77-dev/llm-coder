# Node.js/TypeScript

## TypeScript

Todo o codigo-fonte deve ser escrito em TypeScript.

## Gerenciador de Pacotes

Utilize npm como ferramenta padrao para gerenciar dependencias e executar scripts. Nunca utilize bun, yarn ou pnpm.

```bash
# Instalar dependencias
npm install

# Adicionar nova dependencia a um workspace
npm install axios --workspace=backend
npm install zustand --workspace=frontend

# Adicionar dependencia de desenvolvimento
npm install -D @types/node --workspace=backend

# Executar scripts
npm run dev
npm test --workspace=backend
npm run typecheck --workspace=backend
```

## Types de Bibliotecas

Se necessario, faca a instalacao dos types das bibliotecas.

```bash
npm install -D @types/express @types/cors @types/jsonwebtoken --workspace=backend
npm install -D @types/react @types/react-dom --workspace=frontend
```

## Validacao de Tipagem

Antes de terminar uma tarefa, sempre valide se a tipagem esta correta.

```bash
npm run typecheck --workspace=backend
npm run typecheck --workspace=frontend
```

## Declaracao de Variaveis

Utilize `const` ao inves de `let` onde for possivel. Nunca utilize `var` para declarar uma variavel.

## Propriedades de Classe

Sempre declare as propriedades da classe como `private` ou `readonly`, evitando o uso de `public`.

## Metodos de Array

Prefira o uso de `find`, `filter`, `map` e `reduce` ao inves de `for` e `while`.

## Promises e Async/Await

Sempre utilize `async/await` para lidar com promises. Evite o uso de callbacks.

## Tipagem Forte

Nunca utilize `any`. Sempre utilize types existentes ou crie types para tudo que for implementado. Para casos desconhecidos, use `unknown`.

## Imports e Exports

Nunca utilize `require` para importar modulos, sempre utilize `import`. Nunca utilize `module.exports`, sempre `export`.

## Default vs Named Exports

Se o arquivo tiver apenas uma coisa sendo exportada, utilize `default`, senao named exports.

## Dependencia Circular

Evite dependencia circular entre modulos.

## Tipos Utilitarios

Utilize os tipos utilitarios do TypeScript quando apropriado: `Partial`, `Pick`, `Omit`, `Readonly`, `Record`.
