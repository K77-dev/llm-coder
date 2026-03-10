# PRD: BBTS Code LLM
## Especialista em Desenvolvimento (Java, Node.js, React, Angular)

**Data:** Março 2026  
**Versão:** 1.0  
**Proprietário:** Kelsen (BBTS)  
**Status:** Em Planejamento  

---

## Sumário Executivo

O **BBTS Code LLM** é um assistente de IA especializado em desenvolvimento de software, treinado nas práticas, padrões e stack tecnológico da BBTS. Será uma solução end-to-end que combina **RAG (Retrieval-Augmented Generation)**, **fine-tuning seletivo** e **integração com Claude Code** para acelerar desenvolvimento e garantir conformidade com padrões internos.

**Objetivo Principal:** Desenvolver uma LLM especializada que acelere o desenvolvimento de software na BBTS, automatizando tarefas de codificação, debugging, refatoração e documentação para a stack **Java/Spring, Node.js, React e Angular**.

---

## 1. Problema a Resolver

### 1.1 Desafios Atuais

**Desenvolvedores da BBTS enfrentam:**

- ❌ Curva de aprendizado para novos padrões arquiteturais internos
- ❌ Inconsistência na aplicação de boas práticas (SOLID, DDD, Hexagonal)
- ❌ Documentação desatualizada de padrões específicos do blockchain (Hyperledger Besu)
- ❌ Dificuldade em combinar conhecimento entre múltiplas linguagens (Java + Node.js + React/Angular)
- ❌ Geração de código boilerplate repetitivo (controllers, services, DTOs, componentes)
- ❌ Debug demorado em sistemas distribuídos (RabbitMQ, Kubernetes, Besu)
- ❌ Inconsistência em padrões de autenticação/autorização (JWT, OAuth, RBAC)

### 1.2 Impacto Esperado

| Métrica | Baseline | Alvo | Impacto |
|---------|----------|------|--------|
| Tempo de onboarding | 4 semanas | 1.5 semanas | -62% |
| Bugs em padrões | 3-4 por sprint | <1 por sprint | -75% |
| Tempo de code review | 2-3 horas | 30min | -80% |
| Reutilização de código | 45% | 85% | +89% |
| Time satisfaction | 6.5/10 | 8.5/10 | +31% |

---

## 2. Visão Técnica

### 2.1 Arquitetura de Alto Nível (Otimizado para MacBook M4)

```
┌─────────────────────────────────────────────────────────┐
│        Frontend + Backend (UNIFIED - Node.js)           │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Next.js/React Chat + VSCode Extension           │   │
│  │ - Same process (memory efficient)               │   │
│  │ - Shared auth/state                            │   │
│  │ - Direct LLM integration                        │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
┌────────▼────┐ ┌───▼────┐ ┌───▼────────┐
│Local LLM    │ │Vector  │ │Tools &     │
│(Ollama)     │ │Store   │ │Agents      │
│Code Llama   │ │(Local) │ │            │
│13B/34B      │ │SQLite+ │ │            │
│Memory: 8-12G│ │Vec DB  │ │            │
└─────┬──────┘ └────┬───┘ └────┬───────┘
      │            │          │
      └────────┬───┴──────┬───┘
               │          │
       ┌───────▼─┐    ┌──▼──────────┐
       │RAG Index│    │System Cache  │
       │(Disk)   │    │(~2GB)        │
       │~3-4GB   │    │              │
       └─────────┘    └──────────────┘

MEMORY BREAKDOWN (24GB total):
├── macOS system + apps:     4GB (reserved)
├── Node.js process:         2-3GB
├── Ollama (Code Llama 13B): 8-10GB
├── Vector cache:            2-3GB
├── RAG index (disk):        Free space
└── User buffer:             2-3GB (headroom)
```

**Estratégia Local-First:**
- ✅ LLM roda localmente (Ollama) - zero latência
- ✅ Vector DB local (sqlite-vec) - sem dependências externas
- ✅ RAG index no disco - sem limites
- ✅ Fallback para Claude API (quando precisa maior capacidade)
- ✅ Zero comprometimento de performance

### 2.2 Componentes Principais (MacBook M4 Otimizado)

#### 2.2.1 RAG Engine Local (Phase 1 - MVP)
- **Vector Database:** SQLite com extensão vec (sqlite-vec)
  - Zero overhead
  - ~200MB de memória em runtime
  - ~2-3GB em disco para índice completo
  - Performance: <50ms per query
