import { RabbitMQContainer } from "@testcontainers/rabbitmq";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    rabbitmqUrl: string;
    rabbitmqApiUrl: string;
  }
}

const MANAGEMENT_PORT = 15672;

export default async function setup(project: TestProject) {
  const container = await new RabbitMQContainer(
    "rabbitmq:4-management",
  ).start();
  project.provide("rabbitmqUrl", container.getAmqpUrl());
  project.provide(
    "rabbitmqApiUrl",
    `http://${container.getHost()}:${container.getMappedPort(MANAGEMENT_PORT)}/api`,
  );

  return async () => {
    await container.stop();
  };
}
