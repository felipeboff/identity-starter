import { useState } from "preact/hooks";

import { useMessages } from "../hooks/use-messages";
import { AuthLayout } from "../layouts/auth-layout";
import { Link } from "../router/router";
import { identityApi } from "../services";
import { LinkButton } from "../ui/button";
import { ResultPanel } from "../ui/feedback";
import { Field, Form, SubmitButton } from "../ui/form";
import { ArrowLeftIcon } from "../ui/icons";

export const ForgotPasswordPage = () => {
  const t = useMessages();
  const [sentTo, setSentTo] = useState<string | null>(null);

  return (
    <AuthLayout
      title={t.forgotPassword.title}
      subtitle={t.forgotPassword.subtitle}
      eyebrow={t.forgotPassword.eyebrow}
      tagline={t.forgotPassword.tagline}
    >
      {sentTo ? (
        <ResultPanel
          tone="success"
          title={t.forgotPassword.checkInbox}
          actions={
            <LinkButton
              href="/sign-in"
              variant="secondary"
              icon={<ArrowLeftIcon />}
            >
              {t.forgotPassword.backToSignIn}
            </LinkButton>
          }
        >
          {t.forgotPassword.sent(sentTo)}
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
              label={t.common.yourEmail}
              name="email"
              type="email"
              autocomplete="email"
              placeholder={t.common.emailPlaceholder}
              required
              autoFocus
            />
            <SubmitButton block>{t.forgotPassword.submit}</SubmitButton>
          </Form>
          <p class="auth-switch">
            {t.forgotPassword.remembered}{" "}
            <Link href="/sign-in" class="text-link">
              {t.forgotPassword.backToSignIn}
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
};
