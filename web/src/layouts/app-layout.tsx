import type { ComponentChild, ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";

import { MEMBER_ACTION_PERMISSIONS, Permission } from "../api/identity.types";
import { useAuth } from "../auth/auth-context";
import { useAction } from "../hooks/use-action";
import { useMessages } from "../hooks/use-messages";
import { useLocation } from "../router/history";
import { Link } from "../router/router";
import { format } from "../services";
import { LinkButton } from "../ui/button";
import {
  AsteriskLogo,
  HomeIcon,
  MailIcon,
  LogOutIcon,
  ShieldIcon,
  TerminalIcon,
  UserIcon,
  UsersIcon,
} from "../ui/icons";
import { LocaleSwitch } from "../ui/locale-switch";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentChild;
  visible: boolean;
};

export type AppLayoutProps = {
  children: ComponentChildren;
};

const MEMBERS_PAGE_PERMISSIONS: readonly Permission[] = [
  Permission.MEMBER_READ,
  ...MEMBER_ACTION_PERMISSIONS,
];

export const AppLayout = (props: AppLayoutProps) => {
  const t = useMessages();
  const auth = useAuth();
  const location = useLocation();
  const signOut = useAction(auth.signOut);
  const nav = useRef<HTMLElement>(null);
  const me = auth.me;

  useEffect(() => {
    nav.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [location.pathname]);

  const items: NavItem[] = [
    {
      href: "/",
      label: t.nav.overview,
      icon: <HomeIcon />,
      visible: Boolean(me),
    },
    {
      href: "/profile",
      label: t.nav.profile,
      icon: <UserIcon />,
      visible: Boolean(me),
    },
    {
      href: "/security",
      label: t.nav.security,
      icon: <ShieldIcon />,
      visible: Boolean(me),
    },
    {
      href: "/invitations",
      label: t.nav.invitations,
      icon: <MailIcon />,
      visible:
        auth.can(Permission.INVITATION_CREATE) ||
        auth.can(Permission.INVITATION_READ),
    },
    {
      href: "/members",
      label: t.nav.members,
      icon: <UsersIcon />,
      visible: MEMBERS_PAGE_PERMISSIONS.some((permission) =>
        auth.can(permission),
      ),
    },
    {
      href: "/explorer",
      label: t.nav.explorer,
      icon: <TerminalIcon />,
      visible: true,
    },
  ];

  return (
    <div class={`shell ${me ? "" : "shell-guest"}`}>
      <aside class="sidebar">
        <Link href="/" class="brand">
          <span class="brand-mark">
            <AsteriskLogo size={18} />
          </span>
          <span class="brand-name">{import.meta.env.VITE_APP_NAME}</span>
        </Link>

        <nav class="nav" aria-label={t.nav.main} ref={nav}>
          {items
            .filter((item) => item.visible)
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                class="nav-item"
                ariaCurrent={location.pathname === item.href}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
        </nav>

        <LocaleSwitch />

        {me ? (
          <div class="user-chip">
            <span class="avatar">{format.initials(me.account.name)}</span>
            <div class="user-chip-text">
              <strong>{me.account.name}</strong>
              <span>{t.roles[me.membership.role]}</span>
            </div>
            <button
              type="button"
              class="icon-button"
              aria-label={t.common.signOut}
              title={t.common.signOut}
              disabled={signOut.pending}
              onClick={() => void signOut.run()}
            >
              <LogOutIcon />
            </button>
          </div>
        ) : (
          <div class="guest-actions">
            <LinkButton href="/sign-in" variant="primary" size="sm" block>
              {t.common.signIn}
            </LinkButton>
            <LinkButton href="/sign-up" variant="ghost" size="sm" block>
              {t.common.signUp}
            </LinkButton>
          </div>
        )}
      </aside>
      <main class="content">{props.children}</main>
    </div>
  );
};

export type PageHeaderProps = {
  title: string;
  description?: ComponentChildren;
  actions?: ComponentChild;
};

export const PageHeader = (props: PageHeaderProps) => (
  <header class="page-header">
    <div>
      <h1>{props.title}</h1>
      {props.description && <p>{props.description}</p>}
    </div>
    {props.actions && <div class="page-actions">{props.actions}</div>}
  </header>
);
