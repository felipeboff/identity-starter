import { useCallback, useEffect, useId, useRef, useState } from "preact/hooks";

import {
  ALL_PERMISSIONS,
  ALL_ROLES,
  MEMBER_ACTION_PERMISSIONS,
  OBJECT_ID_PATTERN,
  Permission,
  type Account,
  type Member,
  type MembersOutput,
  type Membership,
  type Permission as PermissionCode,
  type Role,
} from "../api/identity.types";
import { useAuth, useMe } from "../auth/auth-context";
import { useAction } from "../hooks/use-action";
import { useMessages } from "../hooks/use-messages";
import { useResource } from "../hooks/use-resource";
import { AppLayout, PageHeader } from "../layouts/app-layout";
import { errorMessages, format, identityApi } from "../services";
import { Button } from "../ui/button";
import { ConfirmButton } from "../ui/confirm-button";
import { CopyButton } from "../ui/copy-button";
import { Alert, Badge, Card, EmptyState, Skeleton } from "../ui/feedback";
import { CheckboxGroup, Form, SelectField, SubmitButton } from "../ui/form";
import {
  KeyIcon,
  LockIcon,
  MonitorIcon,
  PhoneIcon,
  TrashIcon,
  RefreshIcon,
  SearchIcon,
  UsersIcon,
} from "../ui/icons";
import { useToast } from "../ui/toast";

const ACCOUNT_ID = new RegExp(`^${OBJECT_ID_PATTERN}$`);
const STACKED_LAYOUT = "(max-width: 1100px)";

type MemberChanges = {
  account?: Account;
  membership?: Membership;
};

type MemberActionsProps = {
  accountId: string;
  member: Member | null;
  onChanged: (changes: MemberChanges) => void;
};

