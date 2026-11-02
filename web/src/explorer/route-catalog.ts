import type { HttpMethod } from "../api/api-client";
import {
  ALL_OAUTH_PROVIDERS,
  type Me,
  type Permission,
} from "../api/identity.types";

export type TemplateContext = {
  me: Me | null;
  refreshToken: string | null;
  sample: string;
};

export type QueryParam = {
  name: string;
  hint: string;
};

export type CatalogRoute = {
  id: string;
  group: string;
  method: HttpMethod;
  path: string;
  summary: string;
  note?: string;
  authenticated: boolean;
  permission?: Permission;
  status: number;
  failures: readonly number[];
  rateLimit?: string;
  body?: (context: TemplateContext) => unknown;
  query?: readonly QueryParam[];
};

export const PROVIDER_OPTIONS = ALL_OAUTH_PROVIDERS;

const SAMPLE_PASSWORD = "uma frase longa e segura";

export const ROUTE_CATALOG: readonly CatalogRoute[] = [
  {
    id: "sign-up",
    group: "Autenticação",
    method: "POST",
    path: "/auth/sign-up",
    summary: "Cria uma conta com e-mail e senha e já abre uma sessão.",
    note: "Os tokens da resposta viram a sessão deste navegador.",
    authenticated: false,
    status: 201,
    failures: [400, 429],
    rateLimit: "10 por hora por IP",
    body: (context) => ({
      name: "Ada Lovelace",
      email: `ada.${context.sample}@example.com`,
      password: SAMPLE_PASSWORD,
    }),
  },
  {
    id: "sign-in",
    group: "Autenticação",
    method: "POST",
    path: "/auth/sign-in",
    summary: "Entra com e-mail e senha.",
    note: "Sem a senha certa, toda falha é o mesmo 401, exista a conta ou não. 5 falhas para o mesmo e-mail em 15 min bloqueiam o login dele.",
    authenticated: false,
    status: 200,
    failures: [400, 401, 404, 409, 422, 429],
    rateLimit: "20 a cada 15 min por IP",
    body: (context) => ({
      email: context.me?.account.email ?? "ada@example.com",
      password: SAMPLE_PASSWORD,
    }),
  },
  {
    id: "oauth-sign-in",
    group: "Autenticação",
    method: "POST",
    path: "/auth/oauth/:provider",
    summary: "Troca o código do GitHub ou do Google por uma sessão.",
    note: "O código vem do redirecionamento do provedor e só vale uma vez.",
    authenticated: false,
    status: 200,
    failures: [400, 401, 403, 404, 422, 429],
    rateLimit: "20 a cada 15 min por IP",
    body: () => ({ code: "", codeVerifier: "" }),
  },
  {
    id: "refresh",
    group: "Autenticação",
    method: "POST",
    path: "/auth/refresh",
    summary: "Gira o refresh token e devolve um par novo.",
    note: "Reenviar um token já girado é tratado como roubo: todas as sessões caem.",
    authenticated: false,
    status: 200,
    failures: [400, 401, 404, 422, 429],
    rateLimit: "60 a cada 15 min por IP",
    body: (context) => ({ refreshToken: context.refreshToken ?? "" }),
  },
  {
    id: "password-reset-request",
    group: "Autenticação",
    method: "POST",
    path: "/auth/password-reset/request",
    summary: "Envia um link de redefinição de senha.",
    note: "Vale para qualquer conta ativa, com ou sem senha: o link cria a senha se não houver. Responde 204 mesmo sem conta.",
    authenticated: false,
    status: 204,
    failures: [400, 422, 429],
    rateLimit: "5 por hora por IP; 3 por hora por e-mail",
    body: (context) => ({
      email: context.me?.account.email ?? "ada@example.com",
    }),
  },
  {
    id: "password-reset",
    group: "Autenticação",
    method: "POST",
    path: "/auth/password-reset",
    summary: "Troca a senha com o token do e-mail e encerra as sessões.",
    authenticated: false,
    status: 204,
    failures: [400, 401, 404, 422, 429],
    rateLimit: "10 por hora por IP",
    body: () => ({ token: "", newPassword: SAMPLE_PASSWORD }),
  },
  {
    id: "email-verification",
    group: "Autenticação",
    method: "POST",
    path: "/auth/email-verification",
    summary: "Confirma o e-mail com o token do link.",
    authenticated: false,
    status: 200,
    failures: [400, 401, 404, 422, 429],
    rateLimit: "10 por hora por IP",
    body: () => ({ token: "" }),
  },
  {
    id: "accept-invitation",
    group: "Autenticação",
    method: "POST",
    path: "/auth/invitations/accept",
    summary: "Aceita um convite, cria a conta já confirmada e entra.",
    authenticated: false,
    status: 201,
    failures: [400, 401, 422, 429],
    rateLimit: "10 por hora por IP",
    body: () => ({
      token: "",
      name: "Grace Hopper",
      password: SAMPLE_PASSWORD,
    }),
  },
  {
    id: "confirm-email-change",
    group: "Autenticação",
    method: "POST",
    path: "/auth/email-change",
    summary: "Confirma a troca de e-mail e encerra todas as sessões.",
    authenticated: false,
    status: 200,
    failures: [400, 401, 422, 429],
    rateLimit: "10 por hora por IP",
    body: () => ({ token: "" }),
  },
  {
    id: "sign-out",
    group: "Minha conta",
    method: "POST",
    path: "/auth/sign-out",
    summary: "Encerra a sessão atual.",
    authenticated: true,
    status: 204,
    failures: [401],
  },
  {
    id: "get-me",
    group: "Minha conta",
    method: "GET",
    path: "/me",
    summary: "Devolve a conta e a membership de quem chama.",
    authenticated: true,
    status: 200,
    failures: [401],
  },
  {
    id: "update-name",
    group: "Minha conta",
    method: "PATCH",
    path: "/me",
    summary: "Atualiza o nome.",
    authenticated: true,
    status: 200,
    failures: [400, 401],
    body: (context) => ({ name: context.me?.account.name ?? "Ada Lovelace" }),
  },
  {
    id: "change-password",
    group: "Minha conta",
    method: "PUT",
    path: "/me/password",
    summary: "Troca a senha e encerra todas as sessões, inclusive esta.",
    authenticated: true,
    status: 204,
    failures: [400, 401, 404, 422, 429],
    rateLimit: "10 por hora por IP",
    body: () => ({
      oldPassword: SAMPLE_PASSWORD,
      newPassword: `${SAMPLE_PASSWORD} nova`,
    }),
  },
  {
    id: "request-email-change",
    group: "Minha conta",
    method: "POST",
    path: "/me/email",
    summary: "Manda um link de 1 hora para o e-mail novo.",
    authenticated: true,
    status: 204,
    failures: [400, 401, 422, 429],
    rateLimit: "5 por hora por IP",
    body: (context) => ({
      newEmail: `novo.${context.sample}@example.com`,
      password: SAMPLE_PASSWORD,
    }),
  },
  {
    id: "request-email-verification",
    group: "Minha conta",
    method: "POST",
    path: "/me/email-verification",
    summary: "Reenvia o link de confirmação de e-mail.",
    authenticated: true,
    status: 204,
    failures: [401, 409, 422, 429],
    rateLimit: "5 por hora por IP",
  },
  {
    id: "list-credentials",
    group: "Minha conta",
    method: "GET",
    path: "/me/credentials",
    summary: "Formas de entrar da conta: senha e provedores conectados.",
    authenticated: true,
    status: 200,
    failures: [401],
  },
  {
    id: "link-oauth",
    group: "Minha conta",
    method: "POST",
    path: "/me/oauth/:provider",
    summary: "Liga um provedor à conta com um código do OAuth.",
    authenticated: true,
    status: 201,
    failures: [400, 401, 403, 409, 422, 429],
    rateLimit: "20 a cada 15 min por IP",
    body: () => ({ code: "", codeVerifier: "" }),
  },
  {
    id: "unlink-oauth",
    group: "Minha conta",
    method: "DELETE",
    path: "/me/oauth/:provider",
    summary: "Desliga um provedor; recusa se for o único jeito de entrar.",
    authenticated: true,
    status: 204,
    failures: [400, 401, 404, 422],
  },
  {
    id: "list-sessions",
    group: "Sessões",
    method: "GET",
    path: "/me/sessions",
    summary: "Sessões ativas, da mais nova para a mais antiga.",
    authenticated: true,
    status: 200,
    failures: [401],
  },
  {
    id: "revoke-other-sessions",
    group: "Sessões",
    method: "DELETE",
    path: "/me/sessions",
    summary: "Encerra todas as sessões menos a atual.",
    authenticated: true,
    status: 200,
    failures: [401],
  },
  {
    id: "revoke-session",
    group: "Sessões",
    method: "DELETE",
    path: "/sessions/:sessionId",
    summary: "Encerra uma sessão.",
    note: "Na sessão de outra pessoa exige a permissão.",
    authenticated: true,
    permission: "session.revoke",
    status: 204,
    failures: [400, 401, 403, 404],
  },
  {
    id: "list-account-sessions",
    group: "Sessões",
    method: "GET",
    path: "/accounts/:accountId/sessions",
    summary: "Sessões ativas de uma conta, da mais nova para a mais antiga.",
    note: "Na conta de outra pessoa exige a permissão.",
    authenticated: true,
    permission: "session.read",
    status: 200,
    failures: [400, 401, 403],
  },
  {
    id: "revoke-all-sessions",
    group: "Sessões",
    method: "DELETE",
    path: "/accounts/:accountId/sessions",
    summary: "Encerra todas as sessões de uma conta.",
    note: "Na conta de outra pessoa exige a permissão.",
    authenticated: true,
    permission: "session.revoke_all",
    status: 200,
    failures: [400, 401, 403],
  },
  {
    id: "deactivate-account",
    group: "Contas e membros",
    method: "POST",
    path: "/accounts/:accountId/deactivate",
    summary: "Desativa a conta e encerra as sessões dela.",
    note: "Na conta de outra pessoa exige a permissão.",
    authenticated: true,
    permission: "account.deactivate",
    status: 204,
    failures: [400, 401, 403, 404],
  },
  {
    id: "reactivate-account",
    group: "Contas e membros",
    method: "POST",
    path: "/accounts/:accountId/reactivate",
    summary: "Reativa uma conta desativada.",
    authenticated: true,
    permission: "account.reactivate",
    status: 200,
    failures: [400, 401, 403, 404],
  },
  {
    id: "list-members",
    group: "Contas e membros",
    method: "GET",
    path: "/members",
    summary: "Membros com conta e membership, página por página.",
    note: "Mande o nextCursor da resposta em cursor para a próxima página.",
    authenticated: true,
    permission: "member.read",
    status: 200,
    failures: [400, 401, 403],
    query: [
      { name: "limit", hint: "1 a 100; padrão 50" },
      { name: "cursor", hint: "nextCursor da página anterior" },
    ],
  },
  {
    id: "update-member-role",
    group: "Contas e membros",
    method: "PUT",
    path: "/members/:accountId/role",
    summary: "Troca o papel de um membro. Ninguém troca o próprio.",
    authenticated: true,
    permission: "member.role.update",
    status: 200,
    failures: [400, 401, 403, 404, 422],
    body: () => ({ role: "admin" }),
  },
  {
    id: "update-member-permissions",
    group: "Contas e membros",
    method: "PUT",
    path: "/members/:accountId/permissions",
    summary: "Substitui as permissões de um membro. Só concede o que você tem.",
    authenticated: true,
    permission: "member.permissions.update",
    status: 200,
    failures: [400, 401, 403, 404, 422],
    body: (context) => ({
      permissions: context.me?.membership.permissions ?? [],
    }),
  },
  {
    id: "invite-member",
    group: "Convites",
    method: "POST",
    path: "/invitations",
    summary: "Convida por e-mail com papel e permissões.",
    authenticated: true,
    permission: "invitation.create",
    status: 201,
    failures: [400, 401, 403, 422],
    body: (context) => ({
      email: `convidado.${context.sample}@example.com`,
      role: "user",
      permissions: [],
    }),
  },
  {
    id: "list-invitations",
    group: "Convites",
    method: "GET",
    path: "/invitations",
    summary: "Convites pendentes, do mais novo para o mais antigo.",
    authenticated: true,
    permission: "invitation.read",
    status: 200,
    failures: [401, 403],
  },
  {
    id: "revoke-invitation",
    group: "Convites",
    method: "DELETE",
    path: "/invitations/:invitationId",
    summary: "Revoga um convite pendente; um aceito responde 422.",
    authenticated: true,
    permission: "invitation.revoke",
    status: 204,
    failures: [400, 401, 403, 404, 422],
  },
];

export class RoutePath {
  paramsOf(path: string): string[] {
    return path
      .split("/")
      .filter((segment) => segment.startsWith(":"))
      .map((segment) => segment.slice(1));
  }

  withQuery(path: string, values: Record<string, string>): string {
    const query = new URLSearchParams(
      Object.entries(values).filter(([, value]) => value !== ""),
    );
    return query.size > 0 ? `${path}?${query}` : path;
  }

  fill(path: string, values: Record<string, string>): string {
    return path.replace(/:([A-Za-z]+)/g, (_, name: string) =>
      encodeURIComponent(values[name] ?? ""),
    );
  }
}
