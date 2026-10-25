import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { url } from "./url";

const ok = (data: unknown) => ({ ok: true, data });
const fail = (reason: string) => ({
  ok: false,
  violations: [{ field: "", reason }],
});

const buildAddress = () =>
  `https://${faker.internet.domainName()}/${faker.string.alpha({ length: 8, casing: "mixed" })}?code=${faker.string.alphanumeric(12)}`;

describe("url", () => {
  it("parses an http or https string into a URL, trimmed", () => {
    const address = buildAddress();
    const http = address.replace("https:", "http:");

    expect(url().parse(`  ${address}  `)).toEqual(ok(new URL(address)));
    expect(url().parse(http)).toEqual(ok(new URL(http)));
  });

  it("returns a URL instance", () => {
    const parsed = url().parse(buildAddress());

    expect(parsed.ok && parsed.data).toBeInstanceOf(URL);
  });

  it("accepts a URL instance and returns a copy", () => {
    const input = new URL(buildAddress());

    const parsed = url().parse(input);

    expect(parsed).toEqual(ok(input));
    expect(parsed.ok && parsed.data).not.toBe(input);
  });

  it.each([
    ["a number", faker.number.int()],
    ["a word", faker.lorem.word()],
    ["a domain without protocol", faker.internet.domainName()],
    ["a blank string", "   "],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a mailto: URL", `mailto:${faker.internet.email()}`],
    ["an ftp URL", `ftp://${faker.internet.domainName()}`],
    ["an ftp URL instance", new URL(`ftp://${faker.internet.domainName()}`)],
  ])("rejects %s as invalid_url by default", (_, input) => {
    expect(url().parse(input)).toEqual(fail("invalid_url"));
  });

  it("accepts only the protocols given, without the colon", () => {
    const ftp = `ftp://${faker.internet.domainName()}/`;
    const schema = url({ protocols: ["ftp"] });

    expect(schema.parse(ftp)).toEqual(ok(new URL(ftp)));
    expect(schema.parse(buildAddress())).toEqual(fail("invalid_url"));
  });

  describe("missing values", () => {
    it("requires a value by default", () => {
      expect(url().parse(undefined)).toEqual(fail("required"));
    });

    it("uses the default when the value is missing", () => {
      const fallback = new URL(buildAddress());

      expect(url({ default: fallback }).parse(undefined)).toEqual(ok(fallback));
    });

    it("accepts undefined when optional", () => {
      expect(url({ optional: true }).parse(undefined)).toEqual(ok(undefined));
    });

    it("accepts null when nullable", () => {
      expect(url({ nullable: true }).parse(null)).toEqual(ok(null));
    });
  });

  it("applies transform to the parsed URL", () => {
    const path = faker.lorem.word();
    const schema = url({ transform: (value) => new URL(path, value) });
    const address = buildAddress();

    expect(schema.parse(address)).toEqual(ok(new URL(path, address)));
  });

  it("reports refine violations after a successful parse", () => {
    const reason = faker.lorem.slug();
    const schema = url({
      refine: [{ check: (value) => value.protocol === "ftp:", reason }],
    });

    expect(schema.parse(buildAddress())).toEqual(fail(reason));
  });
});
