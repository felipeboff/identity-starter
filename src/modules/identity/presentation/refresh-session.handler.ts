import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { toSessionOrigin } from "./mappers/toSessionOrigin";
import { signedInOutputFields } from "./output.schema";

import { RefreshSessionOutput } from "@/identity/application/use-cases/refresh-session.types";
import { RefreshSessionUseCase } from "@/identity/application/use-cases/refresh-session.use-case";

const inputSchema = Type.Object({
  refreshToken: Type.String(),
});

type Input = Type.StaticDecode<typeof inputSchema>;

const outputSchema = Type.Object(signedInOutputFields);

export type RefreshSessionHandlerDeps = {
  refreshSession: RefreshSessionUseCase;
};

export class RefreshSessionHandler extends Handler<{
  deps: RefreshSessionHandlerDeps;
  input: typeof inputSchema;
  output: typeof outputSchema;
}> {
  readonly name = "identity.refresh_session";
  readonly input = inputSchema;
  readonly output = outputSchema;

  async handle(
    inbound: Inbound<undefined, Input>,
  ): Promise<RefreshSessionOutput> {
    return this.deps.refreshSession.execute({
      ...inbound.input,
      ...toSessionOrigin(inbound),
    });
  }
}