- **Embedding Model:** 
  - Opção A (Offline): `nomic-embed-text` via Ollama (~2GB)
  - Opção B (Online): OpenAI embeddings (fallback com cache local)
- **Chunk Strategy:** Semântico (funções, classes, modelos de dados)
- **Indexação:** Repositórios Git + docs internas (nightly batch)

#### 2.2.2 LLM Base (Local-First)
- **Modelo Primário:** Code Llama 13B (via Ollama)
  - RAM necessária: 8-10GB
  - Latência: ~1-2s (M4 GPU acceleration)
  - Qualidade: 90%+ equivalente ao Llama 34B
  - **Alternativa:** Code Llama 7B (6-7GB RAM) para máxima performance
- **Fallback:** Claude API (quando precisa maior capacidade)
  - Automático quando contexto >30K tokens
  - Mantém conformidade com dados sensíveis

#### 2.2.3 Execution Layer
- **Claude Code Integration:** Rodar código gerado (opcional)
- **IDE Plugins:** VSCode extension (mesma aplicação)
- **Git Integration:** Simple-git (local)
- **Testing:** Jest + local execution

#### 2.2.4 Knowledge Base (Disco + Cache)
- **Padrões:** SOLID, DDD, Hexagonal Architecture
- **Stack Specific:** Hyperledger Besu, Spring Boot, RabbitMQ
- **Security:** OAuth, JWT, RBAC, OIDC patterns
- **Ops:** Kubernetes, AKS, CI/CD patterns
- **Storage:** Disk-based (~500MB indexed patterns)

---

## 3. Estratégia de Construção

### 3.1 Approach: RAG + Fine-tuning Hybrid

**Por que não treinar do zero?**
- 💰 Custo: $500K-$2M + 6-12 meses
- ⏱️ Timeline: Inviável para projeto de 2026
- 📊 Risk: Alto risco de falha

**Por que RAG + Fine-tuning é ótimo?**
- ✅ MVP em 4-6 semanas
- ✅ Custos $10K-30K (razoável)
- ✅ Precisão 90%+ para casos de uso comuns
- ✅ Atualizável incrementalmente

### 3.2 Dados Necessários

#### 2.2.1 Codebase Indexing
```
bbts-codebase/
├── java-backend/              # ~50K files, 2M+ LOC
│   ├── microservices/
│   ├── blockchain/
│   └── shared-libs/
├── node-apis/                 # ~30K files, 1M+ LOC
│   ├── orchestration/
│   ├── adapters/
│   └── workers/
├── react-apps/                # ~20K files, 500K+ LOC
│   └── enterprise/
├── angular-apps/              # ~15K files, 400K+ LOC
│   └── admin/
├── kubernetes/                # Manifests, Helm charts
├── smart-contracts/           # Besu contracts, Solidity
└── docs/                       # Architecture, patterns
    ├── ADRs (Architecture Decision Records)
    ├── runbooks/
    └── patterns/
```

**Estimativa Total:** ~6-8 GB de código + documentação

#### 2.2.2 Training Data para Fine-tuning
- 500-1000 exemplos de Q&A técnico (curado por eng. sênior)
- Padrões arquiteturais documentados (50+ exemplos)
- Histórico de PRs com bons comentários (500+ exemplos)
- Erros comuns + soluções (200+ pares)

---

## 4. Fases de Desenvolvimento

### Phase 1: MVP (Semanas 1-4) - RAG Local + LLM Offline

**Objetivos:**
- ✅ Indexar 30% do codebase BBTS (em disco, não RAM)
- ✅ Chat interface funcional (offline-first)
- ✅ Code Llama 13B rodando em Ollama (8-10GB)
- ✅ SQLite-Vec para busca local (<50ms)
- ✅ **ZERO comprometimento MacBook M4**
- ✅ 50+ queries testadas manualmente

**Entregáveis:**
```
Semana 1:
- [x] Setup Ollama + Code Llama 13B
- [x] Setup SQLite + sqlite-vec extension
- [x] Script de indexação código (Java + Node.js)
- [x] Test memory footprint (target: 11-13GB)

Semana 2:
- [x] SQLite vector index (primeiros 10K chunks)
- [x] Local RAG search pipeline (<50ms)
- [x] Chat API básica (Node.js/Express)
- [x] Fallback to Claude API (optional)

Semana 3:
- [x] Frontend React simples (Next.js)
- [x] Integração Ollama local
- [x] QA manual 50+ queries (offline mode)
- [x] Memory monitoring dashboard

Semana 4:
- [x] Deploy local (MacBook only - testing)
- [x] Documentação de instalação
- [x] Performance benchmarks
- [x] Readiness for Phase 2
```

