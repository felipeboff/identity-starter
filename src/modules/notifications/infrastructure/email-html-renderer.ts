import type {
  EmailLayout,
  OutgoingEmail,
} from "@shared/application/ports/mail-sender";

const FONT =
  "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', SFMono-Regular, Menlo, Consolas, monospace";

const COLOR = {
  ground: "#f3f2ff",
  card: "#ffffff",
  sunken: "#f1f1f7",
  line: "#e4e4ee",
  ink: "#0e0e1b",
  muted: "#686880",
  subtle: "#9a9ab0",
  violet: "#4733ff",
  violetSoft: "#eeebff",
  warning: "#a66300",
  warningSoft: "#fff4dc",
} as const;

const BANNER = [
  "background-color:#c9b9ff",
  "background-image:" +
    [
      "radial-gradient(60% 90% at 18% 70%, rgba(74,44,245,0.85) 0%, rgba(74,44,245,0) 70%)",
      "radial-gradient(45% 80% at 92% 10%, rgba(182,109,255,0.9) 0%, rgba(182,109,255,0) 72%)",
      "radial-gradient(50% 90% at 70% 80%, rgba(205,238,255,0.95) 0%, rgba(205,238,255,0) 72%)",
      "linear-gradient(160deg, #a9e6ff 0%, #c9b9ff 45%, #e9ebff 100%)",
    ].join(","),
].join(";");

const MARK =
  '<svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true" style="display:block">' +
  '<g stroke="#ffffff" stroke-width="5" stroke-linecap="round">' +
  '<path d="M16 3.5v25"/><path d="M5.2 9.75l21.6 12.5"/><path d="M5.2 22.25l21.6-12.5"/>' +
  "</g></svg>";

const TABLE = 'role="presentation" cellpadding="0" cellspacing="0"';

export type EmailHtmlRendererDeps = Readonly<{
  productName: string;
}>;

export class EmailHtmlRenderer {
  constructor(private readonly deps: EmailHtmlRendererDeps) {}

  render(email: OutgoingEmail): string {
    const layout = email.layout;
    const product = this.escape(this.deps.productName);
    return [
      '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      `<title>${this.escape(email.subject)}</title></head>`,
      `<body style="margin:0;padding:0;background:${COLOR.ground}">`,
      `<div style="display:none;max-height:0;overflow:hidden">${this.escape(layout.paragraphs.join(" "))}</div>`,
      `<table ${TABLE} width="100%" style="background:${COLOR.ground};font-family:${FONT};color:${COLOR.ink}">`,
      '<tr><td align="center" style="padding:32px 12px 28px">',
      `<table ${TABLE} width="100%" style="max-width:560px">`,
      `<tr><td style="background:${COLOR.card};border-radius:28px;padding:12px;box-shadow:0 30px 60px -36px rgba(71,51,255,0.35),0 0 0 1px rgba(71,51,255,0.04)">`,
      `<table ${TABLE} width="100%">`,
      `<tr><td style="border-radius:20px;${BANNER};padding:22px 24px 26px">`,
      `<table ${TABLE} width="100%"><tr>`,
      `<td style="vertical-align:middle;width:30px">${MARK}</td>`,
      `<td style="vertical-align:middle;padding-left:10px;font-size:14px;font-weight:600;color:#ffffff">${product}</td>`,
      `<td align="right" style="vertical-align:middle;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#ffffff">${this.escape(layout.category)}</td>`,
      "</tr></table></td></tr>",
      '<tr><td style="padding:30px 22px 26px">',
      `<h1 style="margin:0 0 18px;font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.025em;color:${COLOR.ink}">${this.escape(layout.title)}</h1>`,
      this.paragraphs(layout),
      this.alert(layout),
      this.action(email),
      this.validity(layout),
      this.writtenLink(email),
      "</td></tr></table></td></tr>",
      '<tr><td style="padding:20px 18px 0">',
      `<p style="margin:0 0 6px;font-size:12.5px;line-height:1.5;color:${COLOR.muted}">${this.escape(layout.footnote)}</p>`,
      `<p style="margin:0;font-size:12px;color:${COLOR.subtle}">${product} · e-mail automático, não responda</p>`,
      "</td></tr></table></td></tr></table></body></html>",
    ].join("");
  }

  private paragraphs(layout: EmailLayout): string {
    return layout.paragraphs
      .map((paragraph, index) => {
        const color = index === 0 ? COLOR.ink : COLOR.muted;
        const gap = index === layout.paragraphs.length - 1 ? 0 : 12;
        return `<p style="margin:0 0 ${gap}px;font-size:15px;line-height:1.6;color:${color}">${this.escape(paragraph)}</p>`;
      })
      .join("");
  }

  private alert(layout: EmailLayout): string {
    if (layout.alert === null) return "";
    return `<p style="margin:22px 0 0;padding:14px 16px;border-radius:12px;background:${COLOR.warningSoft};color:${COLOR.warning};font-size:14px;font-weight:600;line-height:1.5">${this.escape(layout.alert)}</p>`;
  }

  private action(email: OutgoingEmail): string {
    if (email.link === null || email.layout.action === null) return "";
    return (
      `<table ${TABLE} style="margin-top:26px"><tr>` +
      `<td style="border-radius:9px;background:${COLOR.violet};box-shadow:0 10px 22px -8px rgba(71,51,255,0.7)">` +
      `<a href="${this.escape(email.link)}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:14px;font-weight:600;line-height:18px;color:#ffffff;text-decoration:none;border-radius:9px">${this.escape(email.layout.action)}</a>` +
      "</td></tr></table>"
    );
  }

  private validity(layout: EmailLayout): string {
    if (layout.validity === null) return "";
    return `<p style="margin:18px 0 0"><span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${COLOR.violetSoft};color:${COLOR.violet};font-size:12px;font-weight:600;line-height:1.5">${this.escape(layout.validity)}</span></p>`;
  }

  private writtenLink(email: OutgoingEmail): string {
    if (email.link === null) return "";
    return (
      `<div style="margin-top:24px;padding-top:20px;border-top:1px solid ${COLOR.line}">` +
      `<p style="margin:0 0 8px;font-size:12.5px;color:${COLOR.muted}">Se o botão não abrir, copie este endereço no navegador:</p>` +
      `<p style="margin:0;padding:10px 12px;border-radius:9px;background:${COLOR.sunken};font-family:${MONO};font-size:12px;line-height:1.5;color:${COLOR.ink};word-break:break-all">${this.escape(email.link)}</p>` +
      "</div>"
    );
  }

  private escape(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }
}
