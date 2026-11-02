import { PASSWORD_MAX_LENGTH } from "../api/identity.types";
import { useAuth } from "../auth/auth-context";
import { useMessages } from "../hooks/use-messages";
import { AuthLayout } from "../layouts/auth-layout";
import { OAuthButtons } from "../layouts/oauth-buttons";
import { appHistory, useLocation } from "../router/history";
import { Link } from "../router/router";
import { identityApi } from "../services";
import { Alert } from "../ui/feedback";
import { Field, Form, PasswordField, SubmitButton } from "../ui/form";

export const SignInPage = () => {
  const t = useMessages();
  const auth = useAuth();
  const location = useLocation();
  const next = appHistory.internalPath(location.search.get("next"));

  return (
    <AuthLayout title={t.signIn.title} subtitle={t.signIn.subtitle}>
      {auth.notice && <Alert tone="info">{auth.notice}</Alert>}
      <Form
        messages={{
          "identity.account_deleted": t.signIn.accountDeactivated,
          "identity.credential_account_mismatch": t.signIn.accountUnavailable,
          "identity.membership_not_found": t.signIn.accountUnavailable,
          "identity.membership_deleted": t.signIn.accountUnavailable,
        }}
        action={async (values) => {
          const result = await identityApi.signIn({
            email: values.text("email"),
            password: values.text("password"),
          });
          await auth.startSession(result);
          appHistory.replace(next);
        }}
      >
        <Field
          label={t.common.yourEmail}
          name="email"
          type="email"
          autocomplete="email"
          placeholder={t.common.emailPlaceholder}
          required
          autoFocus
        />
        <PasswordField
          label={t.common.password}
          name="password"
          autocomplete="current-password"
          maxLength={PASSWORD_MAX_LENGTH}
          required
          aside={
            <Link href="/forgot-password" class="text-link small">
              {t.signIn.forgotPassword}
            </Link>
          }
        />
        <SubmitButton block>{t.common.signIn}</SubmitButton>
      </Form>
      <OAuthButtons intent="sign-in" />
      <p class="auth-switch">
        {t.signIn.noAccount}{" "}
        <Link href="/sign-up" class="text-link">
          {t.common.signUp}
        </Link>
      </p>
    </AuthLayout>
  );
};