const MemberActions = (props: MemberActionsProps) => {
  const t = useMessages();
  const auth = useAuth();
  const me = useMe();
  const toast = useToast();
  const isSelf = props.accountId === me.account.id;
  const deactivated = props.member
    ? props.member.account.deactivatedAt !== null
    : null;
  const membershipUpdatedAt = props.member?.membership.updatedAt ?? "";

  const canRole = auth.can(Permission.MEMBER_ROLE_UPDATE) && !isSelf;
  const canPermissions =
    auth.can(Permission.MEMBER_PERMISSIONS_UPDATE) && !isSelf;
  const canDeactivate =
    auth.can(Permission.ACCOUNT_DEACTIVATE) && deactivated !== true;
  const canReactivate =
    auth.can(Permission.ACCOUNT_REACTIVATE) && deactivated !== false;
  const canRevokeAll = auth.can(Permission.SESSION_REVOKE_ALL);
  const canReadSessions = auth.can(Permission.SESSION_READ) || isSelf;
  const [sessionsVersion, setSessionsVersion] = useState(0);
  const roleOptions = ALL_ROLES.map((role) => ({
    value: role,
    label: t.roles[role],
  }));
  const permissionOptions = ALL_PERMISSIONS.map((permission) => ({
    value: permission,
    label: t.permissions[permission],
  }));

  return (
    <>
      {isSelf && <Alert tone="info">{t.members.selfNotice}</Alert>}

      {canRole && (
        <section class="panel-section">
          <h3>{t.members.role}</h3>
          <p class="panel-hint">{t.members.roleHint}</p>
          <Form
            key={`role-${props.accountId}-${membershipUpdatedAt}`}
            class="form-inline"
            action={async (values) => {
              const output = await identityApi.updateMemberRole({
                accountId: props.accountId,
                role: values.text("role") as Role,
              });
              props.onChanged({ membership: output.membership });
              toast.show({
                tone: "success",
                title: t.members.roleChanged(t.roles[output.membership.role]),
              });
            }}
          >
            <SelectField
              label={t.members.chooseRole}
              name="role"
              options={roleOptions}
              defaultValue={props.member?.membership.role ?? "user"}
            />
            <SubmitButton>{t.common.save}</SubmitButton>
          </Form>
        </section>
      )}

      {canPermissions && (
        <section class="panel-section">
          <h3>{t.members.permissions}</h3>
          <p class="panel-hint">
            {props.member
              ? t.members.permissionsHintMember
              : t.members.permissionsHintManual}
          </p>
          <Form
            key={`permissions-${props.accountId}-${membershipUpdatedAt}`}
            action={async (values) => {
              const output = await identityApi.updateMemberPermissions({
                accountId: props.accountId,
                permissions: values.list("permissions") as PermissionCode[],
              });
              props.onChanged({ membership: output.membership });
              toast.show({
                tone: "success",
                title: t.members.permissionsUpdated,
                description: t.members.permissionsCount(
                  output.membership.permissions.length,
                ),
              });
            }}
          >
            <CheckboxGroup
              label={t.members.memberPermissions}
              name="permissions"
              options={permissionOptions}
              defaultValues={props.member?.membership.permissions ?? []}
              lockedValues={ALL_PERMISSIONS.filter(
                (permission) => !auth.can(permission),
              )}
              lockedTitle={t.members.lockedPermission}
            />
            <div class="form-actions">
              <SubmitButton>{t.members.savePermissions}</SubmitButton>
            </div>
          </Form>
        </section>
      )}

      {(canDeactivate || canReactivate) && (
        <section class="panel-section">
          <h3>{t.members.access}</h3>
          <p class="panel-hint">
            {deactivated === null
              ? t.members.accessHintUnknown
              : deactivated
                ? t.members.accessHintDeactivated
                : t.members.accessHintActive}
          </p>
          <div class="button-row">
            {canReactivate && (
              <ConfirmButton
                tone="primary"
                title={t.members.reactivateTitle}
                description={t.members.reactivateDescription}
                confirmLabel={t.members.reactivateConfirm}
                onConfirm={async () => {
                  const output = await identityApi.reactivateAccount(
                    props.accountId,
                  );
                  props.onChanged({ account: output.account });
                  toast.show({
                    tone: "success",
                    title: t.members.reactivated(output.account.name),
                  });
                }}
              >
                {t.members.reactivate}
              </ConfirmButton>
            )}
            {canDeactivate && (
              <ConfirmButton
                variant="danger-soft"
                title={t.members.deactivateTitle}
                description={t.members.deactivateDescription}
                confirmLabel={t.members.deactivateConfirm}
                onConfirm={async () => {
                  await identityApi.deactivateAccount(props.accountId);
                  if (isSelf) {
                    auth.endLocally(t.common.accountDeactivated);
                    return;
                  }
                  if (props.member) {
                    props.onChanged({
                      account: {
                        ...props.member.account,
                        deactivatedAt: new Date().toISOString(),
                      },
                    });
                  }
                  toast.show({ tone: "success", title: t.members.deactivated });
                }}
              >
                {t.members.deactivate}
              </ConfirmButton>
            )}
          </div>
        </section>
      )}

      {(canReadSessions || canRevokeAll) && (
        <section class="panel-section">
          <h3>{t.members.sessions}</h3>
          {canReadSessions ? (
            <MemberSessions
              key={sessionsVersion}
              accountId={props.accountId}
              isSelf={isSelf}
            />
          ) : (
            <p class="panel-hint">{t.members.revokeAllHint}</p>
          )}
          {canRevokeAll && (
            <div class="button-row">
              <ConfirmButton
                variant="danger-soft"
                icon={<KeyIcon />}
                title={t.members.revokeAllTitle}
                description={t.members.revokeAllDescription}
                confirmLabel={t.sessions.endAll}
                onConfirm={async () => {
                  const output = await identityApi.revokeAllSessions(
                    props.accountId,
                  );
                  if (isSelf) {
                    auth.endLocally(t.members.allSessionsEnded);
                    return;
                  }
                  toast.show({
                    tone: "success",
                    title: t.sessions.endedCount(output.revokedCount),
                  });
                  setSessionsVersion((version) => version + 1);
                }}
              >
                {t.members.revokeAll}
              </ConfirmButton>
            </div>
          )}
        </section>
      )}
    </>
  );
};

type MemberSessionsProps = {
  accountId: string;
  isSelf: boolean;
};

const MemberSessions = (props: MemberSessionsProps) => {
  const t = useMessages();
  const auth = useAuth();
  const toast = useToast();
  const sessions = useResource(
    () => identityApi.listAccountSessions(props.accountId),
    [props.accountId],
  );
  const canRevoke = auth.can(Permission.SESSION_REVOKE) || props.isSelf;

  if (sessions.error) {
    return (
      <Alert tone="danger">{errorMessages.describe(sessions.error)}</Alert>
    );
  }
  if (!sessions.data) return <Skeleton lines={2} />;
  if (sessions.data.sessions.length === 0) {
    return <p class="panel-hint">{t.members.noSessions}</p>;
  }

  return (
    <ul class="list">
      {sessions.data.sessions.map((session) => {
        const device = format.device(session.userAgent);
        return (
          <li key={session.id} class="list-row">
            <span class="icon-tile">
              {device.mobile ? <PhoneIcon /> : <MonitorIcon />}
            </span>
            <div class="list-row-main">
              <div class="list-row-title">
                <strong>{device.label}</strong>
                {session.current && (
                  <Badge tone="success">{t.sessions.current}</Badge>
                )}
              </div>
              <span class="list-row-meta">
                {t.sessions.meta(
                  session.ipAddress,
                  format.relative(session.createdAt),
                  format.relative(session.expiresAt),
                )}
              </span>
            </div>
            {canRevoke && !session.current && (
              <ConfirmButton
                size="sm"
                variant="ghost"
                icon={<TrashIcon />}
                title={t.sessions.endTitle}
                description={t.sessions.endDescription(
                  device.label,
                  session.ipAddress,
                )}
                confirmLabel={t.sessions.end}
                onConfirm={async () => {
                  await identityApi.revokeSession(session.id);
                  toast.show({ tone: "success", title: t.sessions.ended });
                  await sessions.reload();
                }}
              >
                {t.sessions.end}
              </ConfirmButton>
            )}
          </li>
        );
      })}
    </ul>
  );
};

