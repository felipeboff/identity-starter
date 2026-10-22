import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import {
  EMAIL_PATTERN,
  INTEGER_PATTERN,
  ISO_DATE_PATTERN,
  ISO_DATE_TIME_PATTERN,
  NUMBER_PATTERN,
  OBJECT_ID_PATTERN,
  UUID_PATTERN,
} from "./patterns";

describe("NUMBER_PATTERN", () => {
  it.each([
    "0",
    "42",
    "+1",
    "-1",
    "1.5",
    ".5",
    "1.",
    "1e10",
    "1E-2",
    "+1.5e+3",
  ])("accepts %s", (value) => {
    expect(NUMBER_PATTERN.test(value)).toBe(true);
  });

  it.each(["", "abc", "1.2.3", "e10", "--1", "1e", "1e+", " "])(
    "rejects %s",
    (value) => {
      expect(NUMBER_PATTERN.test(value)).toBe(false);
    },
  );
});

describe("INTEGER_PATTERN", () => {
  it.each(["0", "42", "+7", "-13"])("accepts %s", (value) => {
    expect(INTEGER_PATTERN.test(value)).toBe(true);
  });

  it.each(["", "1.5", "1e2", ".5", "abc", "+", "-"])("rejects %s", (value) => {
    expect(INTEGER_PATTERN.test(value)).toBe(false);
  });
});

describe("EMAIL_PATTERN", () => {
  it("accepts a generated e-mail", () => {
    expect(EMAIL_PATTERN.test(faker.internet.email())).toBe(true);
  });

  it.each(["ana@example.com", "ana.souza+news@mail.example.com.br", "a@b.c"])(
    "accepts %s",
    (value) => {
      expect(EMAIL_PATTERN.test(value)).toBe(true);
    },
  );

  it.each([
    "",
    "invalid-email",
    "user@",
    "@example.com",
    "user@example",
    "user example@test.com",
  ])("rejects %s", (value) => {
    expect(EMAIL_PATTERN.test(value)).toBe(false);
  });
});

describe("UUID_PATTERN", () => {
  it.each([
    ["v4", faker.string.uuid()],
    ["v7", faker.string.uuid({ version: 7 })],
  ])("accepts a generated %s uuid", (_, value) => {
    expect(UUID_PATTERN.test(value)).toBe(true);
  });

  it.each([
    "01890a5d-ac96-774b-bcce-b302099a8057",
    "550e8400-e29b-41d4-a716-446655440000",
    "550E8400-E29B-41D4-A716-446655440000",
  ])("accepts %s", (value) => {
    expect(UUID_PATTERN.test(value)).toBe(true);
  });

  it.each([
    "",
    "invalid-uuid",
    "550e8400e29b41d4a716446655440000",
    "550e8400-e29b-41d4-a716-44665544000",
  ])("rejects %s", (value) => {
    expect(UUID_PATTERN.test(value)).toBe(false);
  });
});

describe("OBJECT_ID_PATTERN", () => {
  it("accepts a generated object id", () => {
    expect(OBJECT_ID_PATTERN.test(faker.database.mongodbObjectId())).toBe(true);
  });

  it.each(["507f1f77bcf86cd799439011", "507F1F77BCF86CD799439011"])(
    "accepts %s",
    (value) => {
      expect(OBJECT_ID_PATTERN.test(value)).toBe(true);
    },
  );

  it.each(["", "abc", "507f1f77bcf86cd79943901", "507f1f77bcf86cd7994390111"])(
    "rejects %s",
    (value) => {
      expect(OBJECT_ID_PATTERN.test(value)).toBe(false);
    },
  );
});

describe("ISO_DATE_PATTERN", () => {
  it("accepts the date part of a generated date", () => {
    const day = faker.date.past().toISOString().slice(0, 10);

    expect(ISO_DATE_PATTERN.test(day)).toBe(true);
  });

  it.each(["2026-10-09", "1970-01-01"])("accepts %s", (value) => {
    expect(ISO_DATE_PATTERN.test(value)).toBe(true);
  });

  it.each(["", "2026/10/09", "09-10-2026", "2026-10-09T00:00:00Z", "2026-10"])(
    "rejects %s",
    (value) => {
      expect(ISO_DATE_PATTERN.test(value)).toBe(false);
    },
  );
});

describe("ISO_DATE_TIME_PATTERN", () => {
  it("accepts a generated date in ISO format", () => {
    expect(ISO_DATE_TIME_PATTERN.test(faker.date.past().toISOString())).toBe(
      true,
    );
  });

  it.each([
    "2026-10-09T12:30Z",
    "2026-10-09T12:30:45Z",
    "2026-10-09T12:30:45.1Z",
    "2026-10-09T12:30:45.123Z",
    "2026-10-09T12:30:45+03:00",
    "2026-10-09T12:30:45-03:00",
  ])("accepts %s", (value) => {
    expect(ISO_DATE_TIME_PATTERN.test(value)).toBe(true);
  });

  it.each([
    "",
    "2026-10-09",
    "2026-10-09 12:30:45Z",
    "2026-10-09T12:30:45",
    "2026-10-09T12:30:45.1234Z",
  ])("rejects %s", (value) => {
    expect(ISO_DATE_TIME_PATTERN.test(value)).toBe(false);
  });
});
