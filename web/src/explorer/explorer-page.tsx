import { useId, useMemo, useRef, useState } from "preact/hooks";

import type { ApiResponse, HttpMethod } from "../api/api-client";
import { ApiError, type ProblemDetails } from "../api/api-error";
import { Permission, type SessionTokens } from "../api/identity.types";
import { useAuth } from "../auth/auth-context";
import { useResource } from "../hooks/use-resource";
import { PERMISSION_LABELS } from "../i18n/labels";
import { AppLayout, PageHeader } from "../layouts/app-layout";
import { appHistory, useLocation } from "../router/history";
import {
  apiClient,
  errorMessages,
  format,
  identityApi,
  tokenStore,
} from "../services";
import { Button } from "../ui/button";
import { CopyButton } from "../ui/copy-button";
import { Alert, Badge, EmptyState } from "../ui/feedback";
import type { SelectOption } from "../ui/form";
import {
  KeyIcon,
  LockIcon,
  SearchIcon,
  SendIcon,
  TerminalIcon,
} from "../ui/icons";
import { useToast } from "../ui/toast";

import { JsonView } from "./json-view";
import {
  PROVIDER_OPTIONS,
  ROUTE_CATALOG,
  RoutePath,
  type CatalogRoute,
} from "./route-catalog";

type RequestDraft = {
  params: Record<string, string>;
  query: Record<string, string>;
  bodyText: string;
  withToken: boolean;
};

type HistoryEntry = {
  id: number;
  route: CatalogRoute;
  path: string;
  draft: RequestDraft;
  response: ApiResponse;
  at: Date;
};

type Suggestions = Record<string, SelectOption[]>;

const STATUS_TEXT: Record<number, string> = {
  0: "Sem resposta",
  200: "OK",
  201: "Created",
  204: "No Content",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Content",
  429: "Too Many Requests",
  500: "Internal Server Error",
};

const HISTORY_LIMIT = 15;
const STACKED_LAYOUT = "(max-width: 1100px)";
const routePath = new RoutePath();

export class ResponseInspector {
  toneOf(status: number): "success" | "warning" | "danger" {
    if (status >= 200 && status < 300) return "success";
    return status >= 400 && status < 500 ? "warning" : "danger";
  }

  hasTokens(body: unknown): body is SessionTokens {
    return (
      typeof body === "object" &&
      body !== null &&
      "accessToken" in body &&
      "refreshToken" in body
    );
  }

  isProblem(body: unknown): body is ProblemDetails {
    return (
      typeof body === "object" &&
      body !== null &&
      "code" in body &&
      "status" in body
    );
  }
}

const inspector = new ResponseInspector();

export type MethodBadgeProps = {
  method: HttpMethod;
};

export const MethodBadge = (props: MethodBadgeProps) => (
  <span class={`method method-${props.method.toLowerCase()}`}>
    {props.method}
  </span>
);

type StatusPillProps = {
  status: number;
  compact?: boolean;
};

const StatusPill = (props: StatusPillProps) => (
  <span class={`status-pill status-${inspector.toneOf(props.status)}`}>
    {props.status === 0 ? "—" : props.status}
    {!props.compact && ` ${STATUS_TEXT[props.status] ?? ""}`}
  </span>
);

