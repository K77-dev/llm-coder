# Tarefa 2.0: LlamaServerManager

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Dependencias

- 1.0 (Migration SQLite — necessaria para persistir ultimo modelo ativo)

## Visao Geral

Criar o modulo `electron/llama-server-manager.ts` que gerencia o ciclo de vida completo do processo llama-server: spawn, health check, monitor, restart e kill. Inclui scan de diretorio para detectar modelos `.gguf` disponiveis.

<skills>
### Conformidade com Skills Padroes

- **Electron 39**: Modulo executado no main process
- **TypeScript 5**: Tipagem forte para state machine e interfaces
- **Pino 8**: Logging estruturado do processo
- **Jest 29 + ts-jest**: Testes unitarios com mock de child_process
</skills>

<requirements>
- RF01 — O app deve iniciar o llama-server automaticamente ao subir o Electron
- RF02 — O app deve encerrar o processo llama-server ao fechar o Electron (SIGTERM + SIGKILL fallback)
- RF03 — O app deve monitorar o processo e exibir status (iniciando, rodando, erro, parado)
- RF04 — O app deve logar stdout/stderr do llama-server no sistema de logs
- RF05 — Se o llama-server nao for encontrado no PATH, exibir mensagem clara
- RF06 — Caminho do executavel configuravel via LLAMA_SERVER_PATH com fallback para PATH
- RF07 — Ler diretorio LLAMA_MODELS_DIR e listar todos os arquivos .gguf
- RF08 — Lista de modelos atualizada ao abrir o app
- RF10 — Cada modelo exibe nome (sem extensao) e tamanho
- RF11 — Se diretorio nao existir ou estiver vazio, mensagem orientativa
</requirements>

## Subtarefas

- [ ] 2.1 Criar `electron/llama-server-manager.ts` com a classe `LlamaServerManager`
- [ ] 2.2 Implementar state machine com estados: `stopped`, `starting`, `running`, `error`
- [ ] 2.3 Implementar metodo `start(modelPath)`: spawn do processo com `child_process.spawn`, pipe de stdout/stderr para Pino, health check poll ate `GET /health` retornar 200 (timeout 60s)
- [ ] 2.4 Implementar metodo `stop()`: SIGTERM → aguarda 5s → SIGKILL como fallback
- [ ] 2.5 Implementar metodo `restart(modelPath)`: stop + start sequencial
- [ ] 2.6 Implementar `scanModels(dirPath)`: le diretorio, filtra `.gguf`, retorna `ModelInfo[]` com fileName, displayName, sizeBytes, path
- [ ] 2.7 Implementar deteccao de porta em uso no startup (processos orfaos)
- [ ] 2.8 Implementar callback `onStateChange` para emitir eventos de status
- [ ] 2.9 Escrever testes unitarios com mock de `child_process.spawn` e `fs`

## Detalhes de Implementacao

Consultar as secoes **Interfaces Principais** e **Pontos de Integracao > llama-server** da `techspec.md` para detalhes sobre:
- Interface `LlamaServerManager` e `LlamaServerState`
- Comando de spawn: `spawn(execPath, ['-m', modelPath, '--port', port])`
- Health check: `GET http://localhost:{port}/health`
- Shutdown: SIGTERM → 5s → SIGKILL

## Criterios de Sucesso

- `LlamaServerManager` gerencia o ciclo de vida completo do processo
- State machine transiciona corretamente entre estados
- `scanModels` detecta arquivos `.gguf` e retorna metadata
- Logs do llama-server sao capturados via Pino
- Processos orfaos sao detectados e tratados no startup
- Testes passam: `npm test --workspace=backend`
- Typecheck passa: `npm run typecheck --workspace=backend`

## Testes da Tarefa

- [ ] Teste unitario: `start()` spawna processo e transiciona para `starting` → `running`
- [ ] Teste unitario: `start()` com executavel inexistente transiciona para `error`
- [ ] Teste unitario: `stop()` envia SIGTERM e transiciona para `stopped`
- [ ] Teste unitario: `stop()` usa SIGKILL apos timeout de 5s
- [ ] Teste unitario: `restart()` faz stop + start sequencial
- [ ] Teste unitario: `scanModels()` lista arquivos .gguf com metadata
- [ ] Teste unitario: `scanModels()` retorna array vazio para diretorio inexistente
- [ ] Teste unitario: `scanModels()` ignora arquivos nao-.gguf
- [ ] Teste unitario: `onStateChange` emite eventos corretamente

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `electron/llama-server-manager.ts` — Novo (modulo principal)
- `electron/main.ts` — Referencia (entender lifecycle existente)
- `backend/src/utils/logger.ts` — Referencia (padrao de logging Pino)
