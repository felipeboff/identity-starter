import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../api/identity.types";
import { useAuth } from "../auth/auth-context";
import { useMessages } from "../hooks/use-messages";
import { AuthLayout } from "../layouts/auth-layout";
import { OAuthButtons } from "../layouts/oauth-buttons";
import { appHistory } from "../router/history";
import { Link } from "../router/router";
import { identityApi } from "../services";
import { Field, Form, PasswordField, SubmitButton } from "../ui/form";
import { useToast } from "../ui/toast";

export const SignUpPage = () => {
  const t = useMessages();
  const auth = useAuth();
  const toast = useToast();

  return (
    <AuthLayout
      title={t.signUp.title}
      subtitle={t.signUp.subtitle}
      eyebrow={t.signUp.eyebrow}
      tagline={t.signUp.tagline}
    >
      <Form
        messages={{
          "identity.account_email_taken": t.signUp.emailTaken,
          "identity.credential_email_taken": t.signUp.emailTaken,
        }}
        action={async (values) => {
          const result = await identityApi.signUp({
            name: values.text("name"),
            email: values.text("email"),
            password: values.text("password"),
          });
          await auth.startSession(result);
          toast.show({
            tone: "success",
            title: t.signUp.created,
            description: t.signUp.confirmationSent(result.account.email),
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
        <Field
          label={t.common.yourEmail}
          name="email"
          type="email"
          autocomplete="email"
          placeholder={t.common.emailPlaceholder}
          required
        />
        <PasswordField
          label={t.common.password}
          name="password"
          autocomplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          hint={t.signUp.passwordHint(PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH)}
          required
        />
        <SubmitButton block>{t.signUp.submit}</SubmitButton>
      </Form>
      <OAuthButtons intent="sign-in" />
      <p class="auth-switch">
        {t.signUp.haveAccount}{" "}
        <Link href="/sign-in" class="text-link">
          {t.common.signIn}
        </Link>
      </p>
    </AuthLayout>
  );
};
