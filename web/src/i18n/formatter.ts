import type { Locale, LocaleStore } from "./locale-store";

export type DeviceDescription = {
  label: string;
  mobile: boolean;
};

type LocaleFormats = {
  dateTime: Intl.DateTimeFormat;
  date: Intl.DateTimeFormat;
  time: Intl.DateTimeFormat;
  relative: Intl.RelativeTimeFormat;
};

const BROWSERS: ReadonlyArray<[RegExp, string]> = [
  [/Edg\//, "Edge"],
  [/OPR\//, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: ReadonlyArray<[RegExp, string]> = [
  [/Windows/, "Windows"],
  [/Android/, "Android"],
  [/iPhone|iPad/, "iOS"],
  [/Mac OS X/, "macOS"],
  [/Linux/, "Linux"],
];

const RELATIVE_UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

export class Formatter {
  private readonly cache = new Map<Locale, LocaleFormats>();

  constructor(private readonly locales: LocaleStore) {}

  dateTime(iso: string): string {
    return this.formats.dateTime.format(new Date(iso));
  }

  date(iso: string): string {
    return this.formats.date.format(new Date(iso));
  }

  time(date: Date): string {
    return this.formats.time.format(date);
  }

  relative(iso: string): string {
    const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
    for (const [unit, size] of RELATIVE_UNITS) {
      if (Math.abs(seconds) >= size) {
        return this.formats.relative.format(Math.round(seconds / size), unit);
      }
    }
    return this.formats.relative.format(0, "second");
  }

  device(userAgent: string): DeviceDescription {
    const messages = this.locales.messages.format;
    const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
    const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
    const mobile = /Mobile|Android|iPhone/.test(userAgent);
    if (browser && system) {
      return { label: messages.deviceOn(browser, system), mobile };
    }
    return {
      label: browser ?? system ?? (userAgent || messages.unknownDevice),
      mobile,
    };
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const letters = parts.length > 1 ? [parts[0], parts.at(-1)] : parts;
    return (
      letters.map((part) => part?.[0]?.toUpperCase() ?? "").join("") || "?"
    );
  }

  searchKey(text: string): string {
    return text
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase(this.locales.locale);
  }

  firstName(name: string): string {
    return name.trim().split(/\s+/)[0] ?? name;
  }

  private get formats(): LocaleFormats {
    const locale = this.locales.locale;
    const cached = this.cache.get(locale);
    if (cached) return cached;
    const formats: LocaleFormats = {
      dateTime: new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
      date: new Intl.DateTimeFormat(locale, { dateStyle: "long" }),
      time: new Intl.DateTimeFormat(locale, { timeStyle: "medium" }),
      relative: new Intl.RelativeTimeFormat(locale, { numeric: "auto" }),
    };
    this.cache.set(locale, formats);
    return formats;
  }
}
