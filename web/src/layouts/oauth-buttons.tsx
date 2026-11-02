import type { ComponentChild } from "preact";

import { ALL_OAUTH_PROVIDERS, type OAuthProvider } from "../api/identity.types";
import type { OAuthIntent } from "../auth/oauth-flow";
import { useAction } from "../hooks/use-action";
import { useMessages } from "../hooks/use-messages";
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
  const t = useMessages();
  const toast = useToast();
  const start = useAction(async () => {
    if (!oauthFlow.isConfigured(props.provider)) {
      toast.show({
        tone: "info",
        title: t.oauth.notConfigured(PROVIDER_LABELS[props.provider]),
        description: t.oauth.configureHint(
          oauthFlow.missingConfigName(props.provider),
        ),
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

export const OAuthButtons = (props: OAuthButtonsProps) => {
  const t = useMessages();
  return (
    <>
      <div class="divider">
        <span>{t.oauth.continueWith}</span>
      </div>
      <div class="social-row">
        {ALL_OAUTH_PROVIDERS.map((provider) => (
          <OAuthButton
            key={provider}
            provider={provider}
            intent={props.intent}
          />
        ))}
      </div>
    </>
  );
};
