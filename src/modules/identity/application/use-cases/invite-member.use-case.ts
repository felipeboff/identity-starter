import { UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { Actor } from "../actor";
import { toPublicInvitation } from "../mappers/toPublicInvitation";
import { INVITATION_TTL_MS } from "../token.policy";

import {
  InviteMemberDeps,
  InviteMemberInput,
  InviteMemberOutput,
} from "./invite-member.types";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { Invitation } from "@/identity/domain/invitation.entity";

export class InviteMemberUseCase extends UseCase<{
  input: InviteMemberInput;
  output: InviteMemberOutput;
  deps: InviteMemberDeps;
  actor: Actor;
}> {
  async execute(
    input: InviteMemberInput,
    actor: Actor,
  ): Promise<InviteMemberOutput> {
    this.deps.accessPolicy.ensureCanInvite(actor);
    this.deps.accessPolicy.ensureCanGrant(actor, input.role, input.permissions);

    const invited = await this.deps.transactions.run(async () => {
      if (await this.deps.accounts.findByEmail(input.email)) {
        throw new AppError(IdentityError.AccountEmailTaken, {
          email: input.email,
        });
      }
      const inviter = await this.deps.accountResolver.resolveActive(
        actor.accountId,
      );
      const at = this.deps.clock.now();

      const previous = await this.deps.invitations.listByEmail(input.email);
      for (const invitation of previous.filter((p) => p.isPending(at))) {
        invitation.revoke(at);
        await this.deps.invitations.save(invitation);
      }

      const { token, tokenHash } = this.deps.tokens.issue();
      const expiresAt = new Date(at.getTime() + INVITATION_TTL_MS);
      const invitation = Invitation.register(
        {
          id: this.deps.ids.next(),
          email: input.email,
          role: input.role,
          permissions: input.permissions,
          tokenHash,
          expiresAt,
          createdBy: actor.accountId,
        },
        at,
      );
      await this.deps.invitations.save(invitation);

      return {
        invitation,
        email: {
          to: invitation.email.value,
          inviterName: inviter.name,
          token,
          expiresAt,
        },
      };
    });

    await this.deps.mailer.sendInvitation(invited.email);
    return { invitation: toPublicInvitation(invited.invitation) };
  }
}
