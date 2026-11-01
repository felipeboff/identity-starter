import { useState } from "preact/hooks";

import { AuthLayout } from "../layouts/auth-layout";
import { Link } from "../router/router";
import { identityApi } from "../services";
import { LinkButton } from "../ui/button";
import { ResultPanel } from "../ui/feedback";
import { Field, Form, SubmitButton } from "../ui/form";
import { ArrowLeftIcon } from "../ui/icons";

export const ForgotPasswordPage = () => {
  const [sentTo, setSentTo] = useState<string | null>(null);

  return (
    <AuthLayout
      title="Esqueceu a senha?"
      subtitle="Digite o e-mail da sua conta e enviamos um link para criar uma senha nova. Vale também para contas criadas com GitHub ou Google."
      eyebrow="Acontece com todo mundo"
      tagline="Recupere o acesso sem perder nada do que é seu"
    >
      {sentTo ? (
        <ResultPanel
          tone="success"
          title="Confira sua caixa de entrada"
          actions={
            <LinkButton
              href="/sign-in"
              variant="secondary"
              icon={<ArrowLeftIcon />}
            >
              Voltar para o login
            </LinkButton>
          }
        >
          Se houver uma conta com {sentTo}, o link chega em instantes. Ele vale
          por pouco tempo e só pode ser usado uma vez.
        </ResultPanel>
      ) : (
        <>
          <Form
            action={async (values) => {
              const email = values.text("email");
              await identityApi.requestPasswordReset({ email });
              setSentTo(email);
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
            <SubmitButton block>Enviar link</SubmitButton>
          </Form>
          <p class="auth-switch">
            Lembrou?{" "}
            <Link href="/sign-in" class="text-link">
              Voltar para o login
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
};
