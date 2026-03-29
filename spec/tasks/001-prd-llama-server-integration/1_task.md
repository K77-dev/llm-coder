# Tarefa 1.0: Migration SQLite + configuracao .env

<critical>Ler os arquivos de prd.md e techspec.md desta pasta, se voce nao ler esses arquivos sua tarefa sera invalidada</critical>

## Dependencias

- Nenhuma

## Visao Geral

Criar a base de dados para persistencia das configuracoes do llama-server (ultimo modelo ativo) e documentar as novas variaveis de ambiente no `.env.example`. Esta e a tarefa fundacional — todas as demais dependem da persistencia aqui criada.

<skills>
### Conformidade com Skills Padroes

- **better-sqlite3**: Persistencia de configuracoes na tabela `llama_settings`
- **TypeScript 5**: Tipagem forte para os metodos CRUD
- **Jest 29 + ts-jest**: Testes unitarios da persistencia
</skills>

<requirements>
- RF16 — O ultimo modelo utilizado deve ser persistido e carregado automaticamente na proxima abertura do app
- RF17 — Variavel `LLAMA_MODELS_DIR` — caminho do diretorio contendo os modelos `.gguf`
- RF18 — Variavel `LLAMA_SERVER_PORT` — porta do llama-server (default: `8080`)
- RF19 — Variavel `LLAMA_SERVER_PATH` — caminho do executavel (default: `llama-server` no PATH)
- RF20 — As variaveis devem ser documentadas no `.env.example`
</requirements>

## Subtarefas

- [ ] 1.1 Criar migration `backend/src/db/migrations/add-llama-settings.ts` com tabela `llama_settings` (key TEXT PK, value TEXT NOT NULL, updated_at TEXT NOT NULL)
- [ ] 1.2 Adicionar metodos no `backend/src/db/sqlite-client.ts`: `getLlamaSetting(key)`, `setLlamaSetting(key, value)`, `deleteLlamaSetting(key)`
- [ ] 1.3 Executar a migration no fluxo de inicializacao do banco (garantir que roda ao subir o backend)
- [ ] 1.4 Adicionar variaveis `LLAMA_MODELS_DIR`, `LLAMA_SERVER_PORT`, `LLAMA_SERVER_PATH` ao `.env.example` com comentarios explicativos
- [ ] 1.5 Escrever testes unitarios para os metodos CRUD de `llama_settings`

## Detalhes de Implementacao

Consultar a secao **Modelos de Dados** da `techspec.md` para a estrutura da tabela `llama_settings`.

A tabela usa um schema key-value simples. A chave inicial e `last_active_model` que armazena o nome do arquivo `.gguf` do ultimo modelo utilizado.

## Criterios de Sucesso

- Tabela `llama_settings` criada corretamente ao inicializar o banco
- Metodos `getLlamaSetting`/`setLlamaSetting`/`deleteLlamaSetting` funcionam corretamente
- `.env.example` documenta as 3 novas variaveis com valores default
- Testes passam: `npm test --workspace=backend`
- Typecheck passa: `npm run typecheck --workspace=backend`

## Testes da Tarefa

- [ ] Teste unitario: `setLlamaSetting` persiste valor corretamente
- [ ] Teste unitario: `getLlamaSetting` retorna valor persistido
- [ ] Teste unitario: `getLlamaSetting` retorna null para chave inexistente
- [ ] Teste unitario: `setLlamaSetting` atualiza valor existente (upsert)
- [ ] Teste unitario: `deleteLlamaSetting` remove a chave
- [ ] Teste integracao: migration cria tabela no banco

<critical>SEMPRE CRIE E EXECUTE OS TESTES DA TAREFA ANTES DE CONSIDERA-LA FINALIZADA</critical>

## Arquivos relevantes

- `backend/src/db/sqlite-client.ts` — Modificar (adicionar metodos CRUD)
- `backend/src/db/migrations/add-llama-settings.ts` — Novo (migration)
- `.env.example` — Modificar (adicionar variaveis LLAMA_*)
