import {
  ALL_OAUTH_PROVIDERS,
  type Credential,
  type OAuthProvider,
  type Session,
} from "../api/identity.types";
import { useAuth, useMe } from "../auth/auth-context";
import { useAction } from "../hooks/use-action";
import { useMessages } from "../hooks/use-messages";
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
  const t = useMessages();
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
          {props.session.current && (
            <Badge tone="success">{t.sessions.current}</Badge>
          )}
        </div>
        <span class="list-row-meta">
          {t.sessions.meta(
            props.session.ipAddress,
            format.relative(props.session.createdAt),
            format.relative(props.session.expiresAt),
          )}
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
          {t.common.signOut}
        </Button>
      ) : (
        <ConfirmButton
          size="sm"
          variant="ghost"
          icon={<TrashIcon />}
          title={t.sessions.endTitle}
          description={t.sessions.endDescription(
            device.label,
            props.session.ipAddress,
          )}
          confirmLabel={t.sessions.end}
          onConfirm={async () => {
            await identityApi.revokeSession(props.session.id);
            toast.show({ tone: "success", title: t.sessions.ended });
            await props.onRevoked();
          }}
        >
          {t.sessions.end}
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
  const t = useMessages();
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
          {props.credential && (
            <Badge tone="success">{t.security.connected}</Badge>
          )}
        </div>
        <span class="list-row-meta">
          {props.credential
            ? [
                props.credential.providerEmail ?? t.security.noEmail,
                t.security.connectedAt(
                  format.relative(props.credential.createdAt),
                ),
                ...(props.onlyMethod ? [t.security.onlyMethod] : []),
              ].join(" · ")
            : t.security.useProvider(label)}
        </span>
      </div>
      {props.credential ? (
        <ConfirmButton
          size="sm"
          variant="ghost"
          disabled={props.onlyMethod}
          title={t.security.disconnectTitle(label)}
          description={t.security.disconnectDescription(label)}
          confirmLabel={t.security.disconnect}
          onConfirm={async () => {
            await identityApi.unlinkOAuth(props.provider);
            toast.show({
              tone: "success",
              title: t.security.disconnected(label),
            });
            await props.onChanged();
          }}
        >
          {t.security.disconnect}
        </ConfirmButton>
      ) : (
        <OAuthButton
          provider={props.provider}
          intent="link"
          label={t.security.connect}
          variant="secondary"
          size="sm"
        />
      )}
    </li>
  );
};

const SignInMethods = () => {
  const t = useMessages();
  const credentials = useResource(() => identityApi.listCredentials(), []);
  const active = credentials.data?.credentials ?? [];
  const password = active.find((credential) => credential.provider === "email");
  const onlyMethod = active.length === 1;

  return (
    <Card
      title={t.security.methods}
      description={t.security.methodsDescription}
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
                <strong>{t.security.emailAndPassword}</strong>
                {password ? (
                  <Badge tone="success">{t.security.active}</Badge>
                ) : (
                  <Badge>{t.security.noPassword}</Badge>
                )}
              </div>
              <span class="list-row-meta">
                {password
                  ? `${password.providerEmail ?? ""} · ${t.security.passwordUpdated(format.relative(password.updatedAt))}`
                  : t.security.providersOnly}
              </span>
            </div>
            <LinkButton
              href="/profile"
              size="sm"
              variant={password ? "ghost" : "secondary"}
            >
              {password ? t.security.changePassword : t.security.setPassword}
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
  const t = useMessages();
  const auth = useAuth();
  const me = useMe();
  const toast = useToast();
  const sessions = useResource(() => identityApi.listSessions(), []);
  const others =
    sessions.data?.sessions.filter((session) => !session.current).length ?? 0;

  return (
    <AppLayout>
      <PageHeader
        title={t.security.title}
        description={t.security.description}
      />

      <div class="stack">
        <Card
          title={t.security.activeSessions}
          description={t.security.activeSessionsDescription}
          actions={
            <>
              <Button
                size="sm"
                variant="ghost"
                icon={<RefreshIcon />}
                ariaLabel={t.security.reloadSessions}
                pending={sessions.loading && Boolean(sessions.data)}
                onClick={() => void sessions.reload()}
              />
              <ConfirmButton
                size="sm"
                tone="primary"
                disabled={others === 0}
                title={t.security.endOthersTitle}
                description={t.security.endOthersDescription}
                confirmLabel={t.security.endOthers}
                onConfirm={async () => {
                  const output = await identityApi.revokeOtherSessions();
                  toast.show({
                    tone: "success",
                    title: t.sessions.endedCount(output.revokedCount),
                  });
                  await sessions.reload();
                }}
              >
                {t.security.endOthers}
              </ConfirmButton>
              <ConfirmButton
                size="sm"
                variant="danger-soft"
                title={t.security.endAllTitle}
                description={t.security.endAllDescription}
                confirmLabel={t.sessions.endAll}
                onConfirm={async () => {
                  const output = await identityApi.revokeAllSessions(
                    me.account.id,
                  );
                  auth.endLocally(
                    t.security.allEndedNotice(output.revokedCount),
                  );
                }}
              >
                {t.sessions.endAll}
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
