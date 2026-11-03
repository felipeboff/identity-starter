import { faker } from "@faker-js/faker";
import amqplib from "amqplib";
import { afterAll, beforeAll, inject } from "vitest";

/** The `RabbitMQContainer` default user, admin of the broker. */
const ADMIN = "guest";

type ApiCall = Readonly<{
  method: "PUT" | "DELETE";
  path: string;
  body?: Record<string, string>;
}>;

const callApi = async (call: ApiCall): Promise<void> => {
  await fetch(`${inject("rabbitmqApiUrl")}${call.path}`, {
    method: call.method,
    headers: {
      authorization: `Basic ${Buffer.from(`${ADMIN}:${ADMIN}`).toString("base64")}`,
      "content-type": "application/json",
    },
    body: call.body && JSON.stringify(call.body),
  });
};

/**
 * A broker user of its own per suite, so dropping its connections leaves the
 * other suites' alone, and an admin channel to inspect queues.
 */
export const useRabbitMq = () => {
  const user = faker.string.alpha({ length: 12, casing: "lower" });
  const password = faker.string.alphanumeric(24);
  let admin: amqplib.ChannelModel | undefined;
  let channel: amqplib.Channel | undefined;

  beforeAll(async () => {
    await callApi({
      method: "PUT",
      path: `/users/${user}`,
      body: { password, tags: "" },
    });
    await callApi({
      method: "PUT",
      path: `/permissions/%2F/${user}`,
      body: { configure: ".*", write: ".*", read: ".*" },
    });
    admin = await amqplib.connect(inject("rabbitmqUrl"));
    channel = await admin.createChannel();
  });

  afterAll(async () => {
    await admin?.close();
    await callApi({ method: "DELETE", path: `/users/${user}` });
  });

  return {
    url: () => {
      const url = new URL(inject("rabbitmqUrl"));
      url.username = user;
      url.password = password;
      return url.href;
    },
    channel: () => channel as amqplib.Channel,
    dropConnections: () =>
      callApi({ method: "DELETE", path: `/connections/username/${user}` }),
  };
};
