# Próximos passos — identity-starter como boilerplate de autenticação

O núcleo está pronto e testado de ponta a ponta:

- sign-up e sign-in com senha;
- OAuth com GitHub (testado na mão) e Google (falta o teste manual);
- refresh com rotação, reset de senha e verificação de e-mail;
- papéis e permissões e sessões;
- transações no Mongo;
- testes unit, integration e e2e a 100%, com a matriz de rota × status.

Abaixo está o que falta, em ordem de prioridade.

> Para rodar: `sudo systemctl enable --now docker`, `docker compose up -d --wait` e `pnpm dev`. O
> `MONGO_URL` precisa de `?replicaSet=rs0`. O `SENTRY_DSN` é opcional; localmente, ele vem de um
> projeto criado no Bugsink (`http://localhost:8000`, `admin` / `admin`).
> Para subir a API em container: `docker compose --profile app up -d --wait`.

---

## 1. Bugs vistos no teste manual

- [x] **`version` desatualizada nas respostas.** Sign-up, sign-in com senha, OAuth, refresh e
      verify-email montavam o output dentro do `transactions.run`, antes do `markAsSaved`
      (`afterCommit`). Agora a transação devolve as entidades e o output sai depois do commit
- [x] **Conta criada por OAuth nascia com `emailVerifiedAt: null`.** O `SignInWithOAuthUseCase`
      marca o e-mail como verificado ao registrar a conta
- [x] **`pnpm format:check` falhava com `EACCES` em `.data/mongo`.** O bind mount do compose
      criava pastas do root dentro do projeto, e o Prettier varre a pasta antes de aplicar o
      `.prettierignore`. O Mongo agora guarda os dados no volume nomeado `mongo-data`

## 2. Segurança (antes de produção)

Contrato para o front em [docs/auth-front-end-contract.md](docs/auth-front-end-contract.md).

- [x] **Política de senha:** 12 a 128 caracteres em `sign-up`, `password-reset` e `me/password`
      (`application/password.policy.ts`); `sign-in` aceita até 128
  - [-] Opcional: recusar senha vazada (HaveIBeenPwned por k-anonimato, com timeout)
- [x] **Rate limiting** por IP no Redis (`RateLimitMiddleware` + `RateLimiter` sobre o port
      `Cache`/`RedisCache`, janela fixa com `INCR`/`PEXPIRE` em Lua) em sign-up, sign-in, oauth,
      refresh, pedido e troca de reset, verificação de e-mail, troca de senha e vínculo OAuth.
      Passou do limite: `429 shared.rate_limited` com `retryAfterSeconds`. Redis fora do ar deixa
      passar e loga `shared.rate_limiter_unavailable`; Redis fora no boot impede a subida
      (`shared.cache_unavailable`)
- [x] **Bloqueio por força bruta:** 5 senhas erradas por e-mail em 15 min bloqueiam o sign-in desse
      e-mail (`429 identity.sign_in_locked`), mesmo com a senha certa; acertar zera a contagem
      (`SignInThrottle`). Pedido de reset passa de 3 por e-mail por hora: responde `204` sem enviar
- [x] **Detecção de reuso do refresh token:** reusar um token já rotacionado revoga todas as
      sessões da conta (motivo `security`), loga `identity.refresh_token_reused` e responde
      `401 identity.refresh_token_reused`
- [x] **CORS:** `CORS_ORIGINS` (lista separada por vírgula, padrão `http://localhost:5173`); outras
      origens ficam sem cabeçalho CORS
- [x] **OAuth:** PKCE (`codeVerifier` opcional, 43–128 caracteres, enviado como `code_verifier`
      ao Google e ao GitHub); `state` gerado e conferido pelo front, documentado no contrato

## 3. Funcionalidades esperadas

- [x] **Várias sessões por conta, sem limite:** o sign-in não revoga mais a sessão anterior
      (`SessionIssuer.replace` e `SessionRepository.findByAccountId` removidos).
      `GET /me/sessions` marca a sessão atual (`current`), `DELETE /sessions/:sessionId` encerra
      uma e `DELETE /me/sessions` encerra todas menos a atual
- [x] **E-mail de verificação no sign-up:** o sign-up envia o link (`EmailVerificationIssuer`,
      compartilhado com `POST /me/email-verification`); se o envio falhar, o cadastro segue e
      loga `identity.verification_email_not_sent`
- [x] **Convites:** `invitation.create` convida (`POST /invitations`), `invitation.read` lista
      (`GET /invitations`) e `invitation.revoke` revoga (`DELETE /invitations/:invitationId`);
      quem convida só dá permissões que já tem (o papel é só um rótulo). O convidado aceita em
      `POST /auth/invitations/accept` com nome e senha, e a conta nasce verificada com a
      membership do convite. Convite vale 7 dias e um novo substitui o pendente
- [x] **Trocar e-mail:** `POST /me/email` com a senha atual manda um link de 1 hora para o e-mail
      novo; `POST /auth/email-change` confirma, troca o e-mail da conta e da credencial de senha,
      encerra todas as sessões (motivo `email_changed`) e avisa o e-mail antigo. Conta só com OAuth
      recebe `422 identity.email_change_needs_password`
- [-] Testar na mão o login com Google (conta precisa estar nos usuários de teste)

Decidido não fazer: apagar a conta de verdade (fica só desativar), MFA com TOTP e Apple como
provedor OAuth.

## 4. Operação

