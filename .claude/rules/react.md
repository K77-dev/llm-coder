---
paths:
  - "frontend/**/*.tsx"
  - "frontend/**/*.ts"
---

# React + Next.js

## App Router

O frontend usa Next.js 14 com App Router. Paginas ficam em `frontend/app/`, componentes em `frontend/components/`.

## Componentes Funcionais

Utilize componentes funcionais, nunca classes.

```typescript
// ✅ Prefira
function UserProfile({ name }: { name: string }) {
  return <div>{name}</div>;
}
```

## TypeScript

Utilize TypeScript e a extensao `.tsx` para os componentes.

```typescript
interface ChatMessageProps {
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export function ChatMessage({ content, role, timestamp }: ChatMessageProps) {
  return (
    <div className={`message message-${role}`}>
      <p>{content}</p>
      <time>{timestamp.toLocaleString()}</time>
    </div>
  );
}
```

## Estado Local

Mantenha o estado do componente o mais proximo possivel de onde ele sera usado.

## Estado Global com Zustand

Para estado global, utilize Zustand (ja configurado no projeto).

```typescript
import { create } from 'zustand';

interface ChatStore {
  messages: Message[];
  addMessage: (message: Message) => void;
  clearMessages: () => void;
}

const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clearMessages: () => set({ messages: [] }),
}));
```

## Passagem de Props

Passe propriedades de forma explicita entre componentes. Evite spread operator como `<ComponentName {...props} />`.

## Tamanho dos Componentes

Evite componentes muito grandes, acima de 300 linhas. Divida em componentes menores.

## Estilizacao

Utilize Tailwind CSS v3 para estilizacao dos componentes. Nao utilize styled-components ou CSS-in-JS.

```typescript
function Button({ children, variant = 'primary' }: ButtonProps) {
  const baseClasses = 'px-4 py-2 rounded font-medium transition-colors';
  const variantClasses = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
  };
  return (
    <button className={`${baseClasses} ${variantClasses[variant]}`}>
      {children}
    </button>
  );
}
```

## Granularidade de Componentes

Evite o excesso de componentes pequenos. Nao crie componentes para um unico `<span>`.

## Performance com useMemo

Utilize `useMemo` para evitar calculos desnecessarios entre renderizacoes.

## Nomenclatura de Hooks

Nomeie os hooks customizados com o prefixo "use": `useChat`, `useTheme`, `useFileExplorer`.

## Markdown

O projeto usa react-markdown + rehype-raw + shiki para renderizar respostas do LLM com syntax highlighting. Reutilize os componentes existentes em `frontend/components/CodeBlock/`.
