# API Reference

Base URL: `http://localhost:3001/api`

---

## GET /health

Status do sistema.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-10T12:00:00.000Z",
  "ollama": {
    "available": true,
    "models": ["qwen2.5-coder:7b", "nomic-embed-text"]
  },
  "database": {
    "indexed_chunks": 102
  },
  "indexing": {
    "running": false
  }
}
```

---

## POST /chat

Enviar mensagem ao assistente.

**Request:**
```json
{
  "message": "Como implementar autenticação JWT?",
  "model": "auto",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "filter": {
    "repo": "meu-projeto",
    "language": "typescript"
  },
  "stream": false
}
```

| Campo | Tipo | Obrigatório | Default | Descrição |
|-------|------|-------------|---------|-----------|
| `message` | string | ✅ | — | Mensagem do usuário (max 10000 chars) |
| `model` | `auto\|local\|claude` | ❌ | `auto` | Modelo a usar |
| `history` | array | ❌ | `[]` | Histórico de conversa |
| `filter.repo` | string | ❌ | — | Filtrar RAG por repositório |
| `filter.language` | string | ❌ | — | Filtrar RAG por linguagem |
| `stream` | boolean | ❌ | `false` | Streaming SSE |

**Response (stream: false):**
```json
{
  "response": "Para implementar JWT...",
  "codeBlocks": [
    { "language": "typescript", "code": "const token = jwt.sign(...);" }
  ],
  "model": "local",
  "sources": [
    {
      "repo": "meu-projeto",
      "filePath": "src/auth/jwt.service.ts",
      "language": "typescript",
      "score": 0.72
    }
  ]
}
```

**Response (stream: true)** — Server-Sent Events:
```
data: {"text": "Para "}
data: {"text": "implementar "}
data: {"text": "JWT..."}
data: [DONE]
```

**Seleção automática de modelo (`auto`):**
- Usa Ollama local (`qwen2.5-coder:7b`) quando disponível e tokens < 30K
- Faz fallback para Claude API quando Ollama está indisponível ou tokens > 30K
- Se `model: "claude"` e `CLAUDE_API_KEY` não configurada, retorna 503

---

## POST /index

Inicia indexação de um diretório local em background.

**Request:**
```json
{
  "dirPath": "~/projetos/meu-repo",
  "name": "meu-repo"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `dirPath` | string | ✅ | Caminho absoluto ou `~/...` |
| `name` | string | ❌ | Nome do repo (padrão: basename do diretório) |

**Response:**
```json
{
  "status": "started",
  "name": "meu-repo",
  "path": "/Users/kelsen/projetos/meu-repo",
  "message": "Indexação de \"meu-repo\" iniciada em background"
}
```

**Erros:**
- `400`: `dirPath` ausente, diretório não encontrado, ou caminho não é diretório
- `409`: Já há uma indexação em andamento

---

## GET /index/status

Retorna se há uma indexação em andamento.

**Response:**
```json
{
  "isIndexing": false
}
```

---

## DELETE /index/:repo

Remove todos os chunks e vetores de um repositório específico.

**Parâmetro de URL:** `repo` — nome do repositório (exato, case-sensitive)

**Response:**
```json
{
  "status": "ok",
  "repo": "meu-repo",
  "removed": 87
}
```

**Erros:**
- `404`: Repo não encontrado no índice

---

## DELETE /index

Remove **todo** o índice (todos os repos).

**Response:**
```json
{
  "status": "ok",
  "message": "Índice completamente limpo"
}
```

---

## Erros

| Status | Descrição |
|--------|-----------|
| 400 | Request inválido (campo obrigatório ausente, validação Zod) |
| 404 | Recurso não encontrado |
| 409 | Conflito (ex: indexação já em andamento) |
| 503 | Claude API não configurado e Ollama indisponível |
| 500 | Erro interno |

```json
{
  "error": "Mensagem de erro",
  "details": {}
}
```
