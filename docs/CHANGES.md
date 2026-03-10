# Resumo de Ajustes - BBTS Code LLM PRD

## 🎯 Foco Principal
**BBTS Code LLM otimizada para rodar em MacBook Pro M4 (24GB RAM) SEM comprometer o funcionamento**

---

## 📊 Mudanças Principais

### 1. Arquitetura: Cloud-First → Local-First

**ANTES:**
```
Pinecone (Cloud) ← Vector DB
Claude API (Cloud) ← LLM
Vercel + Railway ← Deployment
```

**DEPOIS:**
```
SQLite + sqlite-vec (Local) ← Vector DB (200MB RAM, 2-3GB disk)
Code Llama 13B (Ollama) ← LLM (8-10GB RAM, local)
MacBook + Cloud hybrid ← Deployment inteligente
```

---

### 2. Requisitos Técnicos

| Aspecto | Antes | Depois | Benefício |
|---------|-------|--------|-----------|
| **LLM** | Claude API (cloud) | Code Llama 13B local | Zero latência, offline |
| **Vector DB** | Pinecone ($) | SQLite + sqlite-vec | Free, local, <50ms |
| **Embedding** | OpenAI API | nomic-embed-text (local) | Free, 2GB |
| **Backend** | Express + Pinecone SDK | Express + SQLite | Menor footprint |
| **Deployment** | Vercel + Railway | MacBook + Railway (sync) | Híbrido, escalável |

---

### 3. Memory Footprint

**ANTES:**
- Node.js: 2-3GB
- Pinecone client: Minimal
- Embeddings: Via API (zero local)
- Fallback: Nenhum
- **Total local: ~3GB**
- **Dependências: Cloud obrigatório**

**DEPOIS:**
```
Level 1 - Comfortable (11-13GB):
├── Node.js + Next.js: 2-3GB
├── Code Llama 13B: 8-10GB
├── SQLite + cache: <200MB
└── Buffer: 1GB
Result: Ainda 11-13GB FREE ✅

Level 2 - Full Features (14-16GB):
├── Tudo anterior
├── Vector index cache: 2-3GB
└── Buffer: 1GB
Result: Ainda 8-10GB FREE ✅

🚫 MAX CAP: 20GB (deixar 4GB buffer)
```

---

### 4. Stack Técnico

**Backend (Before):**
```
express@4.18 + @pinecone-database/pinecone + @anthropic-sdk/sdk
- Dependências: 150+ packages
- Tamanho: ~200MB node_modules
```

**Backend (After):**
```
express@4.18 + sqlite3 + sqlite-vec + ollama + pino
- Dependências: ~50 packages (67% menos!)
- Tamanho: ~80MB node_modules
- Mem overhead: Reduzido 40%
```

**LLM (Before):**
```typescript
const response = await client.messages.create({
  model: "claude-opus-4-6",
  // Sempre cloud, latência 1-2s
})
```

**LLM (After):**
```typescript
const response = await ollama.generate({
  model: "codellama:13b",
  // Local, latência 0.5-1s
  // Fallback automático para Claude se contexto > 30K tokens
})
```

---

### 5. Fases Atualizadas

| Fase | Timeline | Stack | MacBook Impact | Cloud |
|------|----------|-------|-----------------|-------|
| **1: MVP** | 4 semanas | Ollama + SQLite | 11-13GB, offline | Nenhum |
| **2: Expansion** | +4 semanas | ^ + Railway | 11-13GB, sync | ~$100/mês |
| **3: Production** | +4 semanas | ^ + Agents | 11-13GB, hybrid | ~$400/mês |

---

### 6. Custo Total

**ANTES:**
- Fase 1: $10K (setup) + $50/mês
- Fase 2: $26K (setup) + $300/mês
- Fase 3: $39K (setup) + $2K/mês
- **Total: $75K + $2,350/mês**

**DEPOIS:**
- Fase 1: $8K (setup) + $0/mês ✅
- Fase 2: $24K (setup) + $65/mês ✅
- Fase 3: $34K (setup) + $600/mês ✅
- **Total: $66K + $665/mês** (-$9K setup, -$1,685/mês)

---

### 7. Vantagens Novas

✅ **Zero Latência em Casa**
- Local LLM: 0.5-2s vs Cloud: 1-3s
- RAG search: <50ms (M4 SSD)

✅ **Offline First**
- Funciona sem internet
- Fallback automático para cloud se necessário

✅ **Dados Privados**
- Código nunca sai do MacBook (até sync noturno)
- Nenhum processamento em servidor externo

✅ **Sem Surpresas de Custo**
- Code Llama + SQLite são free/open-source
- Escalabilidade é opção, não necessidade

✅ **Hybrid Scaling**
- MacBook para dev local
- Cloud para equipes grandes
- Ambos sincronizados

✅ **Performance Guaranteed**
- Memory budget fixo: 11-13GB
- Monitoramento automático
- Fallback se exceder limites

---

### 8. Instalação Simplificada

**ANTES:**
```bash
# Setup Pinecone account
# Setup Claude API key
# Deploy a Vercel + Railway
# Configure CI/CD
# ~60 minutos + dependências cloud
```

**DEPOIS:**
```bash
brew install ollama
ollama pull codellama:13b-instruct-q4_K_M  # 8 min, ~8.5GB
npm install && npm run dev
# ~15 minutos, tudo local
```

---

### 9. Performance Targets (MacBook M4)

**Antes:**
- Latência: 1-3s (cloud network)
- Throughput: Limitado por API rate
- Offline: ❌ Não funciona

**Depois:**
```
✅ Latência P50: <1s (local)
✅ Latência P95: <2s (local)
✅ Throughput: Unlimited (local)
✅ Offline: Sim (com cache)
✅ Fallback latency: 1-3s (cloud)
```

---

### 10. Roadmap Visual Atualizado

```
MacBook-First Approach:

Week 1-4: MVP LOCAL
├── Ollama + Code Llama
├── SQLite + vector search
└── Chat offline-first
    Memory: 11-13GB ✅

Week 5-8: EXPANSION HYBRID
├── Railway backend (index backup)
├── VSCode extension
├── Sync nightly
    Memory: 11-13GB ✅
    Cloud: ~$100/mês

Week 9-12: PRODUCTION DISTRIBUTED
├── Cloud for agents
├── Local for chat
├── Fully hybrid
    Memory: 11-13GB ✅
    Cloud: ~$400/mês
```

---

## 🔑 Pontos-Chave

1. **Zero Compromise**: MacBook segue rápido, responsivo, cool
2. **Offline-First**: Funciona completamente desconectado
3. **Cloud-Optional**: Escalabilidade quando precisar
4. **Cost-Effective**: ~75% mais barato que versão anterior
5. **Privacy**: Dados locais, segurança aprimorada
6. **Developer-Friendly**: Setup 15min vs 60min

---

## ✅ Verificação de Sucesso

MacBook Pro M4 (24GB) roda BBTS Code LLM quando:

```bash
# 1. Memory check
free -h  # 11-13GB usados máximo

# 2. Swap check
vm_stat | grep "Pages swapped out"  # <200MB

# 3. CPU check
ps aux | grep ollama  # <30% CPU avg

# 4. Thermal check
istats  # <55°C core temp

# 5. Responsiveness check
# Outros apps rodam sem lag
# Zoom calls sem travamento
# Browser não congela
```

---

**Documento ajustado para**: MacBook Pro M4 24GB  
**Foco**: Zero compromise on performance  
**Status**: Ready for Phase 1 Implementation