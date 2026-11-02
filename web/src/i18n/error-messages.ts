import { ApiError, type Violation } from "../api/api-error";

export type MessageOverrides = Readonly<Record<string, string>>;

const MESSAGES: Record<string, string> = {
  "client.network_failed":
    "Não foi possível falar com a API. Confira se ela está no ar.",
  "client.unexpected_response": "A API respondeu algo inesperado.",
  "shared.input_invalid": "Confira os campos destacados.",
  "shared.body_malformed": "A requisição saiu malformada.",
  "shared.rate_limited": "Muitas tentativas. Tente de novo em {seconds} s.",
  "shared.permission_missing": "Você não tem permissão para fazer isso.",
  "shared.version_conflict":
    "Os dados mudaram enquanto você editava. Recarregue e tente de novo.",
  "shared.already_exists": "Esse registro já existe.",
  "shared.route_not_found": "Essa rota não existe na API.",
  "shared.internal": "Algo deu errado do nosso lado. Tente de novo.",
  "identity.invalid_credentials": "E-mail ou senha incorretos.",
  "identity.sign_in_locked":
    "Muitas tentativas para esse e-mail. Tente de novo em {seconds} s.",
  "identity.account_email_taken": "Já existe uma conta com esse e-mail.",
  "identity.credential_email_taken": "Já existe uma conta com esse e-mail.",
  "identity.account_deleted": "Esta conta está desativada.",
  "identity.account_not_found": "Conta não encontrada.",
  "identity.account_email_already_verified": "Seu e-mail já está confirmado.",
  "identity.credential_not_found":
    "Não há um login com esse provedor nesta conta.",
  "identity.credential_password_not_set":
    "Esta conta entra só com GitHub ou Google.",
  "identity.email_change_needs_password":
    "Contas que entram só com GitHub ou Google não podem trocar o e-mail.",
  "identity.email_change_expired": "O link de troca de e-mail expirou.",
  "identity.email_change_already_consumed":
    "Esse link de troca de e-mail já foi usado.",
  "identity.email_change_deleted": "Essa troca de e-mail foi cancelada.",
  "identity.invalid_email_change_token": "Link de troca de e-mail inválido.",
  "identity.email_verification_expired":
    "O link de confirmação expirou. Peça um novo.",
  "identity.email_verification_already_consumed":
    "Esse link de confirmação já foi usado.",
  "identity.email_verification_deleted":
    "Esse link de confirmação foi cancelado.",
  "identity.invalid_email_verification_token": "Link de confirmação inválido.",
  "identity.email_delivery_failed":
    "Não conseguimos enviar o e-mail agora. Tente de novo em instantes.",
  "identity.forbidden": "Você não pode fazer isso com essa conta.",
  "identity.invalid_access_token":
    "Token de acesso ausente, inválido ou expirado.",
  "identity.invalid_refresh_token": "Sua sessão expirou. Entre de novo.",
  "identity.refresh_token_reused":
    "Por segurança, todas as sessões foram encerradas. Entre de novo.",
  "identity.session_expired": "Sua sessão expirou. Entre de novo.",
  "identity.session_revoked": "Esta sessão foi encerrada. Entre de novo.",
  "identity.session_not_found": "Sessão não encontrada.",
  "identity.invalid_invitation_token": "Este convite é inválido.",
  "identity.invitation_expired": "Este convite expirou. Peça um novo.",
  "identity.invitation_already_accepted": "Este convite já foi aceito.",
  "identity.invitation_revoked": "Este convite foi revogado.",
  "identity.invitation_not_found": "Convite não encontrado.",
  "identity.invalid_password_reset_token": "Link de redefinição inválido.",
  "identity.password_reset_expired":
    "O link de redefinição expirou. Peça um novo.",
  "identity.password_reset_already_consumed":
    "Esse link de redefinição já foi usado.",
  "identity.password_reset_deleted": "Esse link de redefinição foi cancelado.",
  "identity.last_credential_cannot_be_removed":
    "Esse é o único jeito de entrar na sua conta; não dá para desconectar.",
  "identity.membership_not_found": "Membro não encontrado.",
  "identity.membership_deleted": "Este membro foi removido.",
  "identity.invalid_membership_permissions": "Permissões inválidas.",
  "identity.invalid_membership_role": "Papel inválido.",
  "identity.oauth_code_rejected":
    "O provedor recusou o código. Tente entrar de novo.",
  "identity.oauth_email_not_verified":
    "Seu e-mail no provedor ainda não foi verificado.",
  "identity.oauth_linked_to_another_account":
    "Essa conta do provedor já está ligada a outro usuário.",
  "identity.oauth_provider_already_linked": "Esse provedor já está conectado.",
  "identity.oauth_provider_failed": "O provedor não respondeu. Tente de novo.",
  "identity.oauth_provider_not_supported": "Provedor não suportado.",
};

const REASONS: Record<string, string> = {
  required: "Preencha este campo.",
  format: "Formato inválido.",
  pattern: "Formato inválido.",
  enum: "Valor não permitido.",
  type: "Valor inválido.",
  minLength: "Muito curto.",
  maxLength: "Muito longo.",
};

const PASSWORD_LENGTH = "Use de 12 a 128 caracteres.";

export class ErrorMessages {
  describe(error: unknown, overrides: MessageOverrides = {}): string {
    if (!(error instanceof ApiError)) {
      return error instanceof Error
        ? error.message
        : "Algo deu errado. Tente de novo.";
    }
    const template =
      overrides[error.code] ?? MESSAGES[error.code] ?? error.problem.title;
    return template.replace("{seconds}", String(error.retryAfterSeconds ?? 60));
  }

  describeCode(code: string): string {
    return MESSAGES[code] ?? code;
  }

  describeViolation(violation: Violation): string {
    const isLength =
      violation.reason === "minLength" || violation.reason === "maxLength";
    if (isLength && /password/i.test(violation.field)) return PASSWORD_LENGTH;
    return REASONS[violation.reason] ?? "Valor inválido.";
  }
}
