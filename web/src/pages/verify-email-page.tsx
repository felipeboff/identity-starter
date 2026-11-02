import { useEffect, useRef, useState } from "preact/hooks";

import { useAuth } from "../auth/auth-context";
import { useAction } from "../hooks/use-action";
import { useMessages } from "../hooks/use-messages";
import { AuthLayout } from "../layouts/auth-layout";
import { useLocation } from "../router/history";
import { errorMessages, identityApi, localeStore } from "../services";
import { Button, LinkButton } from "../ui/button";
import { ResultPanel } from "../ui/feedback";
import { useToast } from "../ui/toast";

type Verification =
  | { status: "pending" }
  | { status: "verified"; email: string }
  | { status: "failed"; message: string };

export const VerifyEmailPage = () => {
  const t = useMessages();
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
      title: t.verifyEmail.newLinkSent,
      description: auth.me?.account.email,
    });
  });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) {
      setVerification({
        status: "failed",
        message: localeStore.messages.verifyEmail.missingToken,
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
      {t.verifyEmail.goToDashboard}
    </LinkButton>
  ) : (
    <LinkButton href="/sign-in" variant="primary">
      {t.common.signIn}
    </LinkButton>
  );

  return (
    <AuthLayout
      title={t.verifyEmail.title}
      eyebrow={t.verifyEmail.eyebrow}
      tagline={t.verifyEmail.tagline}
    >
      {verification.status === "pending" && (
        <ResultPanel tone="pending" title={t.verifyEmail.confirming} />
      )}
      {verification.status === "verified" && (
        <ResultPanel
          tone="success"
          title={t.verifyEmail.confirmed}
          actions={home}
        >
          {t.verifyEmail.confirmedDescription(verification.email)}
        </ResultPanel>
      )}
      {verification.status === "failed" && (
        <ResultPanel
          tone="danger"
          title={t.verifyEmail.failed}
          actions={
            <>
              {auth.me && (
                <Button
                  variant="primary"
                  pending={resend.pending}
                  onClick={() => void resend.run()}
                >
                  {t.verifyEmail.sendNewLink}
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
