import { faker } from "@faker-js/faker";
import { buildOutgoingEmail } from "@shared/testing/build-outgoing-email";
import { describe, expect, it } from "vitest";

import { EmailHtmlRenderer } from "./email-html-renderer";

const WRITTEN_LINK_NOTE =
  "Se o botão não abrir, copie este endereço no navegador:";

describe("EmailHtmlRenderer", () => {
  it("renders the layout of an e-mail with a link: banner, title, paragraphs, button, written-out link, validity and footnote", () => {
    const productName = faker.company.buzzNoun();
    const email = buildOutgoingEmail();
    const layout = email.layout;

    const html = new EmailHtmlRenderer({ productName }).render(email);

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain(`<title>${email.subject}</title>`);
    expect(html).toContain(`>${productName}</td>`);
    expect(html).toContain(`>${layout.category}</td>`);
    expect(html).toContain(`>${layout.title}</h1>`);
    const [first, second] = layout.paragraphs;
    expect(html.indexOf(`>${first}</p>`)).toBeGreaterThan(-1);
    expect(html.indexOf(`>${second}</p>`)).toBeGreaterThan(
      html.indexOf(`>${first}</p>`),
    );
    expect(html).toMatch(
      new RegExp(`<a href="${email.link}"[^>]*>${layout.action}</a>`),
    );
    expect(html).toContain(WRITTEN_LINK_NOTE);
    expect(html).toContain(`>${email.link}</p>`);
    expect(html).toContain(`>${layout.validity}</span>`);
    expect(html).toContain(`>${layout.footnote}</p>`);
    expect(html).toContain(
      `>${productName} · e-mail automático, não responda</p>`,
    );
  });

  it("renders no button for an e-mail with no link, and the alert in its highlighted box", () => {
    const email = buildOutgoingEmail({ link: null, expiresAt: null });
    const alert = faker.lorem.sentence();
    const layout = { ...email.layout, action: null, validity: null, alert };

    const html = new EmailHtmlRenderer({
      productName: faker.company.buzzNoun(),
    }).render({ ...email, layout });

    expect(html).not.toContain("<a ");
    expect(html).not.toContain(WRITTEN_LINK_NOTE);
    expect(html).toMatch(
      new RegExp(`<p style="[^"]*background:#fff4dc[^"]*">${alert}</p>`),
    );
  });

  it("renders the written-out link and no button when the layout names no action", () => {
    const email = buildOutgoingEmail();
    const layout = { ...email.layout, action: null };

    const html = new EmailHtmlRenderer({
      productName: faker.company.buzzNoun(),
    }).render({ ...email, layout });

    expect(html).not.toContain("<a ");
    expect(html).toContain(`>${email.link}</p>`);
  });

  it('escapes <, >, & and " in the product name, the layout and the link', () => {
    const unsafe = `<script>alert("${faker.lorem.word()}")</script> & co`;
    const escaped = unsafe
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
    const email = buildOutgoingEmail({
      subject: unsafe,
      link: `https://example.com/?a=1&b="${faker.lorem.word()}"`,
      layout: {
        category: unsafe,
        title: unsafe,
        paragraphs: [unsafe],
        action: unsafe,
        validity: unsafe,
        alert: unsafe,
        footnote: unsafe,
      },
    });

    const html = new EmailHtmlRenderer({ productName: unsafe }).render(email);

    expect(html).not.toContain("<script>");
    expect(html.split(escaped).length - 1).toBe(11);
    expect(html).toContain(
      `href="${(email.link ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;")}"`,
    );
  });
});
