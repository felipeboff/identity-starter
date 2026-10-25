import { describe, expect, it } from "vitest";

import { useMemoryMongo } from "./memory-mongo";

describe("useMemoryMongo", () => {
  const mongo = useMemoryMongo();

  it("connects to a replica set member", async () => {
    const hello = await mongo.connection().db?.admin().command({ hello: 1 });

    expect(hello?.setName).toEqual(expect.any(String));
  });
});
