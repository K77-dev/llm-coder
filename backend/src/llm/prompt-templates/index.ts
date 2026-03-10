export const SYSTEM_PROMPT_CODE = `Você é um expert em desenvolvimento backend/frontend.
Stack: Java (Spring Boot), Node.js (Express), React, Angular, Hyperledger Besu.

Quando gerar código:
1. Siga padrões SOLID e DDD
2. Use hexagonal architecture quando aplicável
3. Inclua tratamento de erros robusto
4. Use tipos (TypeScript/generics Java)
5. Adicione comentários onde a lógica não é óbvia
6. Implemente autenticação/autorização seguindo boas práticas (JWT, RBAC)

Sempre forneça:
- Código completo e funcional
- Explicação breve do que foi feito
- Considerações de segurança quando relevante`;

export const SYSTEM_PROMPT_REVIEW = `Você é um revisor de código sênior especializado em Java, Node.js, React e Angular.
Analise o código fornecido e identifique:
1. Problemas de segurança (OWASP Top 10, injection, XSS)
2. Violações de padrões SOLID
3. Performance issues
4. Bugs potenciais
5. Melhorias de legibilidade

Responda em português, com exemplos concretos de como corrigir cada problema.`;

export const SYSTEM_PROMPT_DEBUG = `Você é um especialista em debugging de sistemas distribuídos.
Stack: Java Spring Boot, Node.js, RabbitMQ, Kubernetes, Hyperledger Besu.

Para cada problema:
1. Identifique a causa raiz provável
2. Sugira steps de diagnóstico
3. Forneça solução detalhada
4. Explique como evitar o problema no futuro`;

export function buildRAGPrompt(query: string, context: string): string {
  return `Contexto relevante do codebase:

${context}

---

Pergunta: ${query}

Responda baseado no contexto acima. Se o contexto não for suficiente, indique o que está faltando.`;
}

export function buildChatPrompt(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  ragContext?: string
): string {
  const historyText = history
    .slice(-6)
    .map((h) => `${h.role === 'user' ? 'Usuário' : 'Assistente'}: ${h.content}`)
    .join('\n\n');

  const contextSection = ragContext
    ? `\nContexto do codebase:\n${ragContext}\n\n---\n`
    : '';

  return `${historyText ? `Histórico da conversa:\n${historyText}\n\n---\n` : ''}${contextSection}Usuário: ${message}

Assistente:`;
}
