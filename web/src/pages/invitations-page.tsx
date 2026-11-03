import { ALL_ROLES, Permission, type Role } from "../api/identity.types";
import { useAuth, useMe } from "../auth/auth-context";
import { useMessages } from "../hooks/use-messages";
import { useResource } from "../hooks/use-resource";
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

export const InvitationsPage = () => {
  const t = useMessages();
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
  const roleOptions = ALL_ROLES.map((role) => ({
    value: role,
    label: t.roles[role],
  }));
  const grantable = me.membership.permissions.map((permission) => ({
    value: permission,
    label: t.permissionLabel(permission),
  }));

  return (
    <AppLayout>
      <PageHeader
        title={t.invitations.title}
        description={t.invitations.description}
      />

      {!canCreate && !canRead && (
        <Card>
          <EmptyState icon={<LockIcon />} title={t.invitations.noAccess}>
            {t.invitations.noAccessDescription(
              t.permissions["identity.invitation.create"],
              t.permissions["identity.invitation.read"],
            )}
          </EmptyState>
        </Card>
      )}

      <div class="stack">
        {canCreate && (
          <Card
            title={t.invitations.newInvitation}
            description={t.invitations.newInvitationDescription}
          >
            <Form
              resetOnSuccess
              action={async (values) => {
                const output = await identityApi.inviteMember({
                  email: values.text("email"),
                  role: values.text("role") as Role,
                  permissions: values.list("permissions"),
                });
                toast.show({
                  tone: "success",
                  title: t.invitations.sent,
                  description: t.invitations.sentDescription(
                    output.invitation.email,
                  ),
                });
                await invitations.reload();
              }}
            >
              <div class="form-row">
                <Field
                  label={t.common.email}
                  name="email"
                  type="email"
                  placeholder={t.invitations.emailPlaceholder}
                  required
                />
                <SelectField
                  label={t.invitations.role}
                  name="role"
                  options={roleOptions}
                  defaultValue="user"
                />
              </div>
              <CheckboxGroup
                label={t.invitations.permissions}
                name="permissions"
                options={grantable}
                emptyMessage={t.invitations.nothingToGrant}
              />
              <div class="form-actions">
                <SubmitButton icon={<MailIcon />}>
                  {t.invitations.send}
                </SubmitButton>
              </div>
            </Form>
          </Card>
        )}

        {canRead && (
          <Card
            title={t.invitations.pending}
            description={t.invitations.pendingDescription}
          >
            {invitations.error ? (
              <Alert tone="danger">
                {errorMessages.describe(invitations.error)}
              </Alert>
            ) : !invitations.data ? (
              <Skeleton lines={3} />
            ) : invitations.data.invitations.length === 0 ? (
              <EmptyState icon={<MailIcon />} title={t.invitations.empty}>
                {t.invitations.emptyDescription}
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
                        <Badge tone="primary">{t.roles[invitation.role]}</Badge>
                      </div>
                      <span class="list-row-meta">
                        {t.invitations.meta(
                          invitation.permissions.length,
                          format.relative(invitation.createdAt),
                          format.relative(invitation.expiresAt),
                        )}
                      </span>
                    </div>
                    {canRevoke && (
                      <ConfirmButton
                        size="sm"
                        variant="ghost"
                        icon={<TrashIcon />}
                        title={t.invitations.revokeTitle}
                        description={t.invitations.revokeDescription(
                          invitation.email,
                        )}
                        confirmLabel={t.invitations.revoke}
                        onConfirm={async () => {
                          await identityApi.revokeInvitation(invitation.id);
                          toast.show({
                            tone: "success",
                            title: t.invitations.revoked,
                          });
                          await invitations.reload();
                        }}
                      >
                        {t.invitations.revoke}
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
