import { useState } from "preact/hooks";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../api/identity.types";
import { useAuth } from "../auth/auth-context";
import { useMessages } from "../hooks/use-messages";
import { AuthLayout } from "../layouts/auth-layout";
import { useLocation } from "../router/history";
import { LinkButton } from "../ui/button";
import { ResultPanel } from "../ui/feedback";
import {
  FieldErrorsThrown,
  Form,
  PasswordField,
  SubmitButton,
} from "../ui/form";
import { identityApi } from "../services";

export const ResetPasswordPage = () => {
  const t = useMessages();
  const auth = useAuth();
  const token = useLocation().search.get("token");
  const [done, setDone] = useState(false);

  return (
    <AuthLayout
      title={t.resetPassword.title}
      subtitle={t.resetPassword.subtitle}
      eyebrow={t.resetPassword.eyebrow}
      tagline={t.resetPassword.tagline}
    >
      {!token ? (
        <ResultPanel
          tone="danger"
          title={t.common.incompleteLink}
          actions={
            <LinkButton href="/forgot-password" variant="primary">
              {t.resetPassword.requestNewLink}
            </LinkButton>
          }
        >
          {t.common.openLinkAsReceived}
        </ResultPanel>
      ) : done ? (
        <ResultPanel
          tone="success"
          title={t.resetPassword.saved}
          actions={
            <LinkButton href="/sign-in" variant="primary">
              {t.common.signIn}
            </LinkButton>
          }
        >
          {t.resetPassword.savedDescription}
        </ResultPanel>
      ) : (
        <Form
          action={async (values) => {
            const newPassword = values.text("newPassword");
            if (newPassword !== values.text("confirmPassword")) {
              throw new FieldErrorsThrown({
                confirmPassword: t.resetPassword.mismatch,
              });
            }
            await identityApi.resetPassword({ token, newPassword });
            if (auth.me) auth.endLocally(t.resetPassword.savedNotice);
            setDone(true);
          }}
        >
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
            autoFocus
          />
          <PasswordField
            label={t.resetPassword.repeatPassword}
            name="confirmPassword"
            autocomplete="new-password"
            required
          />
          <SubmitButton block>{t.resetPassword.submit}</SubmitButton>
        </Form>
      )}
    </AuthLayout>
  );
};
