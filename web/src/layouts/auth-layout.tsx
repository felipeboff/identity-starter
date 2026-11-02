import type { ComponentChildren } from "preact";

import { useMessages } from "../hooks/use-messages";
import { Link } from "../router/router";
import { AsteriskLogo } from "../ui/icons";
import { LocaleSwitch } from "../ui/locale-switch";

export type AuthLayoutProps = {
  title: string;
  subtitle?: ComponentChildren;
  eyebrow?: string;
  tagline?: string;
  children: ComponentChildren;
};

export const AuthLayout = (props: AuthLayoutProps) => {
  const t = useMessages();
  return (
    <div class="auth-page">
      <div class="auth-card">
        <aside class="auth-visual" aria-hidden="true">
          <div class="mesh" />
          <div class="mesh-grain" />
          <AsteriskLogo size={44} class="auth-visual-logo" />
          <div class="auth-visual-copy">
            <p>
              {props.eyebrow ??
                t.authLayout.eyebrow(import.meta.env.VITE_APP_NAME)}
            </p>
            <h2>{props.tagline ?? t.authLayout.tagline}</h2>
          </div>
        </aside>
        <main class="auth-main">
          <div class="auth-content">
            <Link href="/" class="auth-mark" ariaCurrent={false}>
              <AsteriskLogo size={26} />
              <span class="sr-only">{import.meta.env.VITE_APP_NAME}</span>
            </Link>
            <h1 class="auth-title">{props.title}</h1>
            {props.subtitle && <p class="auth-subtitle">{props.subtitle}</p>}
            {props.children}
          </div>
        </main>
      </div>
      <div class="auth-footnote">
        <Link href="/explorer">{t.authLayout.exploreRoutes}</Link>
        <LocaleSwitch />
      </div>
    </div>
  );
};
