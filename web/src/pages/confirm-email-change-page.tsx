import { useState } from "preact/hooks";

import { useAuth } from "../auth/auth-context";
import { useAction } from "../hooks/use-action";
import { AuthLayout } from "../layouts/auth-layout";
import { useLocation } from "../router/history";
import { identityApi } from "../services";
import { Button, LinkButton } from "../ui/button";
import { ResultPanel } from "../ui/feedback";

export const ConfirmEmailChangePage = () => {
  const auth = useAuth();
  const token = useLocation().search.get("token");
  const [newEmail, setNewEmail] = useState<string | null>(null);

  const confirm = useAction(async () => {
    if (!token) return;
    const output = await identityApi.confirmEmailChange({ token });
    if (auth.me) {
      auth.endLocally(
        `E-mail trocado para ${output.account.email}. Entre de novo com o endereço novo.`,
      );
    }
    setNewEmail(output.account.email);
  });

  return (
    <AuthLayout
      title="Trocar o e-mail da conta"
      eyebrow="Confirmação"
      tagline="Seu e-mail novo passa a valer para entrar e para receber avisos"
    >
      {!token ? (
        <ResultPanel
          tone="danger"
          title="Link incompleto"
          actions={
            <LinkButton href="/" variant="primary">
              Voltar
            </LinkButton>
          }
        >
          Abra o link exatamente como chegou no e-mail novo.
        </ResultPanel>
      ) : newEmail ? (
        <ResultPanel
          tone="success"
          title="E-mail trocado"
          actions={
            <LinkButton href="/sign-in" variant="primary">
              Entrar com o e-mail novo
            </LinkButton>
          }
        >
          A conta agora usa {newEmail}. Todas as sessões foram encerradas e o
          endereço antigo recebeu um aviso.
        </ResultPanel>
      ) : (
        <ResultPanel
          tone="info"
          title="Confirmar a troca?"
          actions={
            <Button
              variant="primary"
              pending={confirm.pending}
              onClick={() => void confirm.run()}
            >
              Confirmar troca de e-mail
            </Button>
          }
        >
          Ao confirmar, todas as sessões da conta são encerradas, inclusive
          esta, e você entra de novo com o e-mail novo.
        </ResultPanel>
      )}
    </AuthLayout>
  );
};