**Stack Phase 1:**
- Frontend: Next.js 14 + React 18 + Tailwind (lightweight)
- Backend: Node.js 20 + Express (minimal deps)
- LLM: Code Llama 13B via Ollama (8-10GB)
- Vector DB: SQLite + sqlite-vec (200MB RAM, 2-3GB disk)
- Embeddings: nomic-embed-text via Ollama (2GB one-time)
- Deployment: MacBook only (local development)

**Custo Estimado:** $0 (all free/open-source)
**MacBook Impact:** +11-13GB memory, +50MB CPU avg

---

### Phase 2: Expansion (Semanas 5-8) - Local + Cloud Hybrid

**Objetivos:**
- ✅ Indexar 100% do codebase (em servidor, MacBook tira cópia)
- ✅ VSCode extension funcional (local execution)
- ✅ Cloud backup de índices (Railway/Vercel)
- ✅ 100+ usuarios beta (alguns em MacBook, alguns em Cloud)
- ✅ **MacBook segue com 11-13GB allocation**

**Arquitetura Hybrid:**
```
MacBook (Local):                Cloud (Railway):
┌──────────────┐              ┌──────────────┐
│ Code Llama   │              │ Full Index   │
│ 13B (8-10GB) │              │ (3-4GB)      │
│              │              │              │
│ Vector Cache │  ←sync→      │ Vector DB    │
│ (500MB)      │              │ Master       │
│              │              │              │
│ VSCode Ext   │  ←query→     │ API Server   │
│ (idle)       │              │ (scaling)    │
└──────────────┘              └──────────────┘
      ↓
  Fallback:
  Use Cloud index
  when local outdated
```

**Entregáveis:**
```
Semana 5:
- [x] Indexação completa em servidor (Railway)
- [x] Sync script (MacBook → Cloud nightly)
- [x] Metadata enriquecida

Semana 6:
- [x] VSCode extension MVP (local LLM)
- [x] Inline suggestions (sem latência)
- [x] Syntax highlight + code blocks

Semana 7:
- [x] Training data curation (500 examples)
- [x] Fine-tuning prep (LoRA setup)
- [x] Evaluation framework

Semana 8:
- [x] Beta launch (50-100 devs)
- [x] Mixed deployment (local + cloud)
- [x] Metrics baseline
```

**Stack Phase 2:**
- Tudo da Phase 1 +
- Railway backend (PostgreSQL + API)
- GitHub sync automation
- VSCode Extension (TypeScript)
- LoRA fine-tuning setup (opcional)

**Custo Estimado:** 
- MacBook: Still $0 (no new tools)
- Cloud: $100-300/mês (Railway small tier)

---

### Phase 3: Advanced Features (Semanas 9-12) - Agents + Distributed

**Objetivos:**
- ✅ Code generation agents (criar arquivos)
- ✅ Git integration (commits automáticos)
- ✅ Multi-step reasoning (Cloud heavy-lifting)
- ✅ Cloud deployment option (para servers)
- ✅ **MacBook stays lightweight (11-13GB)**

**Estratégia Distribuída:**
```
MacBook (Light):             Cloud (Heavy):
- VSCode ext                 - API Gateway
- Chat interface             - Large context queries
- Local queries              - Fine-tuned models
- File generation            - Analytics
- Git integration            - Database backup

               ← REST API ↔ WebSocket →
```

**Entregáveis:**
```
Semana 9:
- [x] Code agents framework (Cloud-based)
- [x] File creation API
- [x] Test generation (Cloud execution)

Semana 10:
- [x] Git workflow automation
- [x] PR description generation
- [x] Commit message generation

Semana 11:
- [x] Distributed architecture finalized
- [x] Load balancing (macOS ↔ Cloud)
- [x] Offline capability ensured

Semana 12:
- [x] Performance optimization
- [x] Analytics dashboard (Cloud)
- [x] Production launch (hybrid)
```

**Stack Phase 3:**
- Tudo anterior +
- Claude Code integration (optional Cloud)
- GitHub API automation
- Kubernetes/Container optional (Cloud only)
- PostHog analytics (Cloud)

**Custo Estimado:**
- MacBook: Still $0
- Cloud: $300-500/mês (scaled tier)

---

## 5. Stack Técnico Detalhado (MacBook M4 Otimizado)

### 5.1 Backend (Unified com Frontend)

