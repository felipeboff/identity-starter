import { ALL_PERMISSIONS } from "../api/identity.types";
import { useMe } from "../auth/auth-context";
import { useAction } from "../hooks/use-action";
import { useMessages } from "../hooks/use-messages";
import { useResource } from "../hooks/use-resource";
import { AppLayout } from "../layouts/app-layout";
import { format, identityApi } from "../services";
import { Link } from "../router/router";
import { Button } from "../ui/button";
import { CopyButton } from "../ui/copy-button";
import { Alert, Card } from "../ui/feedback";
import {
  ArrowRightIcon,
  AsteriskLogo,
  CheckIcon,
  ClockIcon,
  KeyIcon,
  LockIcon,
  MonitorIcon,
} from "../ui/icons";
import { useToast } from "../ui/toast";

export const OverviewPage = () => {
  const t = useMessages();
  const me = useMe();
  const toast = useToast();
  const sessions = useResource(() => identityApi.listSessions(), []);
  const resend = useAction(async () => {
    await identityApi.requestEmailVerification();
    toast.show({
      tone: "success",
      title: t.overview.linkSent,
      description: t.overview.checkEmail(me.account.email),
    });
  });

  const held = me.membership.permissions;
  const details: Array<[string, string, boolean]> = [
    [t.common.accountId, me.account.id, true],
    [t.common.email, me.account.email, false],
    [t.overview.memberId, me.membership.id, true],
    [t.overview.createdAt, format.dateTime(me.account.createdAt), false],
    [
      t.overview.emailConfirmedAt,
      me.account.emailVerifiedAt
        ? format.dateTime(me.account.emailVerifiedAt)
        : t.overview.notYet,
      false,
    ],
  ];

  return (
    <AppLayout>
      <section class="hero">
        <div class="mesh" />
        <div class="mesh-grain" />
        <div class="hero-content">
          <p class="hero-eyebrow">{t.overview.eyebrow}</p>
          <h1>{t.overview.greeting(format.firstName(me.account.name))}</h1>
          <p class="hero-text">{me.account.email}</p>
          <div class="hero-badges">
            <span class="glass-badge">{t.roles[me.membership.role]}</span>
            <span class="glass-badge">
              {me.account.emailVerifiedAt
                ? t.overview.emailConfirmed
                : t.overview.emailPending}
            </span>
          </div>
        </div>
        <AsteriskLogo size={120} class="hero-logo" />
      </section>

      {!me.account.emailVerifiedAt && (
        <Alert
          tone="warning"
          title={t.overview.confirmEmail}
          action={
            <Button
              size="sm"
              variant="primary"
              pending={resend.pending}
              onClick={() => void resend.run()}
            >
              {t.overview.resendLink}
            </Button>
          }
        >
          {t.overview.confirmEmailDescription(me.account.email)}
        </Alert>
      )}

      <div class="stat-grid">
        <Link href="/security" class="stat stat-link">
          <span class="icon-tile">
            <MonitorIcon />
          </span>
          <div>
            <span class="stat-label">{t.overview.activeSessions}</span>
            <strong class="stat-value">
              {sessions.data ? sessions.data.sessions.length : "–"}
            </strong>
          </div>
          <ArrowRightIcon size={16} class="stat-arrow" />
        </Link>
        <div class="stat">
          <span class="icon-tile">
            <KeyIcon />
          </span>
          <div>
            <span class="stat-label">{t.overview.permissions}</span>
            <strong class="stat-value">
              {held.length}
              <small> {t.overview.outOf(ALL_PERMISSIONS.length)}</small>
            </strong>
          </div>
        </div>
        <div class="stat">
          <span class="icon-tile">
            <ClockIcon />
          </span>
          <div>
            <span class="stat-label">{t.common.memberSince}</span>
            <strong class="stat-value stat-value-sm">
              {format.date(me.account.createdAt)}
            </strong>
          </div>
        </div>
      </div>

      <div class="grid-2">
        <Card
          title={t.overview.yourPermissions}
          description={t.overview.yourPermissionsDescription}
        >
          <ul class="permission-list">
            {ALL_PERMISSIONS.map((permission) => {
              const granted = held.includes(permission);
              return (
                <li key={permission} class={granted ? "is-granted" : ""}>
                  <span class="permission-icon">
                    {granted ? <CheckIcon size={14} /> : <LockIcon size={14} />}
                  </span>
                  <span>{t.permissions[permission]}</span>
                  <code>{permission}</code>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card
          title={t.overview.accountDetails}
          description={t.overview.accountDetailsDescription}
        >
          <dl class="details">
            {details.map(([label, value, copyable]) => (
              <div key={label} class="details-row">
                <dt>{label}</dt>
                <dd>
                  <span class={copyable ? "mono" : ""}>{value}</span>
                  {copyable && (
                    <CopyButton
                      value={value}
                      label={t.common.copyLabel(label)}
                    />
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </AppLayout>
  );
};
