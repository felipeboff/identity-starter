import { useEffect, useRef, useState } from "preact/hooks";

import { ApiError } from "../api/api-error";
import { useAuth } from "../auth/auth-context";
import { AuthLayout } from "../layouts/auth-layout";
import { PROVIDER_LABELS } from "../i18n/labels";
import { appHistory, useLocation } from "../router/history";
import { errorMessages, identityApi, oauthFlow } from "../services";
import { LinkButton } from "../ui/button";
import { ResultPanel } from "../ui/feedback";
import { useToast } from "../ui/toast";

export type OAuthCallbackPageProps = {
  provider: string;
};

export const OAuthCallbackPage = (props: OAuthCallbackPageProps) => {
  const auth = useAuth();
  const toast = useToast();
  const search = useLocation().search;
  const [failure, setFailure] = useState<string | null>(null);
  const started = useRef(false);
  const providerName = oauthFlow.isProvider(props.provider)
    ? PROVIDER_LABELS[props.provider]
    : props.provider;

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const exchange = async () => {
      const grant = oauthFlow.complete({
        provider: props.provider,
        code: search.get("code"),
        state: search.get("state"),
        error: search.get("error"),
      });
      if (grant.intent === "link") {
        await identityApi.linkOAuth(grant);
        toast.show({
          tone: "success",
          title: `${providerName} conectado à sua conta`,
        });
        appHistory.replace("/security");
        return;
      }
      const result = await identityApi.signInWithOAuth(grant);
      await auth.startSession(result);
      toast.show({
        tone: "success",
        title: result.isNewAccount
          ? `Conta criada com ${providerName}`
          : `Bem-vindo de volta, ${result.account.name}`,
      });
      appHistory.replace("/");
    };

    exchange().catch((error: unknown) =>
      setFailure(
        error instanceof ApiError &&
          error.code === "identity.account_email_taken"
          ? `Já existe uma conta com o e-mail do ${providerName}. Entre com e-mail e senha (ou crie uma em “Esqueceu a senha?”) e conecte o ${providerName} em Segurança.`
          : errorMessages.describe(error),
      ),
    );
  }, []);

  return (
    <AuthLayout
      title={`Entrando com ${providerName}`}
      eyebrow="Login social"
      tagline="Sem senha nova para lembrar"
    >
      {failure ? (
        <ResultPanel
          tone="danger"
          title="Não deu para concluir"
          actions={
            <LinkButton
              href={auth.me ? "/security" : "/sign-in"}
              variant="primary"
            >
              Voltar
            </LinkButton>
          }
        >
          {failure}
        </ResultPanel>
      ) : (
        <ResultPanel
          tone="pending"
          title={`Conferindo a resposta do ${providerName}…`}
        />
      )}
    </AuthLayout>
  );
};