```typescript
// Node.js/Express - LIGHTWEIGHT
Node.js 20.11+ (nativo ARM64 no M4)
Express.js 4.18+
TypeScript 5.3+

Bibliotecas ESSENCIAIS (memory-efficient):
- @anthropic-sdk/sdk                 // Fallback Claude API
- ollama/ollama                      // Local LLM control
- sqlite3                            // Vector DB
- sqlite-vec (extension)             // Vector search
- axios                              // HTTP client
- dotenv                             // Config
- zod                                // Validation (14KB)
- pino                               // Logging (leve vs winston)
- simple-git                         // Git ops

❌ EXCLUIR (memory hog):
- Express-session (usar JWT apenas)
- Redis (usar in-memory cache)
- Winston logger (usar Pino)
- Cors middleware (simple custom impl)
```

### 5.2 Frontend

```typescript
// Next.js 14 - App Router (memory efficient)
Next.js 14.0+
React 18.2+
TypeScript 5.3+
Tailwind CSS 3.3+ (PurgeCSS enabled)

Bibliotecas (minimal):
- zustand                            // State (2KB)
- react-markdown                     // Rendering
- shiki                              // Syntax highlight
- axios                              // API
- zustand-persist                    // Local state

❌ EXCLUIR:
- Redux (use Zustand)
- Next-auth (use simple JWT)
- Material-UI (use Tailwind)
```

### 5.3 IDE Integration

```typescript
// VSCode Extension - CRITICAL PERFORMANCE
VS Code API (native)
Node.js 18+ (bundled)
TypeScript 5.3+

Bibliotecas (must be lean):
- vscode                             // API
- @anthropic-sdk/sdk                 // Claude
- simple-git                         // Git ops

Performance Targets:
- Bundle size: <1MB
- Memory: <100MB
- Activation time: <500ms
```

### 5.4 Local Data Infrastructure (Zero Network)

```yaml
Vector Store:
  Provider: SQLite + sqlite-vec extension
  Location: ~/.bbts-llm/vectors.db
  Size: 2-3GB (complete index)
  Embedding Dim: 384 (nomic-embed-text)
  Query Latency: <50ms
  Memory overhead: <200MB

Embeddings:
  Model: nomic-embed-text (via Ollama)
  ou text-embedding-3-small (cache + fallback)
  Dimension: 384 (eficiente)
  Batch: 32 documents max

Caching:
  Strategy: In-memory LRU (Node.js)
  Size: 500-1000 entries (~200MB)
  TTL: 1 hour
  Hit rate target: 70%+

Persistent Cache:
  Format: SQLite blobs
  Location: ~/.bbts-llm/cache.db
  Purpose: Embeddings cache
```

---

## 5.6 Requisitos MacBook M4 (24GB RAM) - CRÍTICO

### Memory Budget Analysis (24GB total)

```
BASELINE SYSTEM:
macOS (Monterey/Ventura):     2-3GB (reserved)
Standard apps (Chrome, Mail):  1-2GB
Available for BBTS LLM:        19-21GB ✅

BBTS CODE LLM ALLOCATION:

Level 1 - Comfortable (11-13GB):
├── Node.js + Next.js process:     2-3GB
├── Code Llama 13B (quantized):     8-10GB
└── Reserve:                        1GB
Result: Still 11-13GB free ✅ ZERO IMPACT

Level 2 - Full Features (14-16GB):
├── Node.js + Next.js:              3GB
├── Code Llama 13B:                 10GB
├── Vector cache + index:           2-3GB
└── Reserve:                        1GB
Result: Still 8-10GB free ✅ OK

Level 3 - Heavy Usage (16-18GB):
├── Node.js + Next.js:              3GB
├── Code Llama 13B:                 10GB
├── SQLite + embeddings cache:      3-4GB
├── RAG search cache:               1-2GB
└── Reserve:                        1GB
Result: Still 6-8GB free ✅ ACCEPTABLE

🚫 NEVER EXCEED 20GB (deixar 4GB buffer)
```

### Performance Targets (MacBook M4 Pro, 24GB)

```
Baseline Metrics (before BBTS LLM):
├── Available memory: 10-12GB
├── Swap usage: <100MB
├── CPU idle: 5-10%
└── Thermals: Normal (35-45°C)

After BBTS LLM Deployment:
├── Available memory: 6-8GB ✅
├── Swap usage: <200MB ✅ (acceptable)
├── CPU idle: 10-15% ✅ (minimal increase)
├── Thermals: Normal-Warm (45-55°C) ✅
└── Fan speed: Occasional (not constant) ✅

Success Criteria:
✅ Swap usage < 500MB (never page to disk aggressively)
✅ Fan doesn't run constantly
✅ Other apps still responsive
✅ Battery drain: +10-15% max
✅ Thermal throttling: NEVER
```

