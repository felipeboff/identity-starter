import { useMessages } from "../hooks/use-messages";
import { ALL_LOCALES, LOCALE_LABELS } from "../i18n/locale-store";
import { localeStore } from "../services";

import { GlobeIcon } from "./icons";

export const LocaleSwitch = () => {
  const t = useMessages();
  return (
    <div class="locale-switch" role="group" aria-label={t.common.language}>
      <GlobeIcon size={14} />
      {ALL_LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          class="locale-option"
          lang={locale}
          title={LOCALE_LABELS[locale].name}
          aria-label={LOCALE_LABELS[locale].name}
          aria-pressed={locale === localeStore.locale}
          onClick={() => localeStore.change(locale)}
        >
          {LOCALE_LABELS[locale].short}
        </button>
      ))}
    </div>
  );
};
