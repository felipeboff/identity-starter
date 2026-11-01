import { AuthProvider, useAuth } from "./auth/auth-context";
import { ExplorerPage } from "./explorer/explorer-page";
import { AcceptInvitationPage } from "./pages/accept-invitation-page";
import { ConfirmEmailChangePage } from "./pages/confirm-email-change-page";
import { ForgotPasswordPage } from "./pages/forgot-password-page";
import { InvitationsPage } from "./pages/invitations-page";
import { MembersPage } from "./pages/members-page";
import { NotFoundPage } from "./pages/not-found-page";
import { OAuthCallbackPage } from "./pages/oauth-callback-page";
import { OverviewPage } from "./pages/overview-page";
import { ProfilePage } from "./pages/profile-page";
import { ResetPasswordPage } from "./pages/reset-password-page";
import { SecurityPage } from "./pages/security-page";
import { SignInPage } from "./pages/sign-in-page";
import { SignUpPage } from "./pages/sign-up-page";
import { VerifyEmailPage } from "./pages/verify-email-page";
import { appHistory, useLocation } from "./router/history";
import { Redirect, RouteTable } from "./router/router";
import { AsteriskLogo } from "./ui/icons";
import { ToastProvider } from "./ui/toast";

const ROUTES = new RouteTable([
  { pattern: "/sign-in", access: "guest", render: () => <SignInPage /> },
  { pattern: "/sign-up", access: "guest", render: () => <SignUpPage /> },
  {
    pattern: "/forgot-password",
    access: "guest",
    render: () => <ForgotPasswordPage />,
  },
  {
    pattern: "/reset-password",
    access: "any",
    render: () => <ResetPasswordPage />,
  },
  {
    pattern: "/verify-email",
    access: "any",
    render: () => <VerifyEmailPage />,
  },
  {
    pattern: "/accept-invitation",
    access: "any",
    render: () => <AcceptInvitationPage />,
  },
  {
    pattern: "/confirm-email-change",
    access: "any",
    render: () => <ConfirmEmailChangePage />,
  },
  {
    pattern: "/auth/:provider/callback",
    access: "any",
    render: (params) => <OAuthCallbackPage provider={params.provider ?? ""} />,
  },
  { pattern: "/explorer", access: "any", render: () => <ExplorerPage /> },
  { pattern: "/", access: "member", render: () => <OverviewPage /> },
  { pattern: "/profile", access: "member", render: () => <ProfilePage /> },
  { pattern: "/security", access: "member", render: () => <SecurityPage /> },
  {
    pattern: "/invitations",
    access: "member",
    render: () => <InvitationsPage />,
  },
  { pattern: "/members", access: "member", render: () => <MembersPage /> },
]);

const Splash = () => (
  <div class="splash" aria-busy="true" aria-label="Carregando">
    <AsteriskLogo size={40} class="splash-logo" />
  </div>
);

const Routes = () => {
  const auth = useAuth();
  const location = useLocation();
  const match = ROUTES.match(location.pathname);

  if (auth.state.status === "loading") return <Splash />;
  if (!match) return <NotFoundPage />;

  const signedIn = auth.state.status === "signed-in";
  if (match.route.access === "guest" && signedIn) {
    return (
      <Redirect to={appHistory.internalPath(location.search.get("next"))} />
    );
  }
  if (match.route.access === "member" && !signedIn) {
    const next =
      location.pathname === "/"
        ? ""
        : `?next=${encodeURIComponent(location.pathname)}`;
    return <Redirect to={`/sign-in${next}`} />;
  }
  return <>{match.route.render(match.params)}</>;
};

export const App = () => (
  <ToastProvider>
    <AuthProvider>
      <Routes />
    </AuthProvider>
  </ToastProvider>
);