### Optimization Strategies

#### Strategy 1: Code Llama Model Selection
```bash
# Option A: 13B (Recommended)
ollama pull codellama:13b-instruct-q4_K_M
# Size: 8.5GB
# Latency: 1-2s
# Quality: High
# RAM: 10GB

# Option B: 7B (Maximum Performance)
ollama pull codellama:7b-instruct-q4_K_M
# Size: 4GB
# Latency: 0.5-1s
# Quality: Good
# RAM: 6-7GB

# Recomendação: 13B (melhor custo/benefício)
```

#### Strategy 2: Memory-Efficient Caching
```typescript
// In-Memory Cache (Node.js)
const cache = new Map();
const MAX_CACHE_SIZE = 500; // entries
const CACHE_TTL = 3600000; // 1 hour

// Eviction: LRU (Least Recently Used)
// When exceeds 500: remove oldest 50
```

#### Strategy 3: Lazy Loading
```typescript
// Don't load everything on startup
// Load models on-demand:

// Lazy: Code Llama only when chat starts
const llm = await loadOllama('codellama:13b'); // ~5s first use

// Lazy: Embeddings only when indexing needed
const embedder = await loadEmbeddings(); // ~2s first use

// Lazy: Vector DB only when searching
const vectorDB = new SQLiteVec(); // instant
```

#### Strategy 4: Disk-Based Index (Not RAM)
```typescript
// SQLite stores index on disk (~3GB)
// Only reads queries into RAM (~50MB each)
// No need to load entire index into memory

CREATE VIRTUAL TABLE vectors USING vec0(
  embedding(384)  // 384-dim embeddings
);

// Query time: <50ms (M4 SSD speed)
// Memory impact: ~200MB
```

#### Strategy 5: Process Monitoring
```bash
# Monitor script (check every 30s)
watch -n 30 'ps aux | grep ollama | grep -v grep'
watch -n 30 'vm_stat' # macOS memory pressure

# If memory > 85% utilization:
#   - Stop Ollama
#   - Clear cache
#   - Restart with smaller model
```

```yaml
PRIMARY (Local - Zero Latency):
  Model: Code Llama 13B-Instruct
  Runner: Ollama (native M4 GPU)
  Memory: 8-10GB (quantized Q4_K_M)
  Latency: 1-2s per 100 tokens
  Cost: FREE (local)
  
  Alternative (smaller):
  Model: Code Llama 7B-Instruct
  Memory: 6-7GB
  Latency: 0.5-1s per 100 tokens
  Cost: FREE

FALLBACK (Online - High Capacity):
  Model: claude-opus-4-6
  Trigger: Context >30K tokens
  Cost: $0.015/1K input
  Cache: Local SQLite
  
EMBEDDINGS (Local with Fallback):
  Primary: nomic-embed-text (Ollama)
  Memory: 2GB one-time load
  Fallback: text-embedding-3-small (OpenAI)
  Cache: 1000 most recent queries

Zero Compromise Strategy:
✅ Roda integralmente offline
✅ Fallback automático para online
✅ Nenhum processamento necessário em server remoto
✅ Dados sensíveis nunca deixam máquina
```

---

## 6. Roadmap Detalhado

### Q1 2026 (Semanas 1-12)

| Semana | MVP (Weeks 1-4) | Expansion (5-8) | Advanced (9-12) |
|--------|-----------------|-----------------|-----------------|
| 1 | Setup + indexing start | - | - |
| 2 | RAG pipeline | - | - |
| 3 | Frontend basic | - | - |
| 4 | MVP deploy | - | - |
| 5 | - | Full indexing | - |
| 6 | - | VSCode ext | - |
| 7 | - | Fine-tune data | - |
| 8 | - | Beta launch | - |
| 9 | - | - | Code agents |
| 10 | - | - | Git automation |
| 11 | - | - | Local deploy |
| 12 | - | - | **PRODUCTION** |

### Q2 2026 (Maintenance + Features)

- Enterprise SSO integration
- Team collaboration features
- Advanced analytics
- Custom model fine-tuning for specific teams
- Integration com Jira/Azure DevOps

### Q3+ 2026 (Scale)

- Multi-language support (português-first)
- Specialized models por domain (blockchain, devops)
- Knowledge base auto-update from GitHub
- Federated deployment (on-prem option)

---

## 7. Métricas e Success Criteria

### 7.1 Métricas Técnicas

