import { faker } from "@faker-js/faker";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";
import { SharedError } from "@shared/domain/errors/shared.error";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, expect, it } from "vitest";

import { AccountRepository } from "../../ports/account.repository";

import type { RepositoryUnderContract } from "./repository-under-contract";
import { transactionalSaveContract } from "./transactional-save.contract";

import { Account } from "@/identity/domain/account.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";

const registerAccount = (
  email = faker.internet.email(),
  id = faker.database.mongodbObjectId(),
) =>
  Account.register(
    { id, name: faker.person.fullName(), email, createdBy: id },
    faker.date.past(),
  );

export const accountRepositoryContract = (
  createRepository: () => RepositoryUnderContract<AccountRepository>,
) => {
  let accounts: AccountRepository;
  let transactions: TransactionRunner;

  beforeEach(() => {
    ({ repository: accounts, transactions } = createRepository());
  });

  const load = async (account: Account) =>
    (await accounts.findById(account.id.value)) as Account;

  transactionalSaveContract(() => ({
    transactions,
    register: () => registerAccount(),
    save: (entity) => accounts.save(entity),
    load,
  }));

  it("saves a new account at version 1 and finds it by id", async () => {
    const account = registerAccount();

    await accounts.save(account);

    expect(account.version).toBe(1);
    expect((await load(account)).toSnapshot()).toStrictEqual(
      account.toSnapshot(),
    );
  });

  it("keeps every field across a save and a load", async () => {
    const account = registerAccount();
    await accounts.save(account);
    const loaded = await load(account);
    const at = faker.date.recent();
    loaded.markEmailAsVerified(at);
    loaded.markAsLastSeen(at);
    loaded.markAsDeleted(at);

    await accounts.save(loaded);

    expect((await load(account)).toSnapshot()).toStrictEqual({
      ...loaded.toSnapshot(),
      version: 2,
    });
  });

  it("saves the same instance again after changing it", async () => {
    const account = registerAccount();
    await accounts.save(account);
    const name = faker.person.fullName();
    account.updateName(name, faker.date.recent());

    await accounts.save(account);

    expect((await load(account)).toSnapshot()).toMatchObject({
      name,
      version: 2,
    });
  });

  it("keeps the stored account when the transaction fails", async () => {
    const account = registerAccount();
    await accounts.save(account);
    const { name } = account.toSnapshot();
    const failure = new Error(faker.lorem.sentence());

    await expect(
      transactions.run(async () => {
        account.updateName(faker.person.fullName(), faker.date.recent());
        await accounts.save(account);
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect((await load(account)).toSnapshot()).toMatchObject({
      name,
      version: 1,
    });
    expect(account.version).toBe(1);
  });

  it("does not show a change that was not saved", async () => {
    const account = registerAccount();
    await accounts.save(account);
    const { name } = account.toSnapshot();

    account.updateName(faker.person.fullName(), faker.date.recent());

    expect((await load(account)).name).toBe(name);
  });

  it("finds an account by its email, in any case", async () => {
    const account = registerAccount();
    await accounts.save(account);

    const found = await accounts.findByEmail(account.email.value.toUpperCase());

    expect(found?.id.value).toBe(account.id.value);
  });

  it.each([
    ["id", () => accounts.findById(faker.database.mongodbObjectId())],
    ["email", () => accounts.findByEmail(faker.internet.email())],
  ])("returns null for an unknown %s", async (_, find) => {
    expect(await find()).toBeNull();
  });

  it("refuses to save an account changed by someone else since it was loaded", async () => {
    const account = registerAccount();
    await accounts.save(account);
    const first = await load(account);
    const second = await load(account);
    first.updateName(faker.person.fullName(), faker.date.recent());
    await accounts.save(first);
    second.updateName(faker.person.fullName(), faker.date.recent());

    await expectAppError(accounts.save(second), SharedError.VersionConflict, {
      id: account.id.value,
      version: 1,
    });

    expect((await load(account)).name).toBe(first.name);
  });

  it("refuses a new account with an id already stored", async () => {
    const account = registerAccount();
    await accounts.save(account);

    await expectAppError(
      accounts.save(registerAccount(undefined, account.id.value)),
      SharedError.AlreadyExists,
      { id: account.id.value },
    );
  });

  it("refuses a second account with an email already taken", async () => {
    const taken = registerAccount();
    await accounts.save(taken);

    await expectAppError(
      accounts.save(registerAccount(taken.email.value)),
      IdentityError.AccountEmailTaken,
      { email: taken.email.value },
    );
  });
};
