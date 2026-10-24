import { v } from "@shared/application/validator";
import { Handler, Inbound } from "@shared/presentation/handler";

import { toSessionOrigin } from "./mappers/toSessionOrigin";

import {
  RefreshSessionInput,
  RefreshSessionOutput,
} from "@/identity/application/use-cases/refresh-session.types";
import { RefreshSessionUseCase } from "@/identity/application/use-cases/refresh-session.use-case";

const inputSchema = v.object<Pick<RefreshSessionInput, "refreshToken">>({
  refreshToken: v.string(),
});

export type RefreshSessionHandlerDeps = {
  refreshSession: RefreshSessionUseCase;
};

export class RefreshSessionHandler extends Handler<{
  deps: RefreshSessionHandlerDeps;
  output: RefreshSessionOutput;
}> {
  async handle(inbound: Inbound): Promise<RefreshSessionOutput> {
    const input = inputSchema.probe(inbound.input);
    return this.deps.refreshSession.execute({
      ...input,
      ...toSessionOrigin(inbound),
    });
  }
}