**Accuracy:**
- ✅ Pass@1: 70%+ (primeira sugestão resolveu o problema)
- ✅ Pass@3: 85%+ (dentro de 3 sugestões)
- ✅ Code compilation: 90%+ do código gerado compila
- ✅ Test pass rate: 80%+

**Performance:**
- ✅ Latência P50: <2s (primeiro token)
- ✅ Latência P95: <5s
- ✅ Uptime: 99.5%+
- ✅ Vector search: <100ms

**Quality:**
- ✅ Bug rate: <5% das respostas
- ✅ Security issues: 0% (detecção automática)
- ✅ Code style compliance: 95%+
- ✅ Pattern match: 85%+

### 7.2 Métricas de Negócio

**Adoção:**
- ✅ Week 4: 10 usuarios beta
- ✅ Week 8: 50+ usuarios beta
- ✅ Week 12: 100+ usuarios produção
- ✅ Month 6: 300+ usuarios (50% do tech squad)

**Impacto:**
- ✅ Redução tempo de codificação: 25%+
- ✅ Redução bugs em review: 30%+
- ✅ Developer satisfaction: +2 pontos NPS
- ✅ Onboarding time: -50%

**Financeiro:**
- ✅ ROI: Positivo em 6 meses
- ✅ Cost per developer: $10-20/mês
- ✅ Payback period: <9 meses

### 7.3 Critérios de Go/No-Go

**MVP (Week 4) Gate:**
- [ ] Chat básico funciona com 50+ queries
- [ ] 70%+ taxa de satisfação em testes manuais
- [ ] Indexação de 3 linguagens funciona
- [ ] <$100/mês em custos

**Beta (Week 8) Gate:**
- [ ] 100% codebase indexado
- [ ] VSCode extension estável
- [ ] 50+ usuarios participando
- [ ] 75%+ taxa de satisfação

**Production (Week 12) Gate:**
- [ ] Pass@1 ≥ 70%
- [ ] Latência P95 < 5s
- [ ] Zero vulnerabilidades de segurança
- [ ] Runbooks e documentação completa

---

## 8. Usando Claude Code para Acelerar

### 8.1 Tarefas Automatizadas com Claude Code

```javascript
// 1. Indexação de codebase
// - Varrer repos
// - Extrair funções/classes
// - Gerar chunks semânticos
// - Upload para Pinecone

// 2. Geração de código
// - Controllers Java automáticos
// - Services + DTOs
// - React components
// - Angular modules

// 3. Testing
// - Testes unitários automáticos
// - Testes de integração
// - Cobertura analysis
// - Performance benchmarks

// 4. Infrastructure
// - Kubernetes manifests
// - Docker images
// - CI/CD pipelines
// - Monitoring dashboards
```

### 8.2 Prompt Engineering Strategy

**System Prompt para indexação:**
```
Você é um especialista em análise de código Java, Node.js, React e Angular.
Sua tarefa é extrair trechos de código relevantes e criar resumos semânticos.

Para cada arquivo:
1. Identifique classes/funções principais
2. Extraia documentação e comentários
3. Crie chunks de 50-200 linhas
4. Gere resumo semântico para embedding

Linguagens suportadas: Java, JavaScript, TypeScript, React (JSX), Angular (TypeScript)
Output format: JSON com { filename, chunk_id, code, summary, language }
```

**System Prompt para geração de código:**
```
Você é um expert em desenvolvimento backend/frontend na BBTS.
Stack: Java (Spring Boot), Node.js (Express), React, Angular.

Quando gerar código:
1. Siga padrões SOLID e DDD
2. Use hexagonal architecture
3. Inclua testes unitários
4. Adicione documentação JSDoc/Javadoc
5. Implemente error handling robusto
6. Use tipos (TypeScript/generics Java)

Sempre forneça:
- Código completo e funcional
- Casos de teste
- Exemplos de uso
- Documentação inline
```

---

## 9. Estrutura do Codebase

