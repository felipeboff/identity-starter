import { describe, expect, it } from "vitest";

import { buildOutgoingEmail } from "./build-outgoing-email";
import { FakeMailSender } from "./fake-mail-sender";

describe("FakeMailSender", () => {
  it("keeps every e-mail it is asked to send, in order", async () => {
    const sender = new FakeMailSender();
    const emails = [buildOutgoingEmail(), buildOutgoingEmail()];

    for (const email of emails) await sender.send(email);

    expect(sender.sent).toStrictEqual(emails);
  });
});
