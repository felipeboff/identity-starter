# Próximos passos — resolve-hub como boilerplate de autenticação

O núcleo está pronto e testado de ponta a ponta:

- sign-up e sign-in com senha;
- OAuth com GitHub (testado na mão) e Google (falta o teste manual);
- refresh com rotação, reset de senha e verificação de e-mail;
- papéis e permissões e sessões;
- transações no Mongo;
- testes unit, integration e e2e a 100%, com a matriz de rota × status.

Abaixo está o que falta, em ordem de prioridade.

> Para rodar: `sudo systemctl enable --now docker`, `docker compose up -d --wait` e `pnpm dev`. O
> `MONGO_URL` precisa de `?replicaSet=rs0`.

---

## 1. Bugs vistos no teste manual

- [x] **`version` desatualizada nas respostas.** Sign-up, sign-in com senha, OAuth, refresh e
      verify-email montavam o output dentro do `transactions.run`, antes do `markAsSaved`
      (`afterCommit`). Agora a transação devolve as entidades e o output sai depois do commit
- [x] **Conta criada por OAuth nascia com `emailVerifiedAt: null`.** O `SignInWithOAuthUseCase`
      marca o e-mail como verificado ao registrar a conta
- [ ] **`pnpm format:check` falha com `EACCES` em `.data/mongo`.** O bind mount do compose cria
      pastas do root dentro do projeto. O ESLint já ignora `.data/**`, mas o Prettier varre a
      pasta antes de aplicar o `.prettierignore`. Trocar por um volume nomeado do Docker (os dados
      atuais de desenvolvimento se perdem)

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
- [x] **Convites:** quem tem papel `admin` ou a permissão `invite` convida (`POST /invitations`),
      lista (`GET /invitations`) e revoga (`DELETE /invitations/:invitationId`); sem `admin`, só
      dá o papel `user` e permissões que já tem. O convidado aceita em
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

- [ ] **Cache no middleware de autenticação:** hoje toda requisição autenticada lê sessão, conta e
      membership no Mongo (`AuthenticateUseCase`), e o `GET /me` relê as três
  - [ ] Medir antes: latência do `AuthenticateMiddleware` e leituras por requisição
  - [ ] Porta `ActorCache` no identity, implementada no Redis (um cache em memória não vê
        revogações feitas em outra instância) e com um fake em memória para os testes
  - [ ] Cachear só conta e membership por `accountId`, com TTL curto (30–60 s); a sessão continua
        sendo lida sempre, para uma revogação valer na hora
  - [ ] Invalidar explicitamente nos use cases que mudam conta ou membership: desativar,
        reativar, nome, papel e permissões, com um teste por caminho
  - [ ] Redis fora do ar: cair para a leitura no Mongo, sem derrubar a autenticação
- [ ] **Limpeza de expirados:** índice TTL no Mongo para sessões, resets de senha e verificações
      de e-mail vencidas
- [ ] **Eventos de segurança no log:** sign-in com sucesso e com falha, troca de senha, revogação de
      sessão e reuso de refresh token
- [ ] **Retry nas chamadas externas** (`GET` do GitHub e do Google) com backoff; avaliar `ky`
      por baixo do `FetchHttpClient` (complemento do ADR-004)
- [ ] **Sentry** para erros e **OpenTelemetry** para métricas e traces (_planned_)
- [ ] **Dockerfile da API** e serviço no `docker-compose.yml` (hoje o compose sobe Mongo e Redis)
- [-] **CI no GitHub Actions:** lint, typecheck e as quatro coberturas

## 5. Efeitos colaterais, eventos e jobs

Hoje os e-mails de reset e de verificação saem dentro da requisição: se a MailerSend falhar, o
usuário recebe `422` e não há nova tentativa. O `afterCommit` do `TransactionRunner` não basta,
porque se o processo cair entre o commit e o envio, o efeito se perde. Ordem combinada: primeiro o
outbox no próprio Mongo, e o transporte muda depois sem mexer nos use cases.

- [ ] **Outbox no Mongo** (sem broker)
  - [ ] Coleção `outbox` e uma porta para o use case registrar o efeito dentro da mesma transação
        (`{ type, payload, attempts, nextAttemptAt, processedAt }`)
  - [ ] Relay fora da requisição: lê os pendentes (polling, ou change streams, já que o replica
        set está ligado), executa o handler, faz retry com backoff e marca `processedAt`
  - [ ] Handlers idempotentes pelo id do evento (a entrega é "pelo menos uma vez")
  - [ ] Índice TTL para apagar os processados depois de alguns dias
  - [ ] Primeiro uso: e-mails de reset e de verificação saem do outbox, e a rota responde `204`
        mesmo com a MailerSend fora do ar
  - [ ] ADR da decisão: outbox no Mongo primeiro, transporte trocável depois
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
- [ ] **README de uso:** subir o projeto, criar os apps OAuth (GitHub e Google), configurar a
      MailerSend e a lista de rotas
- [ ] **Exemplo de front** (ou só as páginas): callback do OAuth, reset de senha e verificação de
      e-mail
- [ ] **Links quebrados:** os ADRs 002–004 e `.specs/features/{mongo-connection,transactions}`
      apontam para seções do `NEXT-STEPS.md` antigo (removido em `f248595`). Trocar por links para
      o commit
