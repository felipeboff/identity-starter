import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../api/identity.types";
import { ApiError } from "../api/api-error";
import { useAuth } from "../auth/auth-context";
import { AuthLayout } from "../layouts/auth-layout";
import { OAuthButtons } from "../layouts/oauth-buttons";
import { appHistory } from "../router/history";
import { Link } from "../router/router";
import { identityApi } from "../services";
import { Field, Form, PasswordField, SubmitButton } from "../ui/form";
import { useToast } from "../ui/toast";

const EMAIL_TAKEN = new Set([
  "identity.account_email_taken",
  "identity.credential_email_taken",
]);

export const SignUpPage = () => {
  const auth = useAuth();
  const toast = useToast();

  return (
    <AuthLayout
      title="Criar uma conta"
      subtitle="Comece em segundos. Enviamos um link para confirmar seu e-mail logo depois do cadastro."
      eyebrow="Leva menos de um minuto"
      tagline="Uma conta para acessar tudo, com sessões sob seu controle"
    >
      <Form
        action={async (values) => {
          const result = await identityApi
            .signUp({
              name: values.text("name"),
              email: values.text("email"),
              password: values.text("password"),
            })
            .catch((error: unknown) => {
              if (error instanceof ApiError && EMAIL_TAKEN.has(error.code)) {
                throw new Error(
                  "Esse e-mail já tem conta. Entre com GitHub ou Google, ou crie uma senha em “Esqueceu a senha?” na tela de login.",
                );
              }
              throw error;
            });
          await auth.startSession(result);
          toast.show({
            tone: "success",
            title: "Conta criada",
            description: `Enviamos um link de confirmação para ${result.account.email}.`,
          });
          appHistory.replace("/");
        }}
      >
        <Field
          label="Seu nome"
          name="name"
          autocomplete="name"
          placeholder="Ada Lovelace"
          required
          autoFocus
        />
        <Field
          label="Seu e-mail"
          name="email"
          type="email"
          autocomplete="email"
          placeholder="voce@exemplo.com"
          required
        />
        <PasswordField
          label="Senha"
          name="password"
          autocomplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          hint={`De ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caracteres. Uma frase longa funciona bem.`}
          required
        />
        <SubmitButton block>Começar</SubmitButton>
      </Form>
      <OAuthButtons intent="sign-in" />
      <p class="auth-switch">
        Já tem uma conta?{" "}
        <Link href="/sign-in" class="text-link">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
};
