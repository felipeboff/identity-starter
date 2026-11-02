import { useState } from "preact/hooks";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../api/identity.types";
import { useAuth, useMe } from "../auth/auth-context";
import { useAction } from "../hooks/use-action";
import { useMessages } from "../hooks/use-messages";
import { useResource } from "../hooks/use-resource";
import { AppLayout, PageHeader } from "../layouts/app-layout";
import { identityApi } from "../services";
import { Button } from "../ui/button";
import { ConfirmButton } from "../ui/confirm-button";
import { Alert, Badge, Card, Skeleton } from "../ui/feedback";
import { Field, Form, PasswordField, SubmitButton } from "../ui/form";
import { useToast } from "../ui/toast";

export const ProfilePage = () => {
  const t = useMessages();
  const auth = useAuth();
  const me = useMe();
  const toast = useToast();
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const credentials = useResource(() => identityApi.listCredentials(), []);
  const [passwordLinkSent, setPasswordLinkSent] = useState(false);
  const sendPasswordLink = useAction(async () => {
    await identityApi.requestPasswordReset({ email: me.account.email });
    setPasswordLinkSent(true);
  });
  const hasPassword = credentials.data
    ? credentials.data.credentials.some(
        (credential) => credential.provider === "email",
      )
    : null;

  return (
    <AppLayout>
      <PageHeader title={t.profile.title} description={t.profile.description} />

      <div class="stack">
        <Card
          title={t.profile.personal}
          description={t.profile.personalDescription}
        >
          <Form
            class="form-inline"
            action={async (values) => {
              await identityApi.updateName({ name: values.text("name") });
              await auth.reloadMe();
              toast.show({ tone: "success", title: t.profile.nameUpdated });
            }}
          >
            <Field
              label={t.profile.name}
              name="name"
              autocomplete="name"
              defaultValue={me.account.name}
              required
            />
            <SubmitButton>{t.common.save}</SubmitButton>
          </Form>
        </Card>

        <Card
          title={t.common.email}
          description={t.profile.emailDescription}
          actions={
            <Badge tone={me.account.emailVerifiedAt ? "success" : "warning"}>
              {me.account.emailVerifiedAt
                ? t.profile.confirmed
                : t.profile.notConfirmed}
            </Badge>
          }
        >
          <p class="current-value">
            {t.profile.current} <strong>{me.account.email}</strong>
          </p>
          {pendingEmail && (
            <Alert tone="success" title={t.common.linkSent}>
              {t.profile.emailChangeSent(pendingEmail)}
            </Alert>
          )}
          {hasPassword === false ? (
            <Alert tone="info" title={t.profile.setPasswordFirst}>
              {t.profile.setPasswordFirstDescription}
            </Alert>
          ) : (
            <Form
              resetOnSuccess
              action={async (values) => {
                const newEmail = values.text("newEmail");
                await identityApi.requestEmailChange({
                  newEmail,
                  password: values.text("password"),
                });
                setPendingEmail(newEmail);
              }}
            >
              <div class="form-row">
                <Field
                  label={t.profile.newEmail}
                  name="newEmail"
                  type="email"
                  autocomplete="email"
                  required
                />
                <PasswordField
                  label={t.common.currentPassword}
                  name="password"
                  autocomplete="current-password"
                  maxLength={PASSWORD_MAX_LENGTH}
                  required
                />
              </div>
              <div class="form-actions">
                <SubmitButton>{t.profile.sendChangeLink}</SubmitButton>
              </div>
            </Form>
          )}
        </Card>

        <Card
          title={
            hasPassword === false ? t.profile.setPassword : t.common.password
          }
          description={
            hasPassword === false
              ? t.profile.setPasswordDescription(me.account.email)
              : t.profile.changePasswordDescription
          }
        >
          {hasPassword === null ? (
            <Skeleton lines={2} />
          ) : !hasPassword ? (
            <>
              {passwordLinkSent ? (
                <Alert tone="success" title={t.common.linkSent}>
                  {t.profile.passwordLinkSent(me.account.email)}
                </Alert>
              ) : (
                <div class="button-row">
                  <Button
                    variant="primary"
                    pending={sendPasswordLink.pending}
                    onClick={() => void sendPasswordLink.run()}
                  >
                    {t.profile.sendPasswordLink}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Form
              action={async (values) => {
                await identityApi.changePassword({
                  oldPassword: values.text("oldPassword"),
                  newPassword: values.text("newPassword"),
                });
                auth.endLocally(t.profile.passwordChanged);
              }}
            >
              <div class="form-row">
                <PasswordField
                  label={t.common.currentPassword}
                  name="oldPassword"
                  autocomplete="current-password"
                  maxLength={PASSWORD_MAX_LENGTH}
                  required
                />
                <PasswordField
                  label={t.common.newPassword}
                  name="newPassword"
                  autocomplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  hint={t.common.passwordLength(
                    PASSWORD_MIN_LENGTH,
                    PASSWORD_MAX_LENGTH,
                  )}
                  required
                />
              </div>
              <div class="form-actions">
                <SubmitButton>{t.profile.changePassword}</SubmitButton>
              </div>
            </Form>
          )}
        </Card>

        <Card
          tone="danger"
          title={t.profile.deactivate}
          description={t.profile.deactivateDescription}
          actions={
            <ConfirmButton
              variant="danger-soft"
              title={t.profile.deactivateTitle}
              description={t.profile.deactivateConfirmDescription}
              confirmLabel={t.profile.deactivateConfirm}
              onConfirm={async () => {
                await identityApi.deactivateAccount(me.account.id);
                auth.endLocally(t.common.accountDeactivated);
              }}
            >
              {t.profile.deactivate}
            </ConfirmButton>
          }
        />
      </div>
    </AppLayout>
  );
};
