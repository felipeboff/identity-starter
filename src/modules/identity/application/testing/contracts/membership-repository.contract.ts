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

const registerMembership = (id = faker.database.mongodbObjectId()) => {
  const accountId = faker.database.mongodbObjectId();
  return Membership.register(
    {
      id,
      accountId,
      createdBy: accountId,
      role: MembershipRole.USER,
      permissions: [
        MembershipPermission.INVITATION_READ,
        MembershipPermission.INVITATION_REVOKE,
      ],
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

  it("lists memberships after a cursor in id order, up to the limit", async () => {
    const prefix = faker.string.hexadecimal({
      length: 18,
      casing: "lower",
      prefix: "",
    });
    const [first, second, third] = ["000001", "000002", "000003"].map(
      (suffix) => registerMembership(`${prefix}${suffix}`),
    ) as [Membership, Membership, Membership];
    await memberships.save(third);
    await memberships.save(first);
    await memberships.save(second);

    const page = await memberships.list({ after: `${prefix}000000`, limit: 2 });
    const next = await memberships.list({ after: second.id.value, limit: 1 });

    expect(page.map((membership) => membership.id.value)).toStrictEqual([
      first.id.value,
      second.id.value,
    ]);
    expect(next.map((membership) => membership.id.value)).toStrictEqual([
      third.id.value,
    ]);
  });

  it("lists from the lowest id without a cursor", async () => {
    const membership = registerMembership();
    await memberships.save(membership);

    const page = await memberships.list({ after: null, limit: 1 });

    expect(page).toHaveLength(1);
    expect(page[0].id.value <= membership.id.value).toBe(true);
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
