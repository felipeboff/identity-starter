import { Id } from "@shared/domain/value-objects/id.value-object";
import { describe, expect, it } from "vitest";

import { ObjectIdGenerator } from "./object-id-generator";

describe("ObjectIdGenerator", () => {
  it("returns an id the Id value object accepts", () => {
    const id = new ObjectIdGenerator().next();

    expect(Id.create(id).value).toBe(id);
  });

  it("returns a different id on every call", () => {
    const ids = new ObjectIdGenerator();

    const generated = new Set(Array.from({ length: 100 }, () => ids.next()));

    expect(generated.size).toBe(100);
  });
});
