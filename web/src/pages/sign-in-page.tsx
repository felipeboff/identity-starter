import { PASSWORD_MAX_LENGTH } from "../api/identity.types";
import { useAuth } from "../auth/auth-context";
import { AuthLayout } from "../layouts/auth-layout";
import { OAuthButtons } from "../layouts/oauth-buttons";
import { appHistory, useLocation } from "../router/history";
import { Link } from "../router/router";
import { identityApi } from "../services";
import { Alert } from "../ui/feedback";
import { Field, Form, PasswordField, SubmitButton } from "../ui/form";

export const SignInPage = () => {
  const auth = useAuth();
  const location = useLocation();
  const next = appHistory.internalPath(location.search.get("next"));

  return (
    <AuthLayout
      title="Entrar na sua conta"
      subtitle="Acesse suas sessões, convites e permissões de qualquer lugar, com tudo organizado em um só lugar."
    >
      {auth.notice && <Alert tone="info">{auth.notice}</Alert>}
      <Form
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
          label="Seu e-mail"
          name="email"
          type="email"
          autocomplete="email"
          placeholder="voce@exemplo.com"
          required
          autoFocus
        />
        <PasswordField
          label="Senha"
          name="password"
          autocomplete="current-password"
          maxLength={PASSWORD_MAX_LENGTH}
          required
          aside={
            <Link href="/forgot-password" class="text-link small">
              Esqueceu a senha?
            </Link>
          }
        />
        <SubmitButton block>Entrar</SubmitButton>
      </Form>
      <OAuthButtons intent="sign-in" />
      <p class="auth-switch">
        Ainda não tem conta?{" "}
        <Link href="/sign-up" class="text-link">
          Criar conta
        </Link>
      </p>
    </AuthLayout>
  );
};
