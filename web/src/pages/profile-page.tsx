import { useState } from "preact/hooks";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../api/identity.types";
import { useAuth, useMe } from "../auth/auth-context";
import { useAction } from "../hooks/use-action";
import { useResource } from "../hooks/use-resource";
import { AppLayout, PageHeader } from "../layouts/app-layout";
import { identityApi } from "../services";
import { Button } from "../ui/button";
import { ConfirmButton } from "../ui/confirm-button";
import { Alert, Badge, Card, Skeleton } from "../ui/feedback";
import { Field, Form, PasswordField, SubmitButton } from "../ui/form";
import { useToast } from "../ui/toast";

export const ProfilePage = () => {
  const auth = useAuth();
  const me = useMe();
  const toast = useToast();
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const credentials = useResource(() => identityApi.listCredentials(), []);
  const [passwordLinkSent, setPasswordLinkSent] = useState(false);
  const sendPasswordLink = useAction(async () => {
    await identityApi.requestPasswordReset({ email: me.account.email });
    setPasswordLinkSent(true);
  });
  const hasPassword = credentials.data
    ? credentials.data.credentials.some(
        (credential) => credential.provider === "email",
      )
    : null;

  return (
    <AppLayout>
      <PageHeader
        title="Perfil"
        description="Seu nome, seu e-mail e sua senha."
      />

      <div class="stack">
        <Card
          title="Dados pessoais"
          description="Como seu nome aparece para o time."
        >
          <Form
            class="form-inline"
            action={async (values) => {
              await identityApi.updateName({ name: values.text("name") });
              await auth.reloadMe();
              toast.show({ tone: "success", title: "Nome atualizado" });
            }}
          >
            <Field
              label="Nome"
              name="name"
              autocomplete="name"
              defaultValue={me.account.name}
              required
            />
            <SubmitButton>Salvar</SubmitButton>
          </Form>
        </Card>

        <Card
          title="E-mail"
          description="Enviamos um link de 1 hora para o endereço novo. A troca encerra todas as sessões."
          actions={
            <Badge tone={me.account.emailVerifiedAt ? "success" : "warning"}>
              {me.account.emailVerifiedAt ? "Confirmado" : "Não confirmado"}
            </Badge>
          }
        >
          <p class="current-value">
            Atual: <strong>{me.account.email}</strong>
          </p>
          {pendingEmail && (
            <Alert tone="success" title="Link enviado">
              Abra o e-mail que mandamos para {pendingEmail} para concluir a
              troca.
            </Alert>
          )}
          {hasPassword === false ? (
            <Alert tone="info" title="Defina uma senha primeiro">
              A troca de e-mail pede a senha atual. Sua conta entra só com
              GitHub ou Google: crie uma senha pelo link do card abaixo.
            </Alert>
          ) : (
            <Form
              resetOnSuccess
              action={async (values) => {
                const newEmail = values.text("newEmail");
                await identityApi.requestEmailChange({
                  newEmail,
                  password: values.text("password"),
                });
                setPendingEmail(newEmail);
              }}
            >
              <div class="form-row">
                <Field
                  label="E-mail novo"
                  name="newEmail"
                  type="email"
                  autocomplete="email"
                  required
                />
                <PasswordField
                  label="Senha atual"
                  name="password"
                  autocomplete="current-password"
                  maxLength={PASSWORD_MAX_LENGTH}
                  required
                />
              </div>
              <div class="form-actions">
                <SubmitButton>Enviar link de troca</SubmitButton>
              </div>
            </Form>
          )}
        </Card>

        <Card
          title={hasPassword === false ? "Definir senha" : "Senha"}
          description={
            hasPassword === false
              ? `Sua conta entra só com GitHub ou Google. Para criar uma senha, mandamos um link para ${me.account.email}: assim você mantém um jeito de entrar mesmo sem o provedor.`
              : "Trocar a senha encerra todas as sessões, inclusive esta."
          }
        >
          {hasPassword === null ? (
            <Skeleton lines={2} />
          ) : !hasPassword ? (
            <>
              {passwordLinkSent ? (
                <Alert tone="success" title="Link enviado">
                  Abra o e-mail que mandamos para {me.account.email} e crie a
                  senha por lá. Ao salvar, as sessões abertas são encerradas e
                  você entra de novo.
                </Alert>
              ) : (
                <div class="button-row">
                  <Button
                    variant="primary"
                    pending={sendPasswordLink.pending}
                    onClick={() => void sendPasswordLink.run()}
                  >
                    Enviar link para criar senha
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Form
              action={async (values) => {
                await identityApi.changePassword({
                  oldPassword: values.text("oldPassword"),
                  newPassword: values.text("newPassword"),
                });
                auth.endLocally(
                  "Senha alterada. Por segurança, todas as sessões foram encerradas; entre de novo.",
                );
              }}
            >
              <div class="form-row">
                <PasswordField
                  label="Senha atual"
                  name="oldPassword"
                  autocomplete="current-password"
                  maxLength={PASSWORD_MAX_LENGTH}
                  required
                />
                <PasswordField
                  label="Senha nova"
                  name="newPassword"
                  autocomplete="new-password"
                  minLength={PASSWORD_MIN_LENGTH}
                  maxLength={PASSWORD_MAX_LENGTH}
                  hint={`De ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caracteres.`}
                  required
                />
              </div>
              <div class="form-actions">
                <SubmitButton>Trocar senha</SubmitButton>
              </div>
            </Form>
          )}
        </Card>

        <Card
          tone="danger"
          title="Desativar conta"
          description="A conta fica inativa e todas as sessões são encerradas. Só alguém com a permissão de reativar contas pode trazê-la de volta."
          actions={
            <ConfirmButton
              variant="danger-soft"
              title="Desativar sua conta?"
              description="Você sai agora e não consegue entrar de novo até alguém reativar a conta."
              confirmLabel="Desativar"
              onConfirm={async () => {
                await identityApi.deactivateAccount(me.account.id);
                auth.endLocally("Sua conta foi desativada.");
              }}
            >
              Desativar conta
            </ConfirmButton>
          }
        />
      </div>
    </AppLayout>
  );
};