type MemberBadgesProps = {
  member: Member;
  isSelf: boolean;
};

const MemberBadges = (props: MemberBadgesProps) => {
  const t = useMessages();
  return (
    <>
      {props.member.account.deactivatedAt ? (
        <Badge tone="danger">{t.members.deactivatedBadge}</Badge>
      ) : (
        <Badge
          tone={
            props.member.membership.role === "admin" ? "primary" : "neutral"
          }
        >
          {t.roles[props.member.membership.role]}
        </Badge>
      )}
      {props.isSelf && <Badge tone="success">{t.members.you}</Badge>}
    </>
  );
};

type MemberPanelProps = {
  member: Member;
  onChanged: (changes: MemberChanges) => void;
};

const MemberPanel = (props: MemberPanelProps) => {
  const t = useMessages();
  const me = useMe();
  const account = props.member.account;
  const details: Array<[string, string, boolean]> = [
    [t.common.accountId, account.id, true],
    [t.common.memberSince, format.date(account.createdAt), false],
    [
      t.members.lastSeen,
      account.lastSeenAt
        ? format.relative(account.lastSeenAt)
        : t.members.never,
      false,
    ],
    [
      t.members.emailConfirmed,
      account.emailVerifiedAt
        ? format.date(account.emailVerifiedAt)
        : t.members.no,
      false,
    ],
  ];

  return (
    <>
      <header class="member-head">
        <span
          class={`avatar avatar-lg ${account.deactivatedAt ? "is-muted" : ""}`}
        >
          {format.initials(account.name)}
        </span>
        <div class="member-head-text">
          <h2>{account.name}</h2>
          <p>{account.email}</p>
          <div class="member-badges">
            <MemberBadges
              member={props.member}
              isSelf={account.id === me.account.id}
            />
          </div>
        </div>
      </header>
      <dl class="details">
        {details.map(([label, value, copyable]) => (
          <div key={label} class="details-row">
            <dt>{label}</dt>
            <dd>
              <span class={copyable ? "mono" : ""}>{value}</span>
              {copyable && (
                <CopyButton value={value} label={t.common.copyLabel(label)} />
              )}
            </dd>
          </div>
        ))}
      </dl>
      <MemberActions
        accountId={account.id}
        member={props.member}
        onChanged={props.onChanged}
      />
    </>
  );
};