- [x] **Cache de conta e membership:** decorators `CachedAccountRepository` e
      `CachedMembershipRepository` na infraestrutura, sobre o `EntityCache` compartilhado (Redis,
      TTL de 30 s); os use cases não sabem que existe cache. A entidade fica uma vez, por id, e cada
      busca por outro campo (`email`, `accountId`) é um índice que aponta para o id e é conferido na
      leitura. Todo `save` grava a entrada nova depois do commit, e o Redis só aceita
      (`setIfNewer`, em Lua) se a `version` for maior que a guardada: uma leitura lenta que traz o
      snapshot de antes de uma revogação não o sobrescreve; dentro de uma transação a leitura vai
      direto ao Mongo; Redis fora do ar cai para o Mongo e loga `shared.cache_call_failed`. A
      sessão nunca entra no cache. Medido com Mongo e Redis em memória, sem rede: autenticação de 3
      para 1 leitura no Mongo (+3 `GET` no Redis), média de 0,90 para 0,55 ms
- [x] **`commandTimeout` no `RedisConnection`** (500 ms): um Redis que trava sem recusar a conexão
      falha o comando em vez de segurar a requisição
- [x] **Limpeza de expirados:** índice TTL (`expiresAt`, `expireAfterSeconds: 0`) em sessões,
      resets de senha e verificações de e-mail
  - [ ] Decidir se trocas de e-mail e convites também expiram do banco (hoje guardam histórico)
- [x] **Eventos de segurança no log:** `identity.signed_in` e `identity.sign_in_failed` (motivo é
      o código do erro, com IP e, no e-mail, o endereço tentado), `identity.password_changed`,
      `identity.password_reset` e `identity.sessions_revoked` (toda revogação passa pelo
      `SessionRevoker` e loga depois do commit; a rotação do refresh não loga). O reuso de refresh
      token já logava `identity.refresh_token_reused`
- [x] **Retry nas chamadas externas** (ADR-007): `ky` por baixo do `FetchHttpClient` repete um
      `GET` até 2 vezes em erro de rede ou `408`/`500`/`502`/`503`/`504`, com backoff exponencial
      e jitter total (até 300 ms e 600 ms), dentro do mesmo prazo de 10 s por chamada; `POST` sai
      uma vez só. Cada nova tentativa loga `shared.external_call_retried`
- [x] **Sentry** para erros (ADR-008): o `HttpErrorMapper` reporta todo erro inesperado (`500`) pela
      porta `ErrorReporter`, com `requestId`, `method`, `route`, `operation` e `accountId` como tags
      e sem IP, cabeçalhos, corpo ou e-mail; crashes do processo também vão. Desligado sem
      `SENTRY_DSN`; localmente o `docker compose up` sobe o Bugsink (compatível com o Sentry) em
      `http://localhost:8000`
  - [-] Criar o projeto no Sentry e definir `SENTRY_DSN` no ambiente de produção
- [-] **OpenTelemetry** para métricas e traces (_planned_)
- [x] **Dockerfile da API** e serviço no `docker-compose.yml` (ADR-009): `pnpm build` gera um bundle
      esbuild em `dist/main.js`; a imagem `node:24-slim` roda `node --enable-source-maps` como
      `node`, só com as dependências de produção; `docker compose --profile app up -d --wait` sobe a
      API junto com Mongo e Redis
- [-] **CI no GitHub Actions:** lint, typecheck e as quatro coberturas

## 5. Efeitos colaterais, eventos e jobs

Hoje os e-mails de reset e de verificação saem dentro da requisição: se a MailerSend falhar, o
usuário recebe `422` e não há nova tentativa. O `afterCommit` do `TransactionRunner` não basta,
porque se o processo cair entre o commit e o envio, o efeito se perde. Ordem combinada: primeiro o
outbox no próprio Mongo, e o transporte muda depois sem mexer nos use cases.

- [ ] **Outbox no Mongo** (sem broker)
  - [x] Coleção `outbox` e uma porta para o use case registrar o efeito dentro da mesma transação
        (`{ type, payload, attempts, nextAttemptAt, processedAt }`)
  - [x] Relay fora da requisição: lê os pendentes (polling, ou change streams, já que o replica
        set está ligado), executa o handler, faz retry com backoff e marca `processedAt`
  - [ ] Handlers idempotentes pelo id do evento (a entrega é "pelo menos uma vez")
  - [x] Índice TTL para apagar os processados depois de alguns dias
  - [x] Primeiro uso: e-mails de reset e de verificação saem do outbox, e a rota responde `204`
        mesmo com a MailerSend fora do ar
  - [x] ADR da decisão: outbox no Mongo primeiro, transporte trocável depois
- [ ] **BullMQ**, sobre o Redis que já está no compose
  - [ ] Repeatable jobs no lugar de cron, para tarefas agendadas sem gravação por trás (lembretes,
        relatórios)
  - [ ] Relay do outbox passa a enfileirar no BullMQ o trabalho pesado ou com atraso
- [ ] **RabbitMQ + outbox**, quando existir um segundo módulo que precise ouvir eventos
  - [ ] Relay publica os eventos de domínio (`identity.account_registered` e outros)
  - [ ] Consumidores idempotentes, com uma coleção `inbox` de eventos já processados, e fila de
        mensagens mortas

## 6. Para servir de boilerplate

- [ ] **OpenAPI/Swagger** gerado a partir das rotas (`HttpRoute` já tem método, path, status e
      `failures`)
- [x] **README de uso:** subir o projeto, criar os apps OAuth (GitHub e Google), configurar a
      MailerSend e a lista de rotas
- [ ] **Exemplo de front** (ou só as páginas): callback do OAuth, reset de senha e verificação de
      e-mail
- [x] **Links quebrados:** os ADRs 002–004 e `.specs/features/{mongo-connection,transactions}`
      apontam para o `NEXT-STEPS.md` antigo no commit `eccf67d`, o último antes da remoção em
      `f248595`
