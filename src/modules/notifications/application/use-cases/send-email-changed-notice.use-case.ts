import { Access, UseCase } from "@shared/application/use-cases";

import {
  SendEmailChangedNoticeDeps,
  SendEmailChangedNoticeInput,
} from "./send-email-changed-notice.types";

export class SendEmailChangedNoticeUseCase extends UseCase<{
  input: SendEmailChangedNoticeInput;
  deps: SendEmailChangedNoticeDeps;
}> {
  readonly access = Access.ANYONE;

  async execute(input: SendEmailChangedNoticeInput): Promise<void> {
    await this.deps.mailer.sendEmailChanged(input);
  }
}
