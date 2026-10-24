# Próximos passos — rodar o resolve-hub de verdade

Hoje tudo funciona só em teste, com fakes em memória. Para subir um servidor que responda
`POST /auth/sign-up`, faltam os adapters reais, o adapter HTTP e o bootstrap. A ordem abaixo
coloca algo rodando o quanto antes e troca os fakes por implementações reais aos poucos.

> **Cobertura de 100%:** o `vitest.config.ts` mede todo `src/**/*.ts` e o pre-commit falha
> abaixo de 100%. Cada adapter novo precisa de teste (unitário ou de integração) no mesmo
> commit. Mantenha o `src/main.ts` mínimo e teste o que ele chama.

---

## 0. Decisões antes de começar

- [ ] **`AccessToken` assíncrono.** A porta é síncrona (`issue(): string`,
      `verify(): AccessTokenClaims | null`), mas o `jose` só tem API assíncrona. Escolha uma:
  - **Recomendado:** a porta passa a devolver `Promise`. Mudam o `SessionIssuer`, o
    `AuthenticateUseCase`, o `FakeAccessToken` e os specs que chamam `accessToken.issue`
    (o harness de teste também).
  - Alternativa: manter síncrono e assinar o HS256 na mão com `node:crypto` (`createHmac`), sem
    `jose`.
- [ ] **Consistência na escrita.** O sign-up salva account, credential e membership em três
      `save` separados; se o segundo falhar, sobra dado pela metade. Por enquanto é aceitável.
      Transação do Mongo (exige replica set) entra junto com o outbox.
- [ ] **Concorrência.** As entidades têm `version`. Decida se o `save` dos repositórios Mongo
      faz optimistic locking (`updateOne({ _id, version })` e erro se nada casar) já agora ou
      depois.

## 1. Dependências

- [x] `pnpm add express mongoose jose argon2 pino mailersend helmet cors`
- [x] `pnpm add -D @types/express @types/cors mongodb-memory-server supertest @types/supertest pino-pretty tsx`
- [x] `pnpm approve-builds argon2 esbuild mongodb-memory-server`
- [x] `pnpm remove arctic` (descontinuado; o OAuth vai com `fetch`)

## 2. Servidor rodando com os fakes (prova a cadeia inteira sem banco)

### 2.1 Config

- [x] `src/app/config.ts` — `loadEnv` valida com o `v` e `env` é lido uma vez na importação.
      Variáveis: `NODE_ENV` (`develop`), `PORT` (`3000`), `TRUST_PROXY` (`0`), `LOG_LEVEL`
      (`info`), `MONGO_URL`, `JWT_SECRET` (mín. 32 caracteres), `MAILERSEND_API_KEY`.
  - [x] `config.spec.ts`
  - [ ] Chaves de OAuth (`GOOGLE_CLIENT_ID`/`SECRET`, `GITHUB_CLIENT_ID`/`SECRET`) no passo 6
- [x] `.env.example` com todas as variáveis (sem valores reais) e `.env` no `.gitignore`

### 2.2 Adapters de borda

- [x] `src/shared/infrastructure/http/express-adapter.ts` — `toRouter(routes)`, `notFound()`
      (`404 shared.route_not_found`) e `errorHandler()` (JSON malformado →
      `400 shared.body_malformed`; o resto → `500` + log)
  - [x] `express-adapter.spec.ts` com `supertest`
- [x] Logger: porta `Logger` + eventos `defineLogEvent` + `PinoLogger`
      (`src/shared/infrastructure/logging/pino-logger.ts`) + `FakeLogger` para testes. Substitui o
      `ErrorReporter`.
  - [x] Contexto por requisição com `AsyncLocalStorage` (`AsyncLocalLogContext`) + `mixin` do
        Pino: `requestId` (aceita `x-request-id` seguro ou gera UUID, devolvido no header),
        `method`, `route` (template) e `accountId` (posto pelo `AuthenticateMiddleware`)
  - [x] Log `shared.request_completed` com `status` e `durationMs`, um por requisição

### 2.3 Bootstrap

- [x] `src/app/create-server.ts` — `helmet`, `cors`, `express.json`, `trust proxy`, API em
      `/api`, 404 e erros em problem details
  - [x] `create-server.spec.ts` com `supertest`
- [x] `src/app/start.ts` — monta logger, módulos (adapters em memória) e servidor, e escuta
      `env.PORT`; recusa `NODE_ENV=prod` (`shared.in_memory_adapters_in_production`)
  - [x] `start.spec.ts`
- [x] `src/main.ts` — `await start({ env, logDestination: process.stdout })` (fora da cobertura:
      só ligação)
- [x] `createInMemoryIdentityAdapters()` exportado pelo `identity.module.ts`
- [x] Scripts: `pnpm dev` (`tsx watch --env-file=.env`) e `pnpm start`
- [x] Testado na mão: sign-up 201 → sign-in 200 → `GET /me` 200 → sign-out 204 → `GET /me` 401;
      rota inexistente 404 e JSON malformado 400 em problem details