```
bbts-code-llm/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   ├── controllers/
│   │   │   └── middleware/
│   │   ├── rag/
│   │   │   ├── indexer.ts
│   │   │   ├── searcher.ts
│   │   │   └── chunker.ts
│   │   ├── llm/
│   │   │   ├── claude-client.ts
│   │   │   ├── prompt-templates/
│   │   │   └── response-parser.ts
│   │   ├── db/
│   │   │   ├── pinecone-client.ts
│   │   │   └── migrations/
│   │   └── utils/
│   ├── tests/
│   ├── docker/
│   └── package.json
│
├── frontend/
│   ├── app/
│   │   ├── (chat)/
│   │   ├── (dashboard)/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ChatInterface/
│   │   ├── CodeBlock/
│   │   └── Sidebar/
│   ├── lib/
│   │   ├── api.ts
│   │   └── hooks/
│   └── package.json
│
├── vscode-extension/
│   ├── src/
│   │   ├── extension.ts
│   │   ├── commands/
│   │   ├── webview/
│   │   └── api-client.ts
│   ├── package.json
│   └── tsconfig.json
│
├── scripts/
│   ├── index-repos.ts
│   ├── generate-embeddings.ts
│   ├── evaluate.ts
│   └── setup.ts
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SETUP.md
│   ├── API.md
│   └── DEPLOYMENT.md
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 10. Dependências e Integrações

### Externas:
- ✅ Anthropic Claude API (modelo base)
- ✅ Pinecone (vector database)
- ✅ OpenAI Embeddings (ou alternativa)
- ✅ GitHub API (source control)
- ✅ Vercel (frontend deployment)
- ✅ Railway (backend deployment)

### Internas:
- ✅ Repositórios Java BBTS
- ✅ Repositórios Node.js BBTS
- ✅ Repositórios React/Angular BBTS
- ✅ Documentação arquitetural BBTS
- ✅ Sistema de monitoramento Dynatrace

---

## 11. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|--------|-----------|
| Indexação incompleta | Média | Alto | Validação manual + testes de cobertura |
| RAG com hallucinations | Alta | Médio | Fine-tuning + prompt engineering rigoroso |
| Latência alta em produção | Média | Médio | Caching + quantização + local fallback |
| Dados sensíveis expostos | Baixa | Crítico | Scan de tokens/keys + redação automática |
| Custo de API alto | Média | Médio | Rate limiting + batch processing + local tier |
| Adoption baixa | Média | Alto | Change management + training + incentivos |
| Drift do modelo | Média | Médio | Reindexação mensal + feedback loop |

---

## 12. Budget Estimado (MacBook-Optimized)

### Fase 1 (Semanas 1-4): MVP Local
```
Infrastructure (MacBook):
  - Ollama (free)                    $0
  - SQLite (free)                    $0
  - sqlite-vec (free)                $0
  Total:                             $0

Recursos:
  - 1 Senior Backend Eng (part-time) $5K
  - 1 Frontend Eng (part-time)       $3K
  - Total:                           $8K
  
TOTAL FASE 1:                        ~$8K
```

### Fase 2 (Semanas 5-8): Expansion Hybrid
```
Infrastructure:
  - Railway (small tier)             $50/mês
  - PostgreSQL (Railway)             $15/mês
  - GitHub Actions (free)            $0
  - Subtotal (4 semanas):            $260

MacBook (zero cost):
  - Continua com Ollama + SQLite     $0

Recursos:
  - 1 Full-time Backend Eng          $10K
  - 1 Full-time Frontend Eng         $10K
  - 1 ML Engineer (part-time)        $4K
  Total:                             $24K
  
TOTAL FASE 2:                        ~$24K
```

### Fase 3 (Semanas 9-12): Advanced Distributed
```
Infrastructure:
  - Railway (scaled tier)            $300/mês
  - PostgreSQL (Railway)             $15/mês
  - S3-like storage                  $20/mês
  - Subtotal (4 semanas):            $1,340

MacBook (still zero):
  - Continua operacional             $0

Recursos:
  - 1 Backend Eng (full-time)        $10K
  - 1 Frontend Eng (full-time)       $10K
  - 1 ML Engineer (full-time)        $10K
  - 1 DevOps Eng (part-time)         $3K
  Total:                             $33K
  
