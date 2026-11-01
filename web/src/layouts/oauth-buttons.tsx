import type { ComponentChild } from "preact";

import { ALL_OAUTH_PROVIDERS, type OAuthProvider } from "../api/identity.types";
import type { OAuthIntent } from "../auth/oauth-flow";
import { useAction } from "../hooks/use-action";
import { PROVIDER_LABELS } from "../i18n/labels";
import { oauthFlow } from "../services";
import { Button } from "../ui/button";
import { GitHubIcon, GoogleIcon } from "../ui/icons";
import { useToast } from "../ui/toast";

export const PROVIDER_ICONS: Record<OAuthProvider, ComponentChild> = {
  github: <GitHubIcon />,
  google: <GoogleIcon />,
};

export type OAuthButtonProps = {
  provider: OAuthProvider;
  intent: OAuthIntent;
  label?: string;
  variant?: "social" | "secondary";
  size?: "md" | "sm";
};

export const OAuthButton = (props: OAuthButtonProps) => {
  const toast = useToast();
  const start = useAction(async () => {
    if (!oauthFlow.isConfigured(props.provider)) {
      toast.show({
        tone: "info",
        title: `Login com ${PROVIDER_LABELS[props.provider]} não configurado`,
        description: `Defina ${oauthFlow.missingConfigName(props.provider)} em web/.env e reinicie o Vite.`,
      });
      return;
    }
    await oauthFlow.start(props.provider, props.intent);
  });

  return (
    <Button
      variant={props.variant ?? "social"}
      size={props.size}
      icon={PROVIDER_ICONS[props.provider]}
      pending={start.pending}
      onClick={() => void start.run()}
    >
      {props.label ?? PROVIDER_LABELS[props.provider]}
    </Button>
  );
};

export type OAuthButtonsProps = {
  intent: OAuthIntent;
};

export const OAuthButtons = (props: OAuthButtonsProps) => (
  <>
    <div class="divider">
      <span>ou continue com</span>
    </div>
    <div class="social-row">
      {ALL_OAUTH_PROVIDERS.map((provider) => (
        <OAuthButton key={provider} provider={provider} intent={props.intent} />
      ))}
    </div>
  </>
);
