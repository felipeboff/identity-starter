import { useState } from "preact/hooks";

import { useAuth } from "../auth/auth-context";
import { useAction } from "../hooks/use-action";
import { useMessages } from "../hooks/use-messages";
import { AuthLayout } from "../layouts/auth-layout";
import { useLocation } from "../router/history";
import { identityApi } from "../services";
import { Button, LinkButton } from "../ui/button";
import { ResultPanel } from "../ui/feedback";

export const ConfirmEmailChangePage = () => {
  const t = useMessages();
  const auth = useAuth();
  const token = useLocation().search.get("token");
  const [newEmail, setNewEmail] = useState<string | null>(null);

  const confirm = useAction(async () => {
    if (!token) return;
    const output = await identityApi.confirmEmailChange({ token });
    if (auth.me) {
      auth.endLocally(t.confirmEmailChange.changedNotice(output.account.email));
    }
    setNewEmail(output.account.email);
  });

  return (
    <AuthLayout
      title={t.confirmEmailChange.title}
      eyebrow={t.confirmEmailChange.eyebrow}
      tagline={t.confirmEmailChange.tagline}
    >
      {!token ? (
        <ResultPanel
          tone="danger"
          title={t.common.incompleteLink}
          actions={
            <LinkButton href="/" variant="primary">
              {t.common.back}
            </LinkButton>
          }
        >
          {t.confirmEmailChange.openLinkAsReceived}
        </ResultPanel>
      ) : newEmail ? (
        <ResultPanel
          tone="success"
          title={t.confirmEmailChange.changed}
          actions={
            <LinkButton href="/sign-in" variant="primary">
              {t.confirmEmailChange.signInWithNewEmail}
            </LinkButton>
          }
        >
          {t.confirmEmailChange.changedDescription(newEmail)}
        </ResultPanel>
      ) : (
        <ResultPanel
          tone="info"
          title={t.confirmEmailChange.confirmTitle}
          actions={
            <Button
              variant="primary"
              pending={confirm.pending}
              onClick={() => void confirm.run()}
            >
              {t.confirmEmailChange.confirm}
            </Button>
          }
        >
          {t.confirmEmailChange.confirmDescription}
        </ResultPanel>
      )}
    </AuthLayout>
  );
};
