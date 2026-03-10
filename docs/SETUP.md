# Setup BBTS Code LLM - MacBook Pro M4

## 📋 Checklist Pre-requisitos

```bash
# 1. Verificar MacBook specs
uname -a  # Deve mostrar arm64
sysctl hw.memsize  # Deve mostrar 25769803776 (24GB)

# 2. Verificar espaço em disco (precisa ~20GB livre)
df -h /  # Coluna "Avail" deve mostrar >= 20GB

# 3. Verificar Node.js
node --version  # v20.11+ recomendado
npm --version  # v10+
```

---

## 🚀 Setup Passo-a-Passo (45 minutos)

### Passo 1: Clone + Dependências (5 min)

```bash
# Clone repo (substituir URL)
git clone https://github.com/bbts/code-llm.git
cd code-llm

# Install Node.js v20 (via nvm recomendado)
nvm install 20
nvm use 20

# Install dependencies (minimal)
npm install

# Verify (deve ser ~80MB, não ~200MB)
du -sh node_modules
```

### Passo 2: Setup Ollama (10 min)

```bash
# 1. Install Ollama
brew install ollama

# 2. Start Ollama daemon (background)
ollama serve &

# 3. Verify running
curl http://localhost:11434/api/tags
# Deve retornar JSON {"models": []}

# 4. Pull Code Llama (8-10 minutos, 8.5GB)
# OPÇÃO A: Recomendado (melhor qualidade)
ollama pull codellama:13b-instruct-q4_K_M

# OPÇÃO B: Se performance for crítica
ollama pull codellama:7b-instruct-q4_K_M

# Verify (deve listar o modelo)
ollama list
```

**Estimativa de Tempo:**
- Download: 8 minutos (depende de internet)
- Descompactação: 2 minutos

### Passo 3: Setup Database (5 min)

```bash
# 1. Create db directory
mkdir -p ~/.bbts-llm

# 2. Initialize SQLite database
npm run setup:db

# 3. Verify (deve criado os arquivos)
ls -la ~/.bbts-llm/
# Esperado:
#   -rw-r--r--  vectors.db    (será ~2-3GB após indexação)
#   -rw-r--r--  cache.db      (será ~100-200MB)
#   -rw-r--r--  config.json
```

### Passo 4: Index Your Code (20 min - pode roderar background)

```bash
# 1. Configure repositórios a indexar
cat > .env << 'ENVEOF'
REPOS_TO_INDEX=java-backend,node-api,react-apps,angular-apps
BATCH_SIZE=100
INDEX_SCHEDULE="0 2 * * *"  # 2 AM daily
ENVEOF

# 2. Fazer indexação inicial (roda em background)
npm run index:initial

# Progress log
tail -f logs/indexing.log

# Pode continuar com próximos passos enquanto roda
```

### Passo 5: Start Application (2 min)

```bash
# Terminal 1: Start Ollama (se não estiver rodando)
ollama serve

# Terminal 2: Start app
npm run dev

# Esperado:
# > Next.js ready on http://localhost:3000
# > Express ready on http://localhost:3001

# Open em browser
open http://localhost:3000
```

### Passo 6: Verify Funcionando (3 min)

```bash
# 1. Checar Ollama responde
curl -X POST http://localhost:11434/api/generate \
  -d '{"model":"codellama:13b","prompt":"hello"}'

# 2. Checar database loaded
sqlite3 ~/.bbts-llm/vectors.db "SELECT COUNT(*) FROM vectors;"

# 3. Checar Node.js healthy
curl http://localhost:3001/health

# 4. Tentar chat
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Como fazer JWT em Java?","model":"local"}'
```

---

## 📊 Memory Monitoring

### Real-time Monitor

```bash
# Terminal separado: Monitor a cada 5 segundos
watch -n 5 'ps aux | grep -E "(ollama|node|_next)" | \
  awk "{print \$11, \$6/1024 \"MB\"}" | column -t'

# Ou mais detalhado:
top -o %MEM -n 1
```

### Expected Output (Level 1 - Comfortable)

```
PROCESS              MEMORY
Ollama (codellama)   8.5GB
Node.js              2.0GB
Next.js              1.0GB
sqlite3              0.2GB
───────────────────────────
Total                11.7GB ✅

Available:           12.3GB ✅
Swap:                <50MB ✅
Fan:                 Quiet/Occasional ✅
```

---

## ⚙️ Configuração (.env)

```bash
# Criar .env (copiar de .env.example)
cp .env.example .env

# Editar:
cat > .env << 'ENVEOF'
# LLM
LLM_MODEL=codellama:13b-instruct-q4_K_M
LLM_HOST=http://localhost:11434
LLM_FALLBACK=claude
CLAUDE_API_KEY=sk-... # Optional fallback

# Database
DB_PATH=~/.bbts-llm/vectors.db
DB_CACHE_PATH=~/.bbts-llm/cache.db

# Vector Search
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_BATCH=32
VECTOR_DIMENSIONS=384

# Memory Management
MAX_MEMORY_MB=13000  # 13GB max
CACHE_TTL=3600
LRU_CACHE_SIZE=500

# Logging
LOG_LEVEL=info
LOG_PATH=./logs

# Indexing
REPOS_TO_INDEX=java-backend,node-api,react-apps
INDEX_SCHEDULE=0 2 * * *  # 2 AM daily
ENVEOF
```

