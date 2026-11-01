import {
  ALL_ROLES,
  Permission,
  type Permission as PermissionCode,
  type Role,
} from "../api/identity.types";
import { useAuth, useMe } from "../auth/auth-context";
import { useResource } from "../hooks/use-resource";
import { PERMISSION_LABELS, ROLE_LABELS } from "../i18n/labels";
import { AppLayout, PageHeader } from "../layouts/app-layout";
import { errorMessages, format, identityApi } from "../services";
import { ConfirmButton } from "../ui/confirm-button";
import { Alert, Badge, Card, EmptyState, Skeleton } from "../ui/feedback";
import {
  CheckboxGroup,
  Field,
  Form,
  SelectField,
  SubmitButton,
} from "../ui/form";
import { LockIcon, MailIcon, TrashIcon } from "../ui/icons";
import { useToast } from "../ui/toast";

const ROLE_OPTIONS = ALL_ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}));

export const InvitationsPage = () => {
  const auth = useAuth();
  const me = useMe();
  const toast = useToast();
  const canCreate = auth.can(Permission.INVITATION_CREATE);
  const canRead = auth.can(Permission.INVITATION_READ);
  const canRevoke = auth.can(Permission.INVITATION_REVOKE);
  const invitations = useResource(
    () =>
      canRead
        ? identityApi.listInvitations()
        : Promise.resolve({ invitations: [] }),
    [canRead],
  );
  const grantable = me.membership.permissions.map((permission) => ({
    value: permission,
    label: PERMISSION_LABELS[permission],
  }));

  return (
    <AppLayout>
      <PageHeader
        title="Convites"
        description="Convide pessoas por e-mail. O link vale 7 dias e um convite novo para o mesmo e-mail substitui o pendente."
      />

      {!canCreate && !canRead && (
        <Card>
          <EmptyState icon={<LockIcon />} title="Sem acesso aos convites">
            Peça a alguém do time as permissões “
            {PERMISSION_LABELS["invitation.create"]}” ou “
            {PERMISSION_LABELS["invitation.read"]}”.
          </EmptyState>
        </Card>
      )}

      <div class="stack">
        {canCreate && (
          <Card
            title="Novo convite"
            description="Você só pode conceder permissões que já tem. O papel é só um rótulo."
          >
            <Form
              resetOnSuccess
              action={async (values) => {
                const output = await identityApi.inviteMember({
                  email: values.text("email"),
                  role: values.text("role") as Role,
                  permissions: values.list("permissions") as PermissionCode[],
                });
                toast.show({
                  tone: "success",
                  title: "Convite enviado",
                  description: `${output.invitation.email} recebeu um link válido por 7 dias.`,
                });
                await invitations.reload();
              }}
            >
              <div class="form-row">
                <Field
                  label="E-mail"
                  name="email"
                  type="email"
                  placeholder="pessoa@exemplo.com"
                  required
                />
                <SelectField
                  label="Papel"
                  name="role"
                  options={ROLE_OPTIONS}
                  defaultValue="user"
                />
              </div>
              <CheckboxGroup
                label="Permissões"
                name="permissions"
                options={grantable}
                emptyMessage="Você não tem permissões para repassar."
              />
              <div class="form-actions">
                <SubmitButton icon={<MailIcon />}>Enviar convite</SubmitButton>
              </div>
            </Form>
          </Card>
        )}

        {canRead && (
          <Card
            title="Pendentes"
            description="Do mais novo para o mais antigo."
          >
            {invitations.error ? (
              <Alert tone="danger">
                {errorMessages.describe(invitations.error)}
              </Alert>
            ) : !invitations.data ? (
              <Skeleton lines={3} />
            ) : invitations.data.invitations.length === 0 ? (
              <EmptyState icon={<MailIcon />} title="Nenhum convite pendente">
                Os convites enviados aparecem aqui até serem aceitos, revogados
                ou expirarem.
              </EmptyState>
            ) : (
              <ul class="list">
                {invitations.data.invitations.map((invitation) => (
                  <li key={invitation.id} class="list-row">
                    <span class="icon-tile">
                      <MailIcon />
                    </span>
                    <div class="list-row-main">
                      <div class="list-row-title">
                        <strong>{invitation.email}</strong>
                        <Badge tone="primary">
                          {ROLE_LABELS[invitation.role]}
                        </Badge>
                      </div>
                      <span class="list-row-meta">
                        {invitation.permissions.length} permissões · enviado{" "}
                        {format.relative(invitation.createdAt)} · expira{" "}
                        {format.relative(invitation.expiresAt)}
                      </span>
                    </div>
                    {canRevoke && (
                      <ConfirmButton
                        size="sm"
                        variant="ghost"
                        icon={<TrashIcon />}
                        title="Revogar este convite?"
                        description={`O link enviado para ${invitation.email} deixa de funcionar.`}
                        confirmLabel="Revogar"
                        onConfirm={async () => {
                          await identityApi.revokeInvitation(invitation.id);
                          toast.show({
                            tone: "success",
                            title: "Convite revogado",
                          });
                          await invitations.reload();
                        }}
                      >
                        Revogar
                      </ConfirmButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </AppLayout>
  );
};
