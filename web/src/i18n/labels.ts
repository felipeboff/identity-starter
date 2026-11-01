import type { OAuthProvider, Permission, Role } from "../api/identity.types";

export const PERMISSION_LABELS: Record<Permission, string> = {
  "invitation.create": "Criar convites",
  "invitation.read": "Ver convites",
  "invitation.revoke": "Revogar convites",
  "account.reactivate": "Reativar contas",
  "account.deactivate": "Desativar contas",
  "session.read": "Ver sessões de outros",
  "session.revoke": "Encerrar sessões de outros",
  "session.revoke_all": "Encerrar todas as sessões de uma conta",
  "member.read": "Ver membros",
  "member.role.update": "Alterar papel de membros",
  "member.permissions.update": "Alterar permissões de membros",
};

export const ROLE_LABELS: Record<Role, string> = {
  user: "Usuário",
  admin: "Administrador",
};

export const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  github: "GitHub",
  google: "Google",
};
