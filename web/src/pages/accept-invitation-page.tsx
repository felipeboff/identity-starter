import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../api/identity.types";
import { useAuth } from "../auth/auth-context";
import { useMessages } from "../hooks/use-messages";
import { AuthLayout } from "../layouts/auth-layout";
import { appHistory, useLocation } from "../router/history";
import { identityApi } from "../services";
import { LinkButton } from "../ui/button";
import { Alert, ResultPanel } from "../ui/feedback";
import { Field, Form, PasswordField, SubmitButton } from "../ui/form";
import { useToast } from "../ui/toast";

export const AcceptInvitationPage = () => {
  const t = useMessages();
  const auth = useAuth();
  const toast = useToast();
  const token = useLocation().search.get("token");

  return (
    <AuthLayout
      title={t.acceptInvitation.title}
      subtitle={t.acceptInvitation.subtitle}
      eyebrow={t.acceptInvitation.eyebrow}
      tagline={t.acceptInvitation.tagline}
    >
      {!token ? (
        <ResultPanel
          tone="danger"
          title={t.acceptInvitation.incomplete}
          actions={
            <LinkButton href="/sign-in" variant="primary">
              {t.acceptInvitation.goToSignIn}
            </LinkButton>
          }
        >
          {t.common.openLinkAsReceived}
        </ResultPanel>
      ) : (
        <>
          {auth.me && (
            <Alert tone="info">
              {t.acceptInvitation.signedInAs(auth.me.account.email)}
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
                title: t.acceptInvitation.welcome(result.account.name),
              });
              appHistory.replace("/");
            }}
          >
            <Field
              label={t.common.yourName}
              name="name"
              autocomplete="name"
              placeholder="Ada Lovelace"
              required
              autoFocus
            />
            <PasswordField
              label={t.common.password}
              name="password"
              autocomplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              hint={t.common.passwordLength(
                PASSWORD_MIN_LENGTH,
                PASSWORD_MAX_LENGTH,
              )}
              required
            />
            <SubmitButton block>{t.acceptInvitation.submit}</SubmitButton>
          </Form>
        </>
      )}
    </AuthLayout>
  );
};
