import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../api/identity.types";
import { useAuth } from "../auth/auth-context";
import { AuthLayout } from "../layouts/auth-layout";
import { appHistory, useLocation } from "../router/history";
import { identityApi } from "../services";
import { LinkButton } from "../ui/button";
import { Alert, ResultPanel } from "../ui/feedback";
import { Field, Form, PasswordField, SubmitButton } from "../ui/form";
import { useToast } from "../ui/toast";

export const AcceptInvitationPage = () => {
  const auth = useAuth();
  const toast = useToast();
  const token = useLocation().search.get("token");

  return (
    <AuthLayout
      title="Você foi convidado"
      subtitle="Escolha seu nome e uma senha. A conta já nasce confirmada, com o papel e as permissões do convite."
      eyebrow="Bem-vindo ao time"
      tagline="Seu acesso já vem pronto, do jeito que o time preparou"
    >
      {!token ? (
        <ResultPanel
          tone="danger"
          title="Convite incompleto"
          actions={
            <LinkButton href="/sign-in" variant="primary">
              Ir para o login
            </LinkButton>
          }
        >
          Abra o link exatamente como chegou no e-mail.
        </ResultPanel>
      ) : (
        <>
          {auth.me && (
            <Alert tone="info">
              Você está conectado como {auth.me.account.email}. Aceitar o
              convite cria outra conta e troca a sessão deste navegador.
            </Alert>
          )}
          <Form
            action={async (values) => {
              const result = await identityApi.acceptInvitation({
                token,
                name: values.text("name"),
                password: values.text("password"),
              });
              await auth.startSession(result);
              toast.show({
                tone: "success",
                title: `Bem-vindo, ${result.account.name}!`,
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
            <PasswordField
              label="Senha"
              name="password"
              autocomplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              hint={`De ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caracteres.`}
              required
            />
            <SubmitButton block>Aceitar convite</SubmitButton>
          </Form>
        </>
      )}
    </AuthLayout>
  );
};
