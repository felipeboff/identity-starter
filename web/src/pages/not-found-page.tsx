import { useMessages } from "../hooks/use-messages";
import { AuthLayout } from "../layouts/auth-layout";
import { LinkButton } from "../ui/button";
import { ResultPanel } from "../ui/feedback";
import { ArrowLeftIcon } from "../ui/icons";

export const NotFoundPage = () => {
  const t = useMessages();
  return (
    <AuthLayout
      title={t.notFound.title}
      eyebrow="404"
      tagline={t.notFound.tagline}
    >
      <ResultPanel
        tone="info"
        title={t.notFound.nothingHere}
        actions={
          <LinkButton href="/" variant="primary" icon={<ArrowLeftIcon />}>
            {t.notFound.backHome}
          </LinkButton>
        }
      >
        {t.notFound.description}
      </ResultPanel>
    </AuthLayout>
  );
};
