import { faker } from "@faker-js/faker";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";
import { SharedError } from "@shared/domain/errors/shared.error";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, expect, it } from "vitest";

import { CredentialRepository } from "../../ports/credential.repository";

import type { RepositoryUnderContract } from "./repository-under-contract";
import { transactionalSaveContract } from "./transactional-save.contract";

import { AuthProvider, Credential } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";

const registerEmailCredential = (
  accountId = faker.database.mongodbObjectId(),
  email = faker.internet.email().toLowerCase(),
  at = faker.date.past(),
) =>
  Credential.register(
    {
      id: faker.database.mongodbObjectId(),
      accountId,
      provider: AuthProvider.EMAIL,
      subject: email,
      providerEmail: email,
      passwordHash: `$${faker.string.alphanumeric(40)}`,
    },
    at,
  );

const registerGoogleCredential = (
  accountId = faker.database.mongodbObjectId(),
  providerEmail: string | null = null,
  at = faker.date.past(),
) =>
  Credential.register(
    {
      id: faker.database.mongodbObjectId(),
      accountId,
      provider: AuthProvider.GOOGLE,
      subject: faker.string.numeric(21),
      providerEmail,
    },
    at,
  );

export const credentialRepositoryContract = (
  createRepository: () => RepositoryUnderContract<CredentialRepository>,
) => {
  let credentials: CredentialRepository;
  let transactions: TransactionRunner;

  beforeEach(() => {
    ({ repository: credentials, transactions } = createRepository());
  });

  const load = async (credential: Credential) =>
    (await credentials.findById(credential.id.value)) as Credential;

  transactionalSaveContract(() => ({
    transactions,
    register: () => registerEmailCredential(),
    save: (entity) => credentials.save(entity),
    load,
  }));

  it.each([
    ["an e-mail credential", () => registerEmailCredential()],
    [
      "an OAuth credential with no password or provider e-mail",
      () => registerGoogleCredential(),
    ],
  ])("keeps every field of %s", async (_, register) => {
    const credential = register();

    await credentials.save(credential);

    expect(credential.version).toBe(1);
    expect((await load(credential)).toSnapshot()).toStrictEqual(
      credential.toSnapshot(),
    );
  });

  it("keeps a change saved on the same instance", async () => {
    const credential = registerEmailCredential();
    await credentials.save(credential);
    credential.markAsDeleted(faker.date.recent());

    await credentials.save(credential);

    expect((await load(credential)).toSnapshot()).toStrictEqual({
      ...credential.toSnapshot(),
      version: 2,
    });
  });

  it("finds an e-mail credential by its e-mail, in any case", async () => {
    const email = faker.internet.email().toLowerCase();
    const credential = registerEmailCredential(undefined, email);
    await credentials.save(credential);

    const found = await credentials.findByEmail(email.toUpperCase());

    expect(found?.id.value).toBe(credential.id.value);
  });

  it("does not find an OAuth credential by its provider e-mail", async () => {
    const email = faker.internet.email().toLowerCase();
    await credentials.save(registerGoogleCredential(undefined, email));

    expect(await credentials.findByEmail(email)).toBeNull();
  });

  it("finds a credential by provider and subject", async () => {
    const credential = registerGoogleCredential();
    await credentials.save(credential);

    const found = await credentials.findByProviderAndSubject(
      AuthProvider.GOOGLE,
      credential.subjectValue(),
    );

    expect(found?.id.value).toBe(credential.id.value);
  });

  it.each([
    ["id", () => credentials.findById(faker.database.mongodbObjectId())],
    ["e-mail", () => credentials.findByEmail(faker.internet.email())],
    [
      "provider and subject",
      () =>
        credentials.findByProviderAndSubject(
          AuthProvider.GITHUB,
          faker.string.numeric(10),
        ),
    ],
  ])("returns null for an unknown %s", async (_, find) => {
    expect(await find()).toBeNull();
  });

  it("lists the credentials of one account in creation order", async () => {
    const accountId = faker.database.mongodbObjectId();
    const createdAt = faker.date.past();
    const first = registerEmailCredential(accountId, undefined, createdAt);
    const second = registerGoogleCredential(
      accountId,
      null,
      new Date(createdAt.getTime() + 1_000),
    );
    await credentials.save(second);
    await credentials.save(registerEmailCredential());
    await credentials.save(first);

    const listed = await credentials.listByAccountId(accountId);

    expect(listed.map((credential) => credential.id.value)).toStrictEqual([
      first.id.value,
      second.id.value,
    ]);
  });

  it("lists nothing for an account with no credentials", async () => {
    expect(
      await credentials.listByAccountId(faker.database.mongodbObjectId()),
    ).toStrictEqual([]);
  });

  it("refuses a new credential with an id already stored", async () => {
    const credential = registerGoogleCredential();
    await credentials.save(credential);
    const sameId = Credential.register(
      {
        id: credential.id.value,
        accountId: faker.database.mongodbObjectId(),
        provider: AuthProvider.GITHUB,
        subject: faker.string.numeric(12),
      },
      faker.date.past(),
    );

    await expectAppError(credentials.save(sameId), SharedError.AlreadyExists, {
      id: credential.id.value,
    });
  });

  it("refuses a second e-mail credential with the same e-mail", async () => {
    const email = faker.internet.email().toLowerCase();
    await credentials.save(registerEmailCredential(undefined, email));

    await expectAppError(
      credentials.save(registerEmailCredential(undefined, email)),
      IdentityError.CredentialEmailTaken,
      { email },
    );
  });

  it("refuses a second credential for the same OAuth subject", async () => {
    const taken = registerGoogleCredential();
    await credentials.save(taken);
    const again = Credential.register(
      {
        id: faker.database.mongodbObjectId(),
        accountId: faker.database.mongodbObjectId(),
        provider: AuthProvider.GOOGLE,
        subject: taken.subjectValue(),
      },
      faker.date.past(),
    );

    await expectAppError(
      credentials.save(again),
      IdentityError.OAuthLinkedToAnotherAccount,
      { provider: AuthProvider.GOOGLE },
    );
  });
};