export const ExplorerPage = () => {
  const auth = useAuth();
  const toast = useToast();
  const location = useLocation();
  const bodyId = useId();
  const nextEntryId = useRef(1);
  const requestCard = useRef<HTMLDivElement>(null);

  const draftOf = (route: CatalogRoute): RequestDraft => {
    const params: Record<string, string> = {};
    for (const name of routePath.paramsOf(route.path)) {
      params[name] =
        name === "provider"
          ? (PROVIDER_OPTIONS[0] ?? "")
          : name === "accountId"
            ? (auth.me?.account.id ?? "")
            : "";
    }
    const body = route.body?.({
      me: auth.me,
      refreshToken: tokenStore.read()?.refreshToken ?? null,
      sample: crypto.randomUUID().slice(0, 8),
    });
    return {
      params,
      query: Object.fromEntries(
        (route.query ?? []).map((param) => [param.name, ""]),
      ),
      bodyText: body === undefined ? "" : JSON.stringify(body, null, 2),
      withToken: route.authenticated,
    };
  };

  const initialRoute =
    ROUTE_CATALOG.find((route) => route.id === location.search.get("route")) ??
    ROUTE_CATALOG[0]!;
  const [route, setRoute] = useState<CatalogRoute>(initialRoute);
  const [draft, setDraft] = useState<RequestDraft>(() => draftOf(initialRoute));
  const [filter, setFilter] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<number | null>(null);
  const [pending, setPending] = useState(false);

  const paramNames = routePath.paramsOf(route.path);
  const needsSessions = paramNames.includes("sessionId");
  const needsInvitations = paramNames.includes("invitationId");
  const accountId = auth.me?.account.id ?? null;

  const suggestions = useResource(async (): Promise<Suggestions> => {
    if (!accountId) return {};
    const [sessions, invitations] = await Promise.all([
      needsSessions ? identityApi.listSessions() : null,
      needsInvitations && auth.can(Permission.INVITATION_READ)
        ? identityApi.listInvitations()
        : null,
    ]);
    return {
      accountId: [{ value: accountId, label: "Minha conta" }],
      sessionId:
        sessions?.sessions.map((session) => ({
          value: session.id,
          label: `${format.device(session.userAgent).label}${session.current ? " (esta)" : ""}`,
        })) ?? [],
      invitationId:
        invitations?.invitations.map((invitation) => ({
          value: invitation.id,
          label: invitation.email,
        })) ?? [],
    };
  }, [accountId, needsSessions, needsInvitations, history.length]);

  const groups = useMemo(() => {
    const term = filter.trim().toLowerCase();
    const visible = ROUTE_CATALOG.filter(
      (candidate) =>
        !term ||
        `${candidate.method} ${candidate.path} ${candidate.summary}`
          .toLowerCase()
          .includes(term),
    );
    const byGroup = new Map<string, CatalogRoute[]>();
    for (const candidate of visible) {
      byGroup.set(candidate.group, [
        ...(byGroup.get(candidate.group) ?? []),
        candidate,
      ]);
    }
    return [...byGroup.entries()];
  }, [filter]);

  const lastStatusOf = (candidate: CatalogRoute): number | null =>
    history.find((entry) => entry.route.id === candidate.id)?.response.status ??
    null;

  const select = (next: CatalogRoute, nextDraft?: RequestDraft) => {
    setRoute(next);
    setDraft(nextDraft ?? draftOf(next));
    setInputError(null);
    setActiveEntryId(
      history.find((entry) => entry.route.id === next.id)?.id ?? null,
    );
    appHistory.replace(`/explorer?route=${next.id}`);
    if (window.matchMedia(STACKED_LAYOUT).matches) {
      requestCard.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const syncSession = async (response: ApiResponse) => {
    if (response.ok && inspector.hasTokens(response.body)) {
      await auth.startSession(response.body);
      toast.show({
        tone: "success",
        title: "Sessão deste navegador trocada pelos tokens da resposta",
      });
      return;
    }
    if (tokenStore.read()) await auth.reloadMe().catch(() => undefined);
  };

  const send = async () => {
    let body: unknown;
    if (route.body && draft.bodyText.trim()) {
      try {
        body = JSON.parse(draft.bodyText);
      } catch (error) {
        setInputError(`JSON inválido: ${(error as Error).message}`);
        return;
      }
    }
    const missing = paramNames.filter((name) => !draft.params[name]);
    if (missing.length > 0) {
      setInputError(`Preencha ${missing.join(", ")}.`);
      return;
    }
    setInputError(null);
    setPending(true);
    const path = routePath.withQuery(
      routePath.fill(route.path, draft.params),
      draft.query,
    );
    const response = await apiClient.exchange({
      method: route.method,
      path,
      body,
      authenticated: draft.withToken,
    });
    const entry: HistoryEntry = {
      id: nextEntryId.current++,
      route,
      path,
      draft,
      response,
      at: new Date(),
    };
    setHistory((current) => [entry, ...current].slice(0, HISTORY_LIMIT));
    setActiveEntryId(entry.id);
    setPending(false);
    await syncSession(response);
  };

  const active = history.find((entry) => entry.id === activeEntryId) ?? null;
  const expected = active
    ? [active.route.status, ...active.route.failures].includes(
        active.response.status,
      )
    : false;
  const storedTokens = tokenStore.read();

  return (
    <AppLayout>
      <PageHeader
        title="Explorador de rotas"
        description={`Chame qualquer uma das ${ROUTE_CATALOG.length} rotas da API e veja a resposta crua. Tokens devolvidos viram a sessão deste navegador.`}
        actions={
          <div class="session-indicator">
            <span class={`dot ${auth.me ? "dot-on" : ""}`} />
            {auth.me ? (
              <>
                <span>
                  Sessão de <strong>{auth.me.account.email}</strong>
                </span>
                {storedTokens && (
                  <CopyButton
                    value={storedTokens.accessToken}
                    label="Copiar access token"
                  />
                )}
              </>
            ) : (
              <span>Sem sessão</span>
            )}
          </div>
        }
      />

      <div class="explorer">
        <aside class="card explorer-list">
          <label class="search">
            <SearchIcon size={16} />
            <input
              type="search"
              placeholder="Filtrar por método, caminho ou texto"
              value={filter}
              onInput={(event) => setFilter(event.currentTarget.value)}
            />
          </label>
          <div class="route-groups">
            {groups.map(([group, routes]) => (
              <div key={group} class="route-group">
                <h3>
                  {group} <span>{routes.length}</span>
                </h3>
                <ul>
                  {routes.map((candidate) => {
                    const lastStatus = lastStatusOf(candidate);
                    return (
                      <li key={candidate.id}>
                        <button
                          type="button"
                          class={`route-item ${candidate.id === route.id ? "is-selected" : ""}`}
                          onClick={() => select(candidate)}
                        >
                          <MethodBadge method={candidate.method} />
                          <span class="route-path">{candidate.path}</span>
                          {candidate.authenticated && (
                            <LockIcon size={13} class="route-lock" />
                          )}
                          {lastStatus !== null && (
                            <span
                              class={`route-dot status-${inspector.toneOf(lastStatus)}`}
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {groups.length === 0 && (
              <p class="muted small">Nenhuma rota com esse filtro.</p>
            )}
          </div>
        </aside>

        <section class="explorer-main">
          <div class="card request-card" ref={requestCard}>
            <div class="request-line">
              <MethodBadge method={route.method} />
              <code class="request-path">/api{route.path}</code>
              <Button
                variant="primary"
                icon={<SendIcon />}
                pending={pending}
                onClick={() => void send()}
              >
                Enviar
              </Button>
            </div>
            <p class="request-summary">{route.summary}</p>
            <div class="request-meta">
              <Badge tone={route.authenticated ? "primary" : "neutral"}>
                {route.authenticated ? "Requer login" : "Pública"}
              </Badge>
              {route.permission && (
                <Badge
                  tone={auth.can(route.permission) ? "success" : "warning"}
                >
                  <KeyIcon size={12} /> {PERMISSION_LABELS[route.permission]}
                </Badge>
              )}
              {route.rateLimit && <Badge>{route.rateLimit}</Badge>}
              <span class="status-list">
                {[route.status, ...route.failures].map((status) => (
                  <StatusPill key={status} status={status} compact />
                ))}
              </span>
            </div>
            {route.note && <Alert tone="info">{route.note}</Alert>}

            {paramNames.length > 0 && (
              <div class="form-row">
                {paramNames.map((name) => (
                  <ParamInput
                    key={`${route.id}-${name}`}
                    name={name}
                    value={draft.params[name] ?? ""}
                    suggestions={suggestions.data?.[name] ?? []}
                    onChange={(value) =>
                      setDraft({
                        ...draft,
                        params: { ...draft.params, [name]: value },
                      })
                    }
                  />
                ))}
              </div>
            )}

            {route.query && (
              <div class="form-row">
                {route.query.map((param) => (
                  <QueryInput
                    key={`${route.id}-${param.name}`}
                    name={param.name}
                    hint={param.hint}
                    value={draft.query[param.name] ?? ""}
                    onChange={(value) =>
                      setDraft({
                        ...draft,
                        query: { ...draft.query, [param.name]: value },
                      })
                    }
                  />
                ))}
              </div>
            )}

            {route.body && (
              <div class="field">
                <div class="field-label-row">
                  <label for={bodyId}>Corpo (JSON)</label>
                  <button
                    type="button"
                    class="text-link small"
                    onClick={() => setDraft(draftOf(route))}
                  >
                    Restaurar exemplo
                  </button>
                </div>
                <textarea
                  id={bodyId}
                  class="input code-input"
                  rows={Math.min(
                    12,
                    Math.max(4, draft.bodyText.split("\n").length + 1),
                  )}
                  spellcheck={false}
                  value={draft.bodyText}
                  onInput={(event) =>
                    setDraft({ ...draft, bodyText: event.currentTarget.value })
                  }
                />
              </div>
            )}

            <label class="switch">
              <input
                type="checkbox"
                checked={draft.withToken}
                onChange={(event) =>
                  setDraft({ ...draft, withToken: event.currentTarget.checked })
                }
              />
              <span class="switch-track" aria-hidden="true" />
              <span>
                Enviar <code>Authorization: Bearer</code>
                {draft.withToken && !storedTokens && (
                  <em class="muted"> (não há token salvo)</em>
                )}
              </span>
            </label>
            {inputError && (
              <p class="field-message field-error">{inputError}</p>
            )}
          </div>

          <div class="card response-card">
            {active ? (
              <>
                <div class="response-head">
                  <StatusPill status={active.response.status} />
                  <Badge tone={expected ? "neutral" : "danger"}>
                    {expected ? "Previsto no contrato" : "Fora do contrato"}
                  </Badge>
                  <span class="muted small">
                    {active.response.durationMs} ms
                  </span>
                  <span class="response-path">
                    <MethodBadge method={active.route.method} /> {active.path}
                  </span>
                  {active.response.body !== null && (
                    <CopyButton
                      value={JSON.stringify(active.response.body, null, 2)}
                      label="Copiar resposta"
                    />
                  )}
                </div>
                {inspector.isProblem(active.response.body) && (
                  <Alert
                    tone={active.response.status >= 500 ? "danger" : "warning"}
                    title={active.response.body.code}
                  >
                    {errorMessages.describe(new ApiError(active.response.body))}
                  </Alert>
                )}
                {active.response.status === 0 ? (
                  <Alert tone="danger">
                    {errorMessages.describeCode("client.network_failed")}
                  </Alert>
                ) : active.response.body === null ? (
                  <div class="empty-body">Resposta sem corpo</div>
                ) : (
                  <JsonView value={active.response.body} />
                )}
              </>
            ) : (
              <EmptyState
                icon={<TerminalIcon />}
                title="Nenhuma resposta ainda"
              >
                Ajuste a requisição e clique em Enviar.
              </EmptyState>
            )}
          </div>

          {history.length > 0 && (
            <div class="card">
              <header class="card-header">
                <div>
                  <h2 class="card-title">Histórico</h2>
                  <p class="card-description">
                    As últimas {HISTORY_LIMIT} chamadas desta aba.
                  </p>
                </div>
              </header>
              <ul class="history">
                {history.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      class={`history-item ${entry.id === activeEntryId ? "is-selected" : ""}`}
                      onClick={() => {
                        select(entry.route, entry.draft);
                        setActiveEntryId(entry.id);
                      }}
                    >
                      <StatusPill status={entry.response.status} compact />
                      <MethodBadge method={entry.route.method} />
                      <span class="route-path">{entry.path}</span>
                      <span class="muted small">
                        {entry.at.toLocaleTimeString("pt-BR")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

type QueryInputProps = {
  name: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
};

const QueryInput = (props: QueryInputProps) => {
  const id = useId();
  return (
    <div class="field">
      <label for={id}>
        <code>?{props.name}</code>
      </label>
      <input
        id={id}
        class="input input-mono"
        placeholder={props.hint}
        spellcheck={false}
        value={props.value}
        onInput={(event) => props.onChange(event.currentTarget.value.trim())}
      />
    </div>
  );
};

type ParamInputProps = {
  name: string;
  value: string;
  suggestions: readonly SelectOption[];
  onChange: (value: string) => void;
};

const ParamInput = (props: ParamInputProps) => {
  const id = useId();
  return (
    <div class="field">
      <label for={id}>
        <code>:{props.name}</code>
      </label>
      {props.name === "provider" ? (
        <select
          id={id}
          class="input select"
          value={props.value}
          onChange={(event) => props.onChange(event.currentTarget.value)}
        >
          {PROVIDER_OPTIONS.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </select>
      ) : (
        <>
          <input
            id={id}
            class="input input-mono"
            list={`${id}-options`}
            placeholder="24 caracteres hexadecimais"
            spellcheck={false}
            value={props.value}
            onInput={(event) =>
              props.onChange(event.currentTarget.value.trim())
            }
          />
          <datalist id={`${id}-options`}>
            {props.suggestions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </datalist>
          {props.suggestions.length > 0 && (
            <p class="field-message">
              Dê dois cliques no campo para ver sugestões.
            </p>
          )}
        </>
      )}
    </div>
  );
};
