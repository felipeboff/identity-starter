export type DeviceDescription = {
  label: string;
  mobile: boolean;
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
  private readonly dateTimeFormat = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  private readonly dateFormat = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
  });
  private readonly relativeFormat = new Intl.RelativeTimeFormat("pt-BR", {
    numeric: "auto",
  });

  dateTime(iso: string): string {
    return this.dateTimeFormat.format(new Date(iso));
  }

  date(iso: string): string {
    return this.dateFormat.format(new Date(iso));
  }

  relative(iso: string): string {
    const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
    for (const [unit, size] of RELATIVE_UNITS) {
      if (Math.abs(seconds) >= size) {
        return this.relativeFormat.format(Math.round(seconds / size), unit);
      }
    }
    return "agora";
  }

  device(userAgent: string): DeviceDescription {
    const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
    const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent))?.[1];
    const mobile = /Mobile|Android|iPhone/.test(userAgent);
    if (browser && system) return { label: `${browser} no ${system}`, mobile };
    return {
      label: browser ?? system ?? (userAgent || "Dispositivo desconhecido"),
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
      .toLocaleLowerCase("pt-BR");
  }

  firstName(name: string): string {
    return name.trim().split(/\s+/)[0] ?? name;
  }
}
