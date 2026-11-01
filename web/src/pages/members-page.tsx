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
import { useResource } from "../hooks/use-resource";
import { PERMISSION_LABELS, ROLE_LABELS } from "../i18n/labels";
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
const ROLE_OPTIONS = ALL_ROLES.map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}));
const PERMISSION_OPTIONS = ALL_PERMISSIONS.map((permission) => ({
  value: permission,
  label: PERMISSION_LABELS[permission],
}));

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
  const auth = useAuth();
  const me = useMe();
  const toast = useToast();
  const isSelf = props.accountId === me.account.id;
  const deactivated = props.member
    ? props.member.account.deletedAt !== null
    : null;
  const version = props.member?.membership.version ?? 0;

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

  return (
    <>
      {isSelf && (
        <Alert tone="info">
          Esta é a sua conta. Ninguém muda o próprio papel ou as próprias
          permissões.
        </Alert>
      )}

      {canRole && (
        <section class="panel-section">
          <h3>Papel</h3>
          <p class="panel-hint">Só um rótulo; não dá nem tira acesso.</p>
          <Form
            key={`role-${props.accountId}-${version}`}
            class="form-inline"
            action={async (values) => {
              const output = await identityApi.updateMemberRole({
                accountId: props.accountId,
                role: values.text("role") as Role,
              });
              props.onChanged({ membership: output.membership });
              toast.show({
                tone: "success",
                title: `Papel agora é ${ROLE_LABELS[output.membership.role]}`,
              });
            }}
          >
            <SelectField
              label="Escolha o papel"
              name="role"
              options={ROLE_OPTIONS}
              defaultValue={props.member?.membership.role ?? "user"}
            />
            <SubmitButton>Salvar</SubmitButton>
          </Form>
        </section>
      )}

      {canPermissions && (
        <section class="panel-section">
          <h3>Permissões</h3>
          <p class="panel-hint">
            {props.member
              ? "Marcadas são as que o membro tem hoje. Você só mexe nas que também tem."
              : "Substitui o conjunto inteiro. Você só mexe nas que também tem."}
          </p>
          <Form
            key={`permissions-${props.accountId}-${version}`}
            action={async (values) => {
              const output = await identityApi.updateMemberPermissions({
                accountId: props.accountId,
                permissions: values.list("permissions") as PermissionCode[],
              });
              props.onChanged({ membership: output.membership });
              toast.show({
                tone: "success",
                title: "Permissões atualizadas",
                description: `${output.membership.permissions.length} permissões no membro.`,
              });
            }}
          >
            <CheckboxGroup
              label="Permissões do membro"
              name="permissions"
              options={PERMISSION_OPTIONS}
              defaultValues={props.member?.membership.permissions ?? []}
              lockedValues={ALL_PERMISSIONS.filter(
                (permission) => !auth.can(permission),
              )}
              lockedTitle="Você não tem essa permissão, então não pode dar nem tirar."
            />
            <div class="form-actions">
              <SubmitButton>Salvar permissões</SubmitButton>
            </div>
          </Form>
        </section>
      )}

      {(canDeactivate || canReactivate) && (
        <section class="panel-section">
          <h3>Acesso</h3>
          <p class="panel-hint">
            {deactivated === null
              ? "Desativar encerra todas as sessões da conta."
              : deactivated
                ? "A conta está desativada e não consegue entrar."
                : "A conta está ativa. Desativar encerra todas as sessões dela."}
          </p>
          <div class="button-row">
            {canReactivate && (
              <ConfirmButton
                tone="primary"
                title="Reativar a conta?"
                description="A pessoa volta a conseguir entrar."
                confirmLabel="Reativar"
                onConfirm={async () => {
                  const output = await identityApi.reactivateAccount(
                    props.accountId,
                  );
                  props.onChanged({ account: output.account });
                  toast.show({
                    tone: "success",
                    title: `${output.account.name} reativada`,
                  });
                }}
              >
                Reativar conta
              </ConfirmButton>
            )}
            {canDeactivate && (
              <ConfirmButton
                variant="danger-soft"
                title="Desativar a conta?"
                description="A pessoa sai de todos os dispositivos e não entra até alguém reativar."
                confirmLabel="Desativar"
                onConfirm={async () => {
                  await identityApi.deactivateAccount(props.accountId);
                  if (isSelf) {
                    auth.endLocally("Sua conta foi desativada.");
                    return;
                  }
                  if (props.member) {
                    props.onChanged({
                      account: {
                        ...props.member.account,
                        deletedAt: new Date().toISOString(),
                      },
                    });
                  }
                  toast.show({ tone: "success", title: "Conta desativada" });
                }}
              >
                Desativar conta
              </ConfirmButton>
            )}
          </div>
        </section>
      )}

      {(canReadSessions || canRevokeAll) && (
        <section class="panel-section">
          <h3>Sessões</h3>
          {canReadSessions ? (
            <MemberSessions
              key={sessionsVersion}
              accountId={props.accountId}
              isSelf={isSelf}
            />
          ) : (
            <p class="panel-hint">
              Força a pessoa a entrar de novo em todos os dispositivos.
            </p>
          )}
          {canRevokeAll && (
            <div class="button-row">
              <ConfirmButton
                variant="danger-soft"
                icon={<KeyIcon />}
                title="Encerrar todas as sessões da conta?"
                description="Os refresh tokens dela deixam de valer na hora."
                confirmLabel="Encerrar todas"
                onConfirm={async () => {
                  const output = await identityApi.revokeAllSessions(
                    props.accountId,
                  );
                  if (isSelf) {
                    auth.endLocally("Todas as suas sessões foram encerradas.");
                    return;
                  }
                  toast.show({
                    tone: "success",
                    title: `${output.revokedCount} sessões encerradas`,
                  });
                  setSessionsVersion((version) => version + 1);
                }}
              >
                Encerrar todas as sessões
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
    return <p class="panel-hint">Nenhuma sessão ativa agora.</p>;
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
                {session.current && <Badge tone="success">Esta sessão</Badge>}
              </div>
              <span class="list-row-meta">
                {session.ipAddress} · aberta{" "}
                {format.relative(session.createdAt)} · expira{" "}
                {format.relative(session.expiresAt)}
              </span>
            </div>
            {canRevoke && !session.current && (
              <ConfirmButton
                size="sm"
                variant="ghost"
                icon={<TrashIcon />}
                title="Encerrar esta sessão?"
                description={`${device.label} (${session.ipAddress}) vai precisar entrar de novo.`}
                confirmLabel="Encerrar"
                onConfirm={async () => {
                  await identityApi.revokeSession(session.id);
                  toast.show({ tone: "success", title: "Sessão encerrada" });
                  await sessions.reload();
                }}
              >
                Encerrar
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

const MemberBadges = (props: MemberBadgesProps) => (
  <>
    {props.member.account.deletedAt ? (
      <Badge tone="danger">Desativada</Badge>
    ) : (
      <Badge
        tone={props.member.membership.role === "admin" ? "primary" : "neutral"}
      >
        {ROLE_LABELS[props.member.membership.role]}
      </Badge>
    )}
    {props.isSelf && <Badge tone="success">Você</Badge>}
  </>
);

type MemberPanelProps = {
  member: Member;
  onChanged: (changes: MemberChanges) => void;
};

const MemberPanel = (props: MemberPanelProps) => {
  const me = useMe();
  const account = props.member.account;
  const details: Array<[string, string, boolean]> = [
    ["ID da conta", account.id, true],
    ["Membro desde", format.date(account.createdAt), false],
    [
      "Último acesso",
      account.lastSeenAt ? format.relative(account.lastSeenAt) : "Nunca",
      false,
    ],
    [
      "E-mail confirmado",
      account.emailVerifiedAt ? format.date(account.emailVerifiedAt) : "Não",
      false,
    ],
  ];

  return (
    <>
      <header class="member-head">
        <span class={`avatar avatar-lg ${account.deletedAt ? "is-muted" : ""}`}>
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
                <CopyButton value={value} label={`Copiar ${label}`} />
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
        title="Time"
        description={
          directory
            ? `${members.length}${directory.nextCursor ? "+" : ""} membros carregados`
            : "Carregando…"
        }
        actions={
          <Button
            size="sm"
            variant="ghost"
            icon={<RefreshIcon />}
            ariaLabel="Recarregar membros"
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
            placeholder="Buscar por nome ou e-mail"
            value={filter}
            onInput={(event) => setFilter(event.currentTarget.value)}
          />
        </label>
        {failure ? (
          <Alert tone="danger">{errorMessages.describe(failure)}</Alert>
        ) : !directory ? (
          <Skeleton lines={4} />
        ) : visible.length === 0 ? (
          <EmptyState icon={<SearchIcon />} title="Ninguém encontrado">
            {directory.nextCursor
              ? "Carregue mais membros para buscar entre todos."
              : "Confira o nome ou o e-mail."}
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
                    class={`avatar avatar-sm ${member.account.deletedAt ? "is-muted" : ""}`}
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
            Carregar mais
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
          <EmptyState icon={<UsersIcon />} title="Escolha um membro">
            O papel, as permissões e o acesso dele aparecem aqui.
          </EmptyState>
        )}
      </div>
    </div>
  );
};

const ManualMember = () => {
  const inputId = useId();
  const [accountId, setAccountId] = useState("");
  const valid = ACCOUNT_ID.test(accountId);

  return (
    <div class="stack">
      <Alert tone="info" title="Lista de membros oculta">
        Sem a permissão “{PERMISSION_LABELS["member.read"]}”, informe o ID da
        conta de quem você quer gerenciar.
      </Alert>
      <Card title="Membro">
        <div class={`field ${accountId && !valid ? "is-invalid" : ""}`}>
          <label for={inputId}>ID da conta</label>
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
              Use os 24 caracteres hexadecimais do ID.
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
  const auth = useAuth();
  const canRead = auth.can(Permission.MEMBER_READ);
  const canAct = MEMBER_ACTION_PERMISSIONS.some((permission) =>
    auth.can(permission),
  );

  return (
    <AppLayout>
      <PageHeader
        title="Membros"
        description="Quem está no time, com que papel e com quais permissões."
      />
      {canRead ? (
        <MemberDirectory />
      ) : canAct ? (
        <ManualMember />
      ) : (
        <Card>
          <EmptyState icon={<LockIcon />} title="Sem acesso aos membros">
            Peça a alguém do time a permissão “
            {PERMISSION_LABELS["member.read"]}”.
          </EmptyState>
        </Card>
      )}
    </AppLayout>
  );
};
