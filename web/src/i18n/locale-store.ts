import { en, type Messages } from "./messages/en";
import { ptBr } from "./messages/pt-br";

export type Locale = "en" | "pt-BR";

export type LocaleListener = (locale: Locale) => void;

export type LocaleLabel = {
  short: string;
  name: string;
};

export const ALL_LOCALES: readonly Locale[] = ["en", "pt-BR"];

export const LOCALE_LABELS: Record<Locale, LocaleLabel> = {
  en: { short: "EN", name: "English" },
  "pt-BR": { short: "PT", name: "Português" },
};

const DEFAULT_LOCALE: Locale = "en";

const STORAGE_KEY = `${import.meta.env.VITE_APP_NAME}.locale`;

const CATALOGS: Record<Locale, Messages> = {
  en,
  "pt-BR": ptBr,
};

export class LocaleStore {
  private readonly listeners = new Set<LocaleListener>();
  private current: Locale;

  constructor(private readonly storage: Storage) {
    const stored = this.storage.getItem(STORAGE_KEY);
    this.current = stored && this.isLocale(stored) ? stored : DEFAULT_LOCALE;
    document.documentElement.lang = this.current;
  }

  get locale(): Locale {
    return this.current;
  }

  get messages(): Messages {
    return CATALOGS[this.current];
  }

  change(locale: Locale): void {
    if (locale === this.current) return;
    this.current = locale;
    this.storage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale;
    for (const listener of this.listeners) listener(locale);
  }

  isLocale(value: string): value is Locale {
    return (ALL_LOCALES as readonly string[]).includes(value);
  }

  subscribe(listener: LocaleListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
