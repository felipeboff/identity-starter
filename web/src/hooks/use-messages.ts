import { useEffect, useState } from "preact/hooks";

import type { Messages } from "../i18n/messages/en";
import { localeStore } from "../services";

export const useMessages = (): Messages => {
  const [, setLocale] = useState(localeStore.locale);
  useEffect(() => localeStore.subscribe(setLocale), []);
  return localeStore.messages;
};
