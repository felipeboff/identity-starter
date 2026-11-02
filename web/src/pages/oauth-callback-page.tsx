import { useEffect, useRef, useState } from "preact/hooks";

import { ApiError } from "../api/api-error";
import { useAuth } from "../auth/auth-context";
import { useMessages } from "../hooks/use-messages";
import { AuthLayout } from "../layouts/auth-layout";
import { PROVIDER_LABELS } from "../i18n/labels";
import { appHistory, useLocation } from "../router/history";
import {
  errorMessages,
  identityApi,
  localeStore,
  oauthFlow,
} from "../services";
import { LinkButton } from "../ui/button";
import { ResultPanel } from "../ui/feedback";
import { useToast } from "../ui/toast";

export type OAuthCallbackPageProps = {
  provider: string;
};

export const OAuthCallbackPage = (props: OAuthCallbackPageProps) => {
  const t = useMessages();
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
          title: localeStore.messages.oauthCallback.linked(providerName),
        });
        appHistory.replace("/security");
        return;
      }
      const result = await identityApi.signInWithOAuth(grant);
      await auth.startSession(result);
      const messages = localeStore.messages.oauthCallback;
      toast.show({
        tone: "success",
        title: result.isNewAccount
          ? messages.created(providerName)
          : messages.welcomeBack(result.account.name),
      });
      appHistory.replace("/");
    };

    exchange().catch((error: unknown) =>
      setFailure(
        error instanceof ApiError &&
          error.code === "identity.account_email_taken"
          ? localeStore.messages.oauthCallback.emailTaken(providerName)
          : errorMessages.describe(error),
      ),
    );
  }, []);

  return (
    <AuthLayout
      title={t.oauthCallback.title(providerName)}
      eyebrow={t.oauthCallback.eyebrow}
      tagline={t.oauthCallback.tagline}
    >
      {failure ? (
        <ResultPanel
          tone="danger"
          title={t.oauthCallback.failed}
          actions={
            <LinkButton
              href={auth.me ? "/security" : "/sign-in"}
              variant="primary"
            >
              {t.common.back}
            </LinkButton>
          }
        >
          {failure}
        </ResultPanel>
      ) : (
        <ResultPanel
          tone="pending"
          title={t.oauthCallback.checking(providerName)}
        />
      )}
    </AuthLayout>
  );
};
