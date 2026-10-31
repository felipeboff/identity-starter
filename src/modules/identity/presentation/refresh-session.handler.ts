import { Handler, Inbound } from "@shared/presentation/handler";
import Type from "typebox";

import { toSessionOrigin } from "./mappers/toSessionOrigin";

import { RefreshSessionOutput } from "@/identity/application/use-cases/refresh-session.types";
import { RefreshSessionUseCase } from "@/identity/application/use-cases/refresh-session.use-case";

const inputSchema = Type.Object({
  refreshToken: Type.String(),
});

type Input = Type.StaticDecode<typeof inputSchema>;

export type RefreshSessionHandlerDeps = {
  refreshSession: RefreshSessionUseCase;
};

export class RefreshSessionHandler extends Handler<{
  deps: RefreshSessionHandlerDeps;
  input: typeof inputSchema;
  output: RefreshSessionOutput;
}> {
  readonly name = "identity.refresh_session";
  readonly input = inputSchema;

  async handle(
    inbound: Inbound<undefined, Input>,
  ): Promise<RefreshSessionOutput> {
    return this.deps.refreshSession.execute({
      ...inbound.input,
      ...toSessionOrigin(inbound),
    });
  }
}
