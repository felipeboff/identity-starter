import { faker } from "@faker-js/faker";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";
import { beforeEach, expect, it } from "vitest";

import { InvitationRepository } from "../../ports/invitation.repository";

import type { RepositoryUnderContract } from "./repository-under-contract";
import { transactionalSaveContract } from "./transactional-save.contract";

import { IdentityPermission } from "@/identity/domain/identity.permission";
import { Invitation } from "@/identity/domain/invitation.entity";
import { MembershipRole } from "@/identity/domain/membership.entity";

const tokenHash = () => faker.string.hexadecimal({ length: 64, prefix: "" });

const registerInvitation = (
  email = faker.internet.email().toLowerCase(),
  at = faker.date.past(),
) =>
  Invitation.register(
    {
      id: faker.database.mongodbObjectId(),
      email,
      role: faker.helpers.arrayElement(Object.values(MembershipRole)),
      permissions: faker.helpers.arrayElements(
        Object.values(IdentityPermission),
      ),
      tokenHash: tokenHash(),
      expiresAt: faker.date.future(),
      createdBy: faker.database.mongodbObjectId(),
    },
    at,
  );

export const invitationRepositoryContract = (
  createRepository: () => RepositoryUnderContract<InvitationRepository>,
) => {
  let invitations: InvitationRepository;
  let transactions: TransactionRunner;

  beforeEach(() => {
    ({ repository: invitations, transactions } = createRepository());
  });

  const load = async (entity: Invitation) =>
    (await invitations.findById(entity.id.value)) as Invitation;

  transactionalSaveContract(() => ({
    transactions,
    register: () => registerInvitation(),
    save: (entity) => invitations.save(entity),
    load,
  }));

  it("keeps every field", async () => {
    const entity = registerInvitation();

    await invitations.save(entity);

    expect(entity.version).toBe(1);
    expect((await load(entity)).toSnapshot()).toStrictEqual(
      entity.toSnapshot(),
    );
  });

  it("keeps a permission code outside the catalog", async () => {
    const entity = registerInvitation();
    const code = `${faker.string.alpha({ length: 10, casing: "lower" })}.${faker.string.alpha({ length: 10, casing: "lower" })}`;
    entity.updatePermissions([code], faker.date.recent());

    await invitations.save(entity);

    expect((await load(entity)).permissions).toStrictEqual([code]);
  });

  it("keeps the acceptance saved on the same instance", async () => {
    const entity = registerInvitation();
    await invitations.save(entity);
    entity.accept(faker.database.mongodbObjectId(), faker.date.recent());

    await invitations.save(entity);

    expect((await load(entity)).toSnapshot()).toStrictEqual({
      ...entity.toSnapshot(),
      version: 2,
    });
  });

  it("finds one by its token hash", async () => {
    const entity = registerInvitation();
    await invitations.save(entity);

    const found = await invitations.findByTokenHash(entity.tokenHash.value);

    expect(found?.id.value).toBe(entity.id.value);
  });

  it.each([
    ["id", () => invitations.findById(faker.database.mongodbObjectId())],
    ["token hash", () => invitations.findByTokenHash(tokenHash())],
  ])("returns null for an unknown %s", async (_, find) => {
    expect(await find()).toBeNull();
  });

  it("lists the ones of one e-mail, and all of them, in creation order", async () => {
    const email = faker.internet.email().toLowerCase();
    const createdAt = faker.date.past();
    const first = registerInvitation(email, createdAt);
    const other = registerInvitation(
      `${faker.string.alpha(6)}.${email}`,
      new Date(createdAt.getTime() + 1_000),
    );
    const second = registerInvitation(
      email,
      new Date(createdAt.getTime() + 2_000),
    );
    await invitations.save(second);
    await invitations.save(other);
    await invitations.save(first);

    const ofEmail = await invitations.listByEmail(email);
    const all = await invitations.list();

    expect(ofEmail.map((entity) => entity.id.value)).toStrictEqual([
      first.id.value,
      second.id.value,
    ]);
    const ours = [first.id.value, other.id.value, second.id.value];
    expect(
      all.map((entity) => entity.id.value).filter((id) => ours.includes(id)),
    ).toStrictEqual(ours);
  });
};
