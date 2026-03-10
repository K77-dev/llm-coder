# Setup Code LLM — MacBook Pro M4

## Pré-requisitos

```bash
# 1. Verificar specs
uname -a          # Deve mostrar arm64
sysctl hw.memsize # Deve mostrar >= 24GB

# 2. Verificar espaço livre (~20GB necessários)
df -h /

# 3. Verificar Node.js v20 (OBRIGATÓRIO — better-sqlite3 falha no v25+)
node --version    # v20.x.x
npm --version     # v10+

# Se precisar trocar de versão:
nvm install 20
nvm use 20
echo "20" > .nvmrc
```

---

## Setup Passo-a-Passo

### Passo 1: Dependências (2 min)

```bash
# No diretório raiz do projeto
nvm use 20
npm install
```

### Passo 2: Ollama + Modelos (10 min)

```bash
# Instalar Ollama
brew install ollama

# Iniciar o daemon (ou deixar rodar como app)
ollama serve &

# Verificar que está rodando
curl http://localhost:11434/api/tags

# Baixar modelo de chat (padrão: qwen2.5-coder:7b)
ollama pull qwen2.5-coder:7b

# Baixar modelo de embeddings (obrigatório para RAG)
ollama pull nomic-embed-text

# Verificar modelos disponíveis
ollama list
```

**Modelos alternativos de chat:**
| Modelo | RAM | Qualidade |
|--------|-----|-----------|
| `qwen2.5-coder:7b` | ~5GB | Boa (padrão) |
| `codellama:7b` | ~4GB | Boa |
| `codellama:13b` | ~8GB | Alta |

### Passo 3: Configurar Ambiente (1 min)

```bash
cp .env.example .env
```

Conteúdo mínimo do `.env`:

```env
# LLM
LLM_MODEL=qwen2.5-coder:7b
LLM_HOST=http://localhost:11434

# Embeddings
EMBEDDING_MODEL=nomic-embed-text

# Database (criado automaticamente)
DB_PATH=~/.code-llm/vectors.db

# Fallback Claude (opcional)
CLAUDE_API_KEY=sk-ant-...

# Segurança
JWT_SECRET=dev-secret-local-only
```

### Passo 4: Iniciar Aplicação (30s)

```bash
# Terminal 1: Certifique-se que o Ollama está rodando
ollama serve

# Terminal 2: Iniciar o projeto
npm run dev

# Esperado:
# ✓ frontend ready at http://localhost:3002
# ✓ backend ready at http://localhost:3001
```

> **Por que porta 3002?** A porta 3000 é ocupada por padrão pelo Open WebUI (Ollama UI).

### Passo 5: Indexar um Projeto

Acesse `http://localhost:3002` e use o painel **"Indexar projeto"** na sidebar:

1. Cole o caminho do diretório: ex. `~/Documents/projetos/meu-repo`
2. Defina um nome (opcional): ex. `meu-repo`
3. Clique em **Indexar** — a indexação ocorre em background
4. Acompanhe o contador de chunks na seção **Status**

Ou via API:

```bash
curl -X POST http://localhost:3001/api/index \
  -H "Content-Type: application/json" \
  -d '{"dirPath": "~/projetos/meu-repo", "name": "meu-repo"}'
```

### Passo 6: Verificar Funcionamento

```bash
# Status do sistema
curl http://localhost:3001/api/health | jq .

# Status da indexação
curl http://localhost:3001/api/index/status | jq .

# Testar chat (sem indexação)
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Como implementar um serviço REST com Node.js?"}'
```

---

## Troubleshooting

### "better-sqlite3 falhou ao compilar / build error"

```bash
# Causa: Node.js versão > 20 (v25+ não funciona)
node --version    # Se for v21+ ou v25+, trocar:
nvm install 20
nvm use 20
npm install       # Re-instalar com v20
```

### "Failed to fetch / CORS error"

```bash
# Causa: backend não está rodando ou porta errada
# Verificar se o backend está na porta 3001:
curl http://localhost:3001/api/health

# Se retornar "connection refused", iniciar backend:
npm run dev --workspace=backend
```

### "Ollama connection refused"

```bash
# Iniciar Ollama
ollama serve &

# Verificar se o modelo está instalado
ollama list

# Se não estiver, baixar:
ollama pull qwen2.5-coder:7b
ollama pull nomic-embed-text
```

### "Indexação concluída mas contexto não aparece nas respostas"

O contexto só entra na resposta se os chunks indexados tiverem similaridade coseno ≥ 0.45 com a pergunta.

```bash
# Verificar chunks indexados:
sqlite3 ~/.code-llm/vectors.db "SELECT repo, COUNT(*) FROM code_chunks GROUP BY repo;"

# Se houver duplicatas (mesmo projeto com nomes diferentes):
# 1. Clique em "Limpar índice" na sidebar, OU:
curl -X DELETE http://localhost:3001/api/index

# 2. Reindexar o projeto
```

### "SQLite database locked"

```bash
# Reiniciar o backend
# (o lock é liberado automaticamente)
npm run dev --workspace=backend
```

### "MacBook lento / fan constante"

```bash
# Usar modelo menor
ollama pull qwen2.5-coder:1.5b

# Atualizar .env:
# LLM_MODEL=qwen2.5-coder:1.5b

# Reiniciar backend
```

---

## Monitoramento de Memória

```bash
# Uso esperado (qwen2.5-coder:7b):
# Ollama:     ~5GB
# Node.js:    ~2GB
# SQLite:     ~200MB
# Total:      ~7-8GB (de 24GB) ✅

ps aux | grep -E "(ollama|node)" | awk '{print $11, $6/1024 "MB"}'
```

---

## Gerenciar o Índice

```bash
# Listar repos indexados
sqlite3 ~/.code-llm/vectors.db "SELECT repo, COUNT(*) as chunks FROM code_chunks GROUP BY repo;"

# Remover um repo específico
curl -X DELETE http://localhost:3001/api/index/nome-do-repo

# Limpar tudo
curl -X DELETE http://localhost:3001/api/index

# Backup do banco
cp ~/.code-llm/vectors.db ~/.code-llm/backup-$(date +%Y%m%d).db
```

---

**Versão**: 1.0 — Março 2026
**Testado em**: MacBook Pro M4 24GB, Node.js v20, Ollama 0.5+