TOTAL FASE 3:                        ~$34K
```

**TOTAL PROJETO (12 semanas): ~$66K** (vs $75K anterior)

**Custos Mensais Recorrentes (Produção):**
- Infrastructure (Cloud): $400-600/mês
- MacBook (local): $0
- Observability: $200/mês
- **Total: ~$600-800/mês** (vs $2K anterior)

**Economia: ~$50K + $1,400/mês recorrente**

---

## 13. Success Criteria - Visão Executiva

### Semana 4 (MVP Gate)
- ✅ Chat funcional para 50+ queries de exemplo
- ✅ 70%+ satisfaction rate (manual testing)
- ✅ Pronto para demo com tech lead

### Semana 8 (Beta Gate)
- ✅ 50+ developers using
- ✅ VSCode extension instalável
- ✅ 75%+ satisfaction rate
- ✅ Documentação de uso completa

### Semana 12 (Production Launch)
- ✅ 100+ developers using
- ✅ Pass@1 ≥ 70%
- ✅ <2s latency P50
- ✅ Zero security incidents
- ✅ Analytics + feedback dashboard ativo

---

## 14. Próximos Passos

### Imediato (Esta semana)
- [ ] Review e aprovação do PRD
- [ ] Feedback de stakeholders
- [ ] Setup inicial de infraestrutura (Pinecone, Claude API keys)
- [ ] Preparar repositório base

### Semana 1
- [ ] Clonar principais repos BBTS
- [ ] Escrever script de chunking
- [ ] Setup do projeto Node.js/Express
- [ ] Primeiros testes com Claude API

### Semana 2-3
- [ ] Indexação e embeddings
- [ ] RAG pipeline
- [ ] Frontend básico

### Semana 4
- [ ] MVP deploy
- [ ] Beta user recruitment

---

## 15. Glossário

- **RAG:** Retrieval-Augmented Generation - aumenta LLM com informações externas
- **Embedding:** Representação vetorial de texto em espaço multidimensional
- **Chunk:** Pedaço de código ou documento (50-200 linhas) indexado
- **Fine-tuning:** Treino adicional de modelo com dados específicos
- **LoRA:** Low-Rank Adaptation - técnica eficiente de fine-tuning
- **LLM:** Large Language Model
- **Claude Code:** Ferramenta de Anthropic para executar código
- **Pinecone:** Vector database serverless
- **VSCode Extension:** Plugin para Visual Studio Code

---

---

## 17. Setup Rápido - MacBook M4

### Pré-requisitos
```bash
# Check MacBook specs
uname -a  # Should show arm64
sysctl hw.memsize  # Should show >= 24GB

# Ferramentas necessárias
brew install node@20 git
```

### Instalação Fase 1 (45 minutos)

```bash
# 1. Clone do repositório
git clone <bbts-code-llm-repo>
cd bbts-code-llm

# 2. Setup Node.js
nvm use 20
npm install

# 3. Setup Ollama + Code Llama
brew install ollama
ollama pull codellama:13b-instruct-q4_K_M  # 8-10 min, ~8.5GB

# 4. Setup SQLite + sqlite-vec
npm run setup:db

# 5. Indexar código (nightly)
npm run index:repos  # Roda em background

# 6. Start aplicação
npm run dev  # Abre em http://localhost:3000

# 7. Monitor memory
watch -n 5 'ps aux | grep -E "(ollama|node)" | head -5'
```

### Verificação

```bash
# Check Ollama
curl http://localhost:11434/api/tags

# Check database
sqlite3 ~/.bbts-llm/vectors.db ".tables"

# Check Node.js
ps aux | grep "node.*dev"

# Expected memory (all processes combined):
# Total: 11-13GB (out of 24GB)
# Swap: <200MB
# Fan: Occasional only
```

### Troubleshooting

```bash
# Se MacBook ficar lento:
# 1. Stop Ollama
killall ollama

# 2. Clear cache
rm -rf ~/.ollama/models/cache

# 3. Restart com modelo menor
ollama pull codellama:7b-instruct-q4_K_M
# Edit .env: MODEL=codellama:7b

# Se SQLite ficar lento:
sqlite3 ~/.bbts-llm/vectors.db "VACUUM;"

# Se Memory esgotasse:
# Fallback automático para Claude API
# Editar .env: CLAUDE_API_KEY=sk-...
```

### A. Exemplos de Queries MVP

```
Q: "Como implementar autenticação JWT em um controller Spring Boot?"
Q: "Gere um componente React para formulário de login com validação"
Q: "Qual é o padrão BBTS para implementar um serviço que consome RabbitMQ?"
Q: "Como configurar RBAC em Kubernetes para microsserviço?"
Q: "Explique o fluxo de consenso QBFT do Hyperledger Besu"
Q: "Refatore esse código Java para seguir padrão DDD"
Q: "Crie testes unitários para esse serviço Node.js"
```

### B. Roadmap Visual

```
2026:

Q1: [MVP (4w)] [Expansion (4w)] [Advanced (4w)]
           |
          Week 4              Week 8              Week 12
          DEMO ──────────── BETA LAUNCH ────── PROD LAUNCH
                    ↑                   ↑                ↑
              50 devs               100 devs          300 devs
```

---

**Documento PRD criado em Março 2026**  
**Última atualização: Março 10, 2026**  
**Próxima revisão: Após Phase 1 (Week 4)**