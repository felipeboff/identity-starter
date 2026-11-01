import {
  ALL_OAUTH_PROVIDERS,
  type Credential,
  type OAuthProvider,
  type Session,
} from "../api/identity.types";
import { useAuth, useMe } from "../auth/auth-context";
import { useAction } from "../hooks/use-action";
import { useResource } from "../hooks/use-resource";
import { PROVIDER_LABELS } from "../i18n/labels";
import { AppLayout, PageHeader } from "../layouts/app-layout";
import { OAuthButton, PROVIDER_ICONS } from "../layouts/oauth-buttons";
import { errorMessages, format, identityApi } from "../services";
import { Button, LinkButton } from "../ui/button";
import { ConfirmButton } from "../ui/confirm-button";
import { Alert, Badge, Card, Skeleton } from "../ui/feedback";
import {
  KeyIcon,
  LogOutIcon,
  MonitorIcon,
  PhoneIcon,
  RefreshIcon,
  TrashIcon,
} from "../ui/icons";
import { useToast } from "../ui/toast";

type SessionRowProps = {
  session: Session;
  onRevoked: () => Promise<void>;
};

const SessionRow = (props: SessionRowProps) => {
  const auth = useAuth();
  const toast = useToast();
  const signOut = useAction(auth.signOut);
  const device = format.device(props.session.userAgent);

  return (
    <li class={`list-row ${props.session.current ? "is-current" : ""}`}>
      <span class="icon-tile">
        {device.mobile ? <PhoneIcon /> : <MonitorIcon />}
      </span>
      <div class="list-row-main">
        <div class="list-row-title">
          <strong>{device.label}</strong>
          {props.session.current && <Badge tone="success">Esta sessão</Badge>}
        </div>
        <span class="list-row-meta">
          {props.session.ipAddress} · aberta{" "}
          {format.relative(props.session.createdAt)} · expira{" "}
          {format.relative(props.session.expiresAt)}
        </span>
      </div>
      {props.session.current ? (
        <Button
          size="sm"
          variant="ghost"
          icon={<LogOutIcon />}
          pending={signOut.pending}
          onClick={() => void signOut.run()}
        >
          Sair
        </Button>
      ) : (
        <ConfirmButton
          size="sm"
          variant="ghost"
          icon={<TrashIcon />}
          title="Encerrar esta sessão?"
          description={`${device.label} (${props.session.ipAddress}) vai precisar entrar de novo.`}
          confirmLabel="Encerrar"
          onConfirm={async () => {
            await identityApi.revokeSession(props.session.id);
            toast.show({ tone: "success", title: "Sessão encerrada" });
            await props.onRevoked();
          }}
        >
          Encerrar
        </ConfirmButton>
      )}
    </li>
  );
};

type ProviderRowProps = {
  provider: OAuthProvider;
  credential: Credential | undefined;
  onlyMethod: boolean;
  onChanged: () => Promise<void>;
};

const ProviderRow = (props: ProviderRowProps) => {
  const toast = useToast();
  const label = PROVIDER_LABELS[props.provider];

  return (
    <li class="list-row">
      <span class="icon-tile icon-tile-plain">
        {PROVIDER_ICONS[props.provider]}
      </span>
      <div class="list-row-main">
        <div class="list-row-title">
          <strong>{label}</strong>
          {props.credential && <Badge tone="success">Conectado</Badge>}
        </div>
        <span class="list-row-meta">
          {props.credential
            ? `${props.credential.providerEmail ?? "Sem e-mail"} · conectado ${format.relative(props.credential.createdAt)}${props.onlyMethod ? " · único jeito de entrar" : ""}`
            : `Use sua conta do ${label} para entrar.`}
        </span>
      </div>
      {props.credential ? (
        <ConfirmButton
          size="sm"
          variant="ghost"
          disabled={props.onlyMethod}
          title={`Desconectar ${label}?`}
          description={`Você deixa de entrar com o ${label}. Dá para conectar de novo quando quiser.`}
          confirmLabel="Desconectar"
          onConfirm={async () => {
            await identityApi.unlinkOAuth(props.provider);
            toast.show({ tone: "success", title: `${label} desconectado` });
            await props.onChanged();
          }}
        >
          Desconectar
        </ConfirmButton>
      ) : (
        <OAuthButton
          provider={props.provider}
          intent="link"
          label="Conectar"
          variant="secondary"
          size="sm"
        />
      )}
    </li>
  );
};

