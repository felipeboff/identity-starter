import { faker } from "@faker-js/faker";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";
import { beforeEach, expect, it } from "vitest";

import { MembershipRepository } from "../../ports/memberships.repository";

import type { RepositoryUnderContract } from "./repository-under-contract";
import { transactionalSaveContract } from "./transactional-save.contract";

import {
  Membership,
  MembershipPermission,
  MembershipRole,
} from "@/identity/domain/membership.entity";

const registerMembership = () => {
  const accountId = faker.database.mongodbObjectId();
  return Membership.register(
    {
      id: faker.database.mongodbObjectId(),
      accountId,
      createdBy: accountId,
      role: MembershipRole.USER,
      permissions: [MembershipPermission.READ, MembershipPermission.WRITE],
    },
    faker.date.past(),
  );
};

export const membershipRepositoryContract = (
  createRepository: () => RepositoryUnderContract<MembershipRepository>,
) => {
  let memberships: MembershipRepository;
  let transactions: TransactionRunner;

  beforeEach(() => {
    ({ repository: memberships, transactions } = createRepository());
  });

  const load = async (membership: Membership) =>
    (await memberships.findById(membership.id.value)) as Membership;

  transactionalSaveContract(() => ({
    transactions,
    register: () => registerMembership(),
    save: (entity) => memberships.save(entity),
    load,
  }));

  it("keeps every field of a membership", async () => {
    const membership = registerMembership();

    await memberships.save(membership);

    expect(membership.version).toBe(1);
    expect((await load(membership)).toSnapshot()).toStrictEqual(
      membership.toSnapshot(),
    );
  });

  it("keeps a change saved on the same instance", async () => {
    const membership = registerMembership();
    await memberships.save(membership);
    membership.updateRole(MembershipRole.ADMIN, faker.date.recent());

    await memberships.save(membership);

    expect((await load(membership)).toSnapshot()).toStrictEqual({
      ...membership.toSnapshot(),
      version: 2,
    });
  });

  it("finds a membership by its account", async () => {
    const membership = registerMembership();
    await memberships.save(membership);

    const found = await memberships.findByAccountId(
      membership.toSnapshot().accountId,
    );

    expect(found?.id.value).toBe(membership.id.value);
  });

  it.each([
    ["id", () => memberships.findById(faker.database.mongodbObjectId())],
    [
      "account",
      () => memberships.findByAccountId(faker.database.mongodbObjectId()),
    ],
  ])("returns null for an unknown %s", async (_, find) => {
    expect(await find()).toBeNull();
  });
};
