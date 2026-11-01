import { useState } from "preact/hooks";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../api/identity.types";
import { useAuth } from "../auth/auth-context";
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
  const auth = useAuth();
  const token = useLocation().search.get("token");
  const [done, setDone] = useState(false);

  return (
    <AuthLayout
      title="Criar uma senha nova"
      subtitle="Depois de trocar, todas as sessões abertas são encerradas por segurança."
      eyebrow="Quase lá"
      tagline="Uma senha nova e todas as sessões antigas encerradas"
    >
      {!token ? (
        <ResultPanel
          tone="danger"
          title="Link incompleto"
          actions={
            <LinkButton href="/forgot-password" variant="primary">
              Pedir um link novo
            </LinkButton>
          }
        >
          Abra o link exatamente como chegou no e-mail.
        </ResultPanel>
      ) : done ? (
        <ResultPanel
          tone="success"
          title="Senha salva"
          actions={
            <LinkButton href="/sign-in" variant="primary">
              Entrar
            </LinkButton>
          }
        >
          Use a senha nova para entrar com o seu e-mail. As sessões abertas
          foram encerradas.
        </ResultPanel>
      ) : (
        <Form
          action={async (values) => {
            const newPassword = values.text("newPassword");
            if (newPassword !== values.text("confirmPassword")) {
              throw new FieldErrorsThrown({
                confirmPassword: "As senhas não conferem.",
              });
            }
            await identityApi.resetPassword({ token, newPassword });
            if (auth.me)
              auth.endLocally("Senha salva. Entre com a senha nova.");
            setDone(true);
          }}
        >
          <PasswordField
            label="Senha nova"
            name="newPassword"
            autocomplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            hint={`De ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caracteres.`}
            required
            autoFocus
          />
          <PasswordField
            label="Repita a senha nova"
            name="confirmPassword"
            autocomplete="new-password"
            required
          />
          <SubmitButton block>Redefinir senha</SubmitButton>
        </Form>
      )}
    </AuthLayout>
  );
};
