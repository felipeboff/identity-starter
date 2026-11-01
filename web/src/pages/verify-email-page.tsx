import { useEffect, useRef, useState } from "preact/hooks";

import { useAuth } from "../auth/auth-context";
import { useAction } from "../hooks/use-action";
import { AuthLayout } from "../layouts/auth-layout";
import { useLocation } from "../router/history";
import { errorMessages, identityApi } from "../services";
import { Button, LinkButton } from "../ui/button";
import { ResultPanel } from "../ui/feedback";
import { useToast } from "../ui/toast";

type Verification =
  | { status: "pending" }
  | { status: "verified"; email: string }
  | { status: "failed"; message: string };

export const VerifyEmailPage = () => {
  const auth = useAuth();
  const toast = useToast();
  const token = useLocation().search.get("token");
  const [verification, setVerification] = useState<Verification>({
    status: "pending",
  });
  const started = useRef(false);

  const resend = useAction(async () => {
    await identityApi.requestEmailVerification();
    toast.show({
      tone: "success",
      title: "Link novo enviado",
      description: auth.me?.account.email,
    });
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) {
      setVerification({
        status: "failed",
        message: "O link veio sem o token. Abra-o como chegou no e-mail.",
      });
      return;
    }
    identityApi
      .verifyEmail({ token })
      .then(async (output) => {
        setVerification({ status: "verified", email: output.account.email });
        if (auth.me) await auth.reloadMe();
      })
      .catch((error: unknown) =>
        setVerification({
          status: "failed",
          message: errorMessages.describe(error),
        }),
      );
  }, [token]);

  const home = auth.me ? (
    <LinkButton href="/" variant="primary">
      Ir para o painel
    </LinkButton>
  ) : (
    <LinkButton href="/sign-in" variant="primary">
      Entrar
    </LinkButton>
  );

  return (
    <AuthLayout
      title="Confirmação de e-mail"
      eyebrow="Um passo a mais"
      tagline="E-mail confirmado deixa sua conta mais fácil de recuperar"
    >
      {verification.status === "pending" && (
        <ResultPanel tone="pending" title="Confirmando seu e-mail…" />
      )}
      {verification.status === "verified" && (
        <ResultPanel tone="success" title="E-mail confirmado" actions={home}>
          {verification.email} está confirmado. Tudo certo por aqui.
        </ResultPanel>
      )}
      {verification.status === "failed" && (
        <ResultPanel
          tone="danger"
          title="Não deu para confirmar"
          actions={
            <>
              {auth.me && (
                <Button
                  variant="primary"
                  pending={resend.pending}
                  onClick={() => void resend.run()}
                >
                  Enviar link novo
                </Button>
              )}
              {home}
            </>
          }
        >
          {verification.message}
        </ResultPanel>
      )}
    </AuthLayout>
  );
};
