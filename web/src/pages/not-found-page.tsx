import { AuthLayout } from "../layouts/auth-layout";
import { LinkButton } from "../ui/button";
import { ResultPanel } from "../ui/feedback";
import { ArrowLeftIcon } from "../ui/icons";

export const NotFoundPage = () => (
  <AuthLayout
    title="Página não encontrada"
    eyebrow="404"
    tagline="Esse caminho não leva a lugar nenhum"
  >
    <ResultPanel
      tone="info"
      title="Nada por aqui"
      actions={
        <LinkButton href="/" variant="primary" icon={<ArrowLeftIcon />}>
          Voltar ao início
        </LinkButton>
      }
    >
      Confira o endereço ou volte para o início.
    </ResultPanel>
  </AuthLayout>
);