> Para rodar: `cp .env.example .env`, troque o `JWT_SECRET`, e `pnpm dev`. Cada login revoga a
> sessão anterior da conta (`SessionIssuer`), então use sempre o token do último sign-in. O
> `FakeClock` está parado em 2026-01-01, por isso todas as datas saem iguais.

## 3. Adapters triviais (sem pacote)

- [x] `src/shared/infrastructure/time/system-clock.ts` — `SystemClock`: `Clock` com `new Date()`
  - [x] spec
- [x] `src/shared/infrastructure/mongo/object-id-generator.ts` — `ObjectIdGenerator`:
      `IdGenerator` com `new Types.ObjectId().toHexString()`
  - [x] spec
- [x] `src/modules/identity/infrastructure/crypto-token-issuer.ts` — `CryptoTokenIssuer`:
      `randomBytes(32).toString("base64url")` + hash `sha256` em hex
  - [x] spec
  - [x] Usado pelo `createInMemoryIdentityAdapters()` (o app não pode importar a infraestrutura
        do identity, então a troca fica dentro do módulo)
- [x] Usar `SystemClock` e `ObjectIdGenerator` na `start` no lugar dos fakes

## 4. Persistência com Mongoose

- [ ] `src/shared/infrastructure/mongo/connect-mongo.ts` — conecta, desconecta, falha rápido
- [ ] Um repositório por porta em `src/modules/identity/infrastructure/persistence/`:
  - [ ] `mongo-account.repository.ts` — índice único em `email`
  - [ ] `mongo-credential.repository.ts` — índice único em `(provider, subject)`; índice em
        `accountId` e em `email`
  - [ ] `mongo-membership.repository.ts` — índice único em `accountId`
  - [ ] `mongo-session.repository.ts` — índice único em `tokenHash`; índice em `accountId`
  - [ ] `mongo-password-reset.repository.ts` — índice único em `tokenHash`; índice em `accountId`
  - [ ] `mongo-email-verification.repository.ts` — índice único em `tokenHash`; índice em
        `accountId`
- [ ] Regras dos repositórios:
  - schema e model só dentro do adapter; o domínio nunca vê `Document` nem `ObjectId`
  - `save(entity)` grava `entity.toSnapshot()` com upsert por `_id`
  - `find*` devolve `Entity.restore(...)` a partir do que veio do banco, ou `null`
  - `_id` como `ObjectId` no banco, string hex no domínio (converte no adapter)
- [ ] Testes de integração com `mongodb-memory-server`, um por repositório (salva, busca,
      índice único recusa duplicado)
  - [ ] Separar a config se ficarem lentos (`vitest.integration.config.ts`), sem perder os 100%
- [ ] `docker-compose.yml` com o Mongo para rodar localmente

## 5. Segurança: hash e JWT

- [ ] `src/modules/identity/infrastructure/argon2-password-hasher.ts` — `PasswordHasher` com
      `argon2id`
  - [ ] spec (hash ≠ senha, verify aceita a certa e recusa a errada)
- [ ] `src/modules/identity/infrastructure/jose-access-token.ts` — `AccessToken` com HS256,
      `JWT_SECRET` da config, expiração curta (ex.: 15 min), claims `sub = accountId` e `sid`
  - [ ] spec (emite e verifica, recusa token expirado, adulterado ou assinado com outro segredo)
- [ ] Trocar os fakes por esses no `main.ts`

## 6. E-mail e OAuth

- [ ] `src/modules/identity/infrastructure/log-identity-mailer.ts` — `IdentityMailer` que só loga
      o link (para desenvolvimento)
- [ ] `src/modules/identity/infrastructure/mailersend-identity-mailer.ts` — MailerSend, com
      timeout
- [ ] `src/modules/identity/infrastructure/fetch-oauth-gateway.ts` — `OAuthGateway` com `fetch`:
  - Google: `POST https://oauth2.googleapis.com/token` → `GET https://openidconnect.googleapis.com/v1/userinfo`
  - GitHub: `POST https://github.com/login/oauth/access_token` → `GET https://api.github.com/user`
    (e `/user/emails` quando o e-mail vier `null`)
  - Timeout em toda chamada; resposta inesperada vira `AppError`, nunca `Error`
- [ ] specs com o `fetch` mockado

## 7. Fechamento

- [ ] `pnpm lint`, `pnpm typecheck` e `pnpm test:coverage` verdes
- [ ] Subir com `docker compose up -d` + `pnpm dev` e fazer o fluxo: sign-up → sign-in →
      `GET /me` → refresh → sign-out
- [ ] Atualizar o `STACK.md` (tirar o _planned_ do que entrou) e registrar em ADR qualquer
      decisão da seção 0 que mudou contrato
