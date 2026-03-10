# Deploy

## Local (MacBook M4) — Desenvolvimento

```bash
# Pré-requisitos
brew install ollama
ollama pull codellama:13b-instruct-q4_K_M
ollama pull nomic-embed-text

# Setup
npm install
npm run setup:db
cp .env.example .env

# Iniciar
npm run dev
```

URLs: Frontend `http://localhost:3000` · Backend `http://localhost:3001`

---

## Docker (Local)

```bash
# Build e start
docker-compose up -d

# Logs
docker-compose logs -f backend

# Stop
docker-compose down
```

> **Nota:** Ollama precisa estar rodando na máquina host. O backend acessa via `host.docker.internal:11434`.

---

## Railway (Cloud Backend — Phase 2)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy backend
cd backend
railway login
railway init
railway up

# Set env vars
railway variables set LLM_HOST=http://localhost:11434
railway variables set NODE_ENV=production
```

---

## Vercel (Frontend — Phase 2)

```bash
cd frontend
npx vercel

# Set env var
vercel env add NEXT_PUBLIC_API_URL production
# Value: https://your-railway-backend.up.railway.app
```

---

## Variáveis de Ambiente por Ambiente

| Variável | Local | Railway |
|----------|-------|---------|
| `LLM_HOST` | `http://localhost:11434` | `http://localhost:11434` |
| `DB_PATH` | `~/.bbts-llm/vectors.db` | `/data/vectors.db` |
| `NODE_ENV` | `development` | `production` |
| `LOG_LEVEL` | `debug` | `info` |
| `CLAUDE_API_KEY` | Opcional | Recomendado |