const SignInMethods = () => {
  const credentials = useResource(() => identityApi.listCredentials(), []);
  const active = credentials.data?.credentials ?? [];
  const password = active.find((credential) => credential.provider === "email");
  const onlyMethod = active.length === 1;

  return (
    <Card
      title="Formas de entrar"
      description="Entre com a senha, o GitHub ou o Google. Precisa sobrar pelo menos uma."
    >
      {credentials.error ? (
        <Alert tone="danger">{errorMessages.describe(credentials.error)}</Alert>
      ) : !credentials.data ? (
        <Skeleton lines={3} />
      ) : (
        <ul class="list">
          <li class="list-row">
            <span class="icon-tile icon-tile-plain">
              <KeyIcon />
            </span>
            <div class="list-row-main">
              <div class="list-row-title">
                <strong>E-mail e senha</strong>
                {password ? (
                  <Badge tone="success">Ativo</Badge>
                ) : (
                  <Badge>Sem senha</Badge>
                )}
              </div>
              <span class="list-row-meta">
                {password
                  ? `${password.providerEmail ?? ""} · senha atualizada ${format.relative(password.updatedAt)}`
                  : "Esta conta entra só pelos provedores abaixo."}
              </span>
            </div>
            <LinkButton
              href="/profile"
              size="sm"
              variant={password ? "ghost" : "secondary"}
            >
              {password ? "Trocar senha" : "Definir senha"}
            </LinkButton>
          </li>
          {ALL_OAUTH_PROVIDERS.map((provider) => (
            <ProviderRow
              key={provider}
              provider={provider}
              credential={active.find(
                (credential) => credential.provider === provider,
              )}
              onlyMethod={onlyMethod}
              onChanged={credentials.reload}
            />
          ))}
        </ul>
      )}
    </Card>
  );
};

export const SecurityPage = () => {
  const auth = useAuth();
  const me = useMe();
  const toast = useToast();
  const sessions = useResource(() => identityApi.listSessions(), []);
  const others =
    sessions.data?.sessions.filter((session) => !session.current).length ?? 0;

  return (
    <AppLayout>
      <PageHeader
        title="Segurança"
        description="Onde sua conta está aberta e por quais provedores você entra."
      />

      <div class="stack">
        <Card
          title="Sessões ativas"
          description="Cada login abre uma sessão nova; as outras continuam valendo até expirar ou serem encerradas."
          actions={
            <>
              <Button
                size="sm"
                variant="ghost"
                icon={<RefreshIcon />}
                ariaLabel="Recarregar sessões"
                pending={sessions.loading && Boolean(sessions.data)}
                onClick={() => void sessions.reload()}
              />
              <ConfirmButton
                size="sm"
                tone="primary"
                disabled={others === 0}
                title="Encerrar as outras sessões?"
                description="Todo dispositivo além deste precisa entrar de novo."
                confirmLabel="Encerrar as outras"
                onConfirm={async () => {
                  const output = await identityApi.revokeOtherSessions();
                  toast.show({
                    tone: "success",
                    title: `${output.revokedCount} sessões encerradas`,
                  });
                  await sessions.reload();
                }}
              >
                Encerrar as outras
              </ConfirmButton>
              <ConfirmButton
                size="sm"
                variant="danger-soft"
                title="Encerrar todas as sessões?"
                description="Inclusive esta: você sai agora em todos os dispositivos."
                confirmLabel="Encerrar todas"
                onConfirm={async () => {
                  const output = await identityApi.revokeAllSessions(
                    me.account.id,
                  );
                  auth.endLocally(
                    `${output.revokedCount} sessões encerradas. Entre de novo.`,
                  );
                }}
              >
                Encerrar todas
              </ConfirmButton>
            </>
          }
        >
          {sessions.error ? (
            <Alert tone="danger">
              {errorMessages.describe(sessions.error)}
            </Alert>
          ) : !sessions.data ? (
            <Skeleton lines={3} />
          ) : (
            <ul class="list">
              {sessions.data.sessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  onRevoked={sessions.reload}
                />
              ))}
            </ul>
          )}
        </Card>

        <SignInMethods />
      </div>
    </AppLayout>
  );
};