const MemberDirectory = () => {
  const t = useMessages();
  const me = useMe();
  const searchId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [directory, setDirectory] = useState<MembersOutput | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchPage = useCallback(async (cursor?: string) => {
    try {
      const page = await identityApi.listMembers({ cursor });
      setDirectory((current) =>
        cursor && current
          ? {
              members: [...current.members, ...page.members],
              nextCursor: page.nextCursor,
            }
          : page,
      );
      setFailure(null);
    } catch (error) {
      setFailure(error);
    }
  }, []);

  useEffect(() => {
    void fetchPage();
  }, [fetchPage]);

  const reload = useAction(() => fetchPage());
  const loadMore = useAction(async () => {
    if (directory?.nextCursor) await fetchPage(directory.nextCursor);
  });

  const members = directory?.members ?? [];
  const term = format.searchKey(filter.trim());
  const visible = members.filter((member) =>
    format
      .searchKey(`${member.account.name} ${member.account.email}`)
      .includes(term),
  );
  const selected =
    members.find((member) => member.account.id === selectedId) ?? null;

  const select = (accountId: string) => {
    setSelectedId(accountId);
    if (window.matchMedia(STACKED_LAYOUT).matches) {
      panel.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const patch = (accountId: string, changes: MemberChanges) =>
    setDirectory(
      (current) =>
        current && {
          ...current,
          members: current.members.map((member) =>
            member.account.id === accountId
              ? { ...member, ...changes }
              : member,
          ),
        },
    );

  return (
    <div class="members-layout">
      <Card
        title={t.members.team}
        description={
          directory
            ? t.members.loaded(members.length, Boolean(directory.nextCursor))
            : t.members.loadingList
        }
        actions={
          <Button
            size="sm"
            variant="ghost"
            icon={<RefreshIcon />}
            ariaLabel={t.members.reload}
            pending={reload.pending}
            onClick={() => void reload.run()}
          />
        }
      >
        <label class="search search-flush" for={searchId}>
          <SearchIcon size={16} />
          <input
            id={searchId}
            type="search"
            placeholder={t.members.search}
            value={filter}
            onInput={(event) => setFilter(event.currentTarget.value)}
          />
        </label>
        {failure ? (
          <Alert tone="danger">{errorMessages.describe(failure)}</Alert>
        ) : !directory ? (
          <Skeleton lines={4} />
        ) : visible.length === 0 ? (
          <EmptyState icon={<SearchIcon />} title={t.members.nobodyFound}>
            {directory.nextCursor
              ? t.members.loadMoreToSearch
              : t.members.checkSearch}
          </EmptyState>
        ) : (
          <ul class="member-list">
            {visible.map((member) => (
              <li key={member.account.id}>
                <button
                  type="button"
                  class={`member-item ${member.account.id === selectedId ? "is-selected" : ""}`}
                  aria-pressed={member.account.id === selectedId}
                  onClick={() => select(member.account.id)}
                >
                  <span
                    class={`avatar avatar-sm ${member.account.deactivatedAt ? "is-muted" : ""}`}
                  >
                    {format.initials(member.account.name)}
                  </span>
                  <span class="member-item-main">
                    <strong>{member.account.name}</strong>
                    <span>{member.account.email}</span>
                  </span>
                  <span class="member-badges">
                    <MemberBadges
                      member={member}
                      isSelf={member.account.id === me.account.id}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {directory?.nextCursor && (
          <Button
            variant="secondary"
            block
            pending={loadMore.pending}
            onClick={() => void loadMore.run()}
          >
            {t.members.loadMore}
          </Button>
        )}
      </Card>

      <div class="card member-panel" ref={panel}>
        {selected ? (
          <MemberPanel
            key={selected.account.id}
            member={selected}
            onChanged={(changes) => patch(selected.account.id, changes)}
          />
        ) : (
          <EmptyState icon={<UsersIcon />} title={t.members.chooseMember}>
            {t.members.chooseMemberDescription}
          </EmptyState>
        )}
      </div>
    </div>
  );
};

const ManualMember = () => {
  const t = useMessages();
  const inputId = useId();
  const [accountId, setAccountId] = useState("");
  const valid = ACCOUNT_ID.test(accountId);

  return (
    <div class="stack">
      <Alert tone="info" title={t.members.listHidden}>
        {t.members.listHiddenDescription(t.permissions["member.read"])}
      </Alert>
      <Card title={t.members.member}>
        <div class={`field ${accountId && !valid ? "is-invalid" : ""}`}>
          <label for={inputId}>{t.common.accountId}</label>
          <input
            id={inputId}
            class="input input-mono"
            placeholder="65f1c0ffee0000000000abcd"
            value={accountId}
            spellcheck={false}
            onInput={(event) => setAccountId(event.currentTarget.value.trim())}
          />
          {accountId && !valid && (
            <p class="field-message field-error">
              {t.members.invalidAccountId}
            </p>
          )}
        </div>
      </Card>
      {valid && (
        <div class="card member-panel">
          <MemberActions
            key={accountId}
            accountId={accountId}
            member={null}
            onChanged={() => undefined}
          />
        </div>
      )}
    </div>
  );
};

export const MembersPage = () => {
  const t = useMessages();
  const auth = useAuth();
  const canRead = auth.can(Permission.MEMBER_READ);
  const canAct = MEMBER_ACTION_PERMISSIONS.some((permission) =>
    auth.can(permission),
  );

  return (
    <AppLayout>
      <PageHeader title={t.members.title} description={t.members.description} />
      {canRead ? (
        <MemberDirectory />
      ) : canAct ? (
        <ManualMember />
      ) : (
        <Card>
          <EmptyState icon={<LockIcon />} title={t.members.noAccess}>
            {t.members.noAccessDescription(t.permissions["member.read"])}
          </EmptyState>
        </Card>
      )}
    </AppLayout>
  );
};