---

## 🐛 Troubleshooting

### Problema: "Ollama connection refused"

```bash
# Solução 1: Restart Ollama
killall ollama
ollama serve &

# Solução 2: Check port
lsof -i :11434

# Solução 3: Verify instalado
which ollama
ollama --version
```

### Problema: "Node running out of memory"

```bash
# Solução 1: Aumentar Node.js memory limit
NODE_OPTIONS="--max_old_space_size=4096" npm run dev

# Solução 2: Reduzir cache
sed -i '' 's/LRU_CACHE_SIZE=500/LRU_CACHE_SIZE=200/' .env
npm restart

# Solução 3: Usar modelo menor
ollama pull codellama:7b-instruct-q4_K_M
sed -i '' 's/13b/7b/' .env
```

### Problema: "SQLite database locked"

```bash
# Solução 1: Restart app
npm run dev

# Solução 2: Repair database
sqlite3 ~/.bbts-llm/vectors.db "VACUUM;"
sqlite3 ~/.bbts-llm/vectors.db "REINDEX;"

# Solução 3: Reset (⚠️ perderá índice)
rm ~/.bbts-llm/vectors.db
npm run setup:db
npm run index:initial
```

### Problema: "MacBook fan running constantly"

```bash
# Solução 1: Reduzir modelo
# Change from 13B → 7B
ollama pull codellama:7b-instruct-q4_K_M

# Solução 2: Reduce batch size
sed -i '' 's/EMBEDDING_BATCH=32/EMBEDDING_BATCH=16/' .env

# Solução 3: Limit CPU
# MacBook M4 tem 8 cores, usar só 4:
NUM_THREADS=4 npm run dev

# Solução 4: Kill background indexing
npm run index:stop
```

### Problema: "Latência alta (>3s resposta)"

```bash
# Diagnóstico
curl http://localhost:11434/api/tags | grep "memory"

# Solução 1: Model loaded?
ollama pull codellama:13b-instruct-q4_K_M  # Re-download

# Solução 2: SSD cacheada?
# First query sempre mais lenta (modelo carrega em memória)
# Queries seguintes: <1s ✅

# Solução 3: M4 GPU aceleração?
# Verif GPU enabled:
# ollama logs | grep "GPU"

# Solução 4: Fallback para Claude
# Edit response para usar Claude se latência > 3s
```

---

## 🔄 Operação Diária

### Morning Routine (verificar tudo OK)

```bash
# 1. Restart fresh
npm run stop
npm run dev

# 2. Check memory
ps aux | grep ollama | grep -v grep

# 3. Quick test
curl -s http://localhost:3000/health | jq .

# 4. Test LLM
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
```

### Nightly (scheduled)

```bash
# 1. Indexing automático (configured)
# Roda 2 AM diariamente

# 2. Cache cleanup (automático)
npm run cache:clean

# 3. Backup (manual, semanal)
cp ~/.bbts-llm/vectors.db ~/.bbts-llm/backup-$(date +%Y%m%d).db
```

### Weekly (maintenance)

```bash
# 1. Defrag database
sqlite3 ~/.bbts-llm/vectors.db "VACUUM;"

# 2. Check disk space
df -h /
# Deve ter >= 10GB livre

# 3. Update dependencies
npm update

# 4. Reindex if repositories changed
npm run index:full
```

---

## ✅ Success Checklist

Você sabe que tudo funciona quando:

```
[ ] MacBook remains responsive (não trava)
[ ] Fan noise: Quiet/occasional only
[ ] Memory: 11-13GB usado máximo
[ ] Swap: <200MB usado
[ ] Chat response: <2s (local Ollama)
[ ] Code autocomplete: <1s
[ ] Offline chat: Funciona sem internet
[ ] Fallback: Automático para Claude se offline
[ ] No thermal throttling
[ ] Battery vida normal (10-12 horas)
```

---

## 🚨 Emergency Procedures

### Se tudo parar de funcionar

```bash
# Nuclear reset (⚠️ vai perder índice)
npm run clean
rm -rf ~/.bbts-llm
rm -rf node_modules
rm package-lock.json

# Reinstall
npm install
npm run setup:db

# Restart
npm run dev
```

### Se MacBook estiver extremamente lento

```bash
# 1. Kill Ollama immediately
killall ollama

# 2. Free memory
npm run cache:clean

# 3. Restart tudo
npm run stop
sleep 5
npm run dev

# 4. Se ainda lento: usar fallback
FALLBACK_ONLY=true npm run dev
# Isso usa só Claude API (cloud), 0 local compute
```

---

## 📞 Getting Help

Se algo não funcionar:

1. **Check logs**
   ```bash
   tail -f logs/app.log
   tail -f logs/llm.log
   tail -f logs/indexing.log
   ```

2. **Common issues**
   - Memory pressure? → Usar modelo 7B
   - Latência alta? → Check CPU/thermal
   - Indexação lenta? → Check SSD space
   - Crashes? → Check Node heap

3. **Report issue** (com logs)
   ```bash
   npm run report:issue  # Coleta logs automático
   ```

---

**Última atualização**: Março 2026  
**Versão**: 1.0  
**Tested on**: MacBook Pro M4 24GB