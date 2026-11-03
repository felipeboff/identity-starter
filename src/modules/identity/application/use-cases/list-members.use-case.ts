import { UseCase } from "@shared/application/use-cases";

import { Actor } from "../actor";
import { toOutputAccount } from "../mappers/toOutputAccount";
import { toOutputMembership } from "../mappers/toOutputMembership";

import {
  ListMembersDeps,
  ListMembersInput,
  ListMembersOutput,
  ListedMember,
} from "./list-members.types";

import { IdentityPermission } from "@/identity/domain/identity.permission";

export class ListMembersUseCase extends UseCase<{
  input: ListMembersInput;
  output: ListMembersOutput;
  deps: ListMembersDeps;
  actor: Actor;
}> {
  readonly access = { permissions: [IdentityPermission.MEMBER_READ] };

  async execute(
    input: ListMembersInput,
    _actor: Actor,
  ): Promise<ListMembersOutput> {
    const page = this.deps.pager.pageOf({
      fetched: await this.deps.memberships.list(
        this.deps.pager.queryFor(input),
      ),
      request: input,
      cursorOf: (membership) => membership.id.value,
    });
    const accounts = await this.deps.accounts.findByIds(
      page.items.map((membership) => membership.accountId.value),
    );
    const accountsById = new Map(
      accounts.map((account) => [account.id.value, account]),
    );

    return {
      members: page.items.flatMap((membership): ListedMember[] => {
        const account = accountsById.get(membership.accountId.value);
        if (!account || membership.isDeleted()) return [];
        return [
          {
            account: toOutputAccount(account),
            membership: toOutputMembership(membership),
          },
        ];
      }),
      nextCursor: page.nextCursor,
    };
  }
}
