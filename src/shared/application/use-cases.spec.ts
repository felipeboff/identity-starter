import { faker } from "@faker-js/faker";
import { SharedError } from "@shared/domain/errors/shared.error";
import { expectAppError } from "@shared/testing/expect-app-error";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Access, UseCase } from "./use-cases";

const Permission = {
  READ: "read",
  WRITE: "write",
  DELETE: "delete",
} as const;

type Permission = (typeof Permission)[keyof typeof Permission];

const NoteRole = {
  EDITOR: "editor",
  OWNER: "owner",
  VIEWER: "viewer",
} as const;

type NoteRole = (typeof NoteRole)[keyof typeof NoteRole];

type NoteActor = Readonly<{
  permissions: readonly Permission[];
  role: NoteRole;
}>;
type NoteInput = Readonly<{ noteId: string }>;
type NoteDeps = Readonly<{ reads: string[] }>;
type NoteShape = {
  input: NoteInput;
  output: string;
  deps: NoteDeps;
  actor: NoteActor;
};

abstract class NoteUseCase extends UseCase<NoteShape> {
  execute(input: NoteInput, _actor: NoteActor): Promise<string> {
    this.deps.reads.push(input.noteId);
    return Promise.resolve(input.noteId);
  }
}

class ViewNoteUseCase extends NoteUseCase {
  readonly access = Access.MEMBER;
}

class EditNoteUseCase extends NoteUseCase {
  readonly access = { permissions: [Permission.WRITE, Permission.READ] };
}

class ShareNoteUseCase extends NoteUseCase {
  readonly access = { anyPermissions: [Permission.WRITE, Permission.DELETE] };
}

class MoveNoteUseCase extends NoteUseCase {
  readonly access = {
    permissions: [Permission.READ],
    anyPermissions: [Permission.WRITE, Permission.DELETE],
  };
}

class ReviewNoteUseCase extends NoteUseCase {
  readonly access = { roles: [NoteRole.EDITOR, NoteRole.OWNER] };
}

class PublishNoteUseCase extends NoteUseCase {
  readonly access = {
    permissions: [Permission.WRITE],
    roles: [NoteRole.EDITOR, NoteRole.OWNER],
  };
}

class CountNotesUseCase extends UseCase<{ output: number; deps: NoteDeps }> {
  readonly access = Access.ANYONE;

  execute(): Promise<number> {
    return Promise.resolve(this.deps.reads.length);
  }
}

const buildInput = (): NoteInput => ({
  noteId: faker.database.mongodbObjectId(),
});

const buildActor = (overrides: Partial<NoteActor> = {}): NoteActor => ({
  permissions: [],
  role: NoteRole.VIEWER,
  ...overrides,
});

describe("UseCase", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Access.ANYONE", () => {
    it("runs the body without an actor", async () => {
      const reads = [faker.database.mongodbObjectId()];

      const out = await new CountNotesUseCase({ reads }).execute();

      expect(out).toBe(reads.length);
    });
  });

  describe("Access.MEMBER", () => {
    it("runs the body for any actor", async () => {
      const deps = { reads: [] };
      const input = buildInput();

      const out = await new ViewNoteUseCase(deps).execute(input, buildActor());

      expect(out).toBe(input.noteId);
      expect(deps.reads).toStrictEqual([input.noteId]);
    });
  });

  describe("permissions", () => {
    it("runs the body for an actor holding every declared permission", async () => {
      const deps = { reads: [] };
      const input = buildInput();

      const out = await new EditNoteUseCase(deps).execute(
        input,
        buildActor({ permissions: [Permission.READ, Permission.WRITE] }),
      );

      expect(out).toBe(input.noteId);
      expect(deps.reads).toStrictEqual([input.noteId]);
    });

    it.each([
      ["none", [], Permission.WRITE],
      ["only the second one", [Permission.READ], Permission.WRITE],
      ["only the first one", [Permission.WRITE], Permission.READ],
    ] as const)(
      "refuses with permission_missing naming the first missing code in declared order (holds %s)",
      async (_, permissions, required) => {
        const deps = { reads: [] };

        const out = new EditNoteUseCase(deps).execute(
          buildInput(),
          buildActor({ permissions }),
        );

        await expectAppError(out, SharedError.PermissionMissing, { required });
        await expect(out).rejects.toMatchObject({ kind: "forbidden" });
        expect(deps.reads).toStrictEqual([]);
      },
    );
  });

  describe("anyPermissions", () => {
    it("runs the body for an actor holding one of them", async () => {
      const input = buildInput();

      const out = await new ShareNoteUseCase({ reads: [] }).execute(
        input,
        buildActor({ permissions: [Permission.DELETE] }),
      );

      expect(out).toBe(input.noteId);
    });

    it("refuses with permission_missing listing anyOf when the actor holds none", async () => {
      const deps = { reads: [] };

      const out = new ShareNoteUseCase(deps).execute(
        buildInput(),
        buildActor({ permissions: [Permission.READ] }),
      );

      await expectAppError(out, SharedError.PermissionMissing, {
        anyOf: [Permission.WRITE, Permission.DELETE],
      });
      expect(deps.reads).toStrictEqual([]);
    });

    it("requires every permission and one of anyPermissions, checking permissions first", async () => {
      const useCase = new MoveNoteUseCase({ reads: [] });
      const input = buildInput();

      await expectAppError(
        useCase.execute(input, buildActor()),
        SharedError.PermissionMissing,
        { required: Permission.READ },
      );
      await expectAppError(
        useCase.execute(input, buildActor({ permissions: [Permission.READ] })),
        SharedError.PermissionMissing,
        { anyOf: [Permission.WRITE, Permission.DELETE] },
      );
      await expect(
        useCase.execute(
          input,
          buildActor({ permissions: [Permission.READ, Permission.WRITE] }),
        ),
      ).resolves.toBe(input.noteId);
    });
  });

  describe("roles", () => {
    it.each([NoteRole.EDITOR, NoteRole.OWNER])(
      "runs the body for an actor with one of the declared roles (%s)",
      async (role) => {
        const input = buildInput();

        const out = await new ReviewNoteUseCase({ reads: [] }).execute(
          input,
          buildActor({ role }),
        );

        expect(out).toBe(input.noteId);
      },
    );

    it("refuses with role_missing listing the roles when the actor has another one", async () => {
      const deps = { reads: [] };

      const out = new ReviewNoteUseCase(deps).execute(
        buildInput(),
        buildActor({ permissions: Object.values(Permission) }),
      );

      await expectAppError(out, SharedError.RoleMissing, {
        roles: [NoteRole.EDITOR, NoteRole.OWNER],
      });
      await expect(out).rejects.toMatchObject({ kind: "forbidden" });
      expect(deps.reads).toStrictEqual([]);
    });

    it("requires the permissions and one of the roles, checking permissions first", async () => {
      const useCase = new PublishNoteUseCase({ reads: [] });
      const input = buildInput();

      await expectAppError(
        useCase.execute(input, buildActor()),
        SharedError.PermissionMissing,
        { required: Permission.WRITE },
      );
      await expectAppError(
        useCase.execute(input, buildActor({ permissions: [Permission.WRITE] })),
        SharedError.RoleMissing,
        { roles: [NoteRole.EDITOR, NoteRole.OWNER] },
      );
      await expect(
        useCase.execute(
          input,
          buildActor({ permissions: [Permission.WRITE], role: NoteRole.OWNER }),
        ),
      ).resolves.toBe(input.noteId);
    });
  });

  it("calls the subclass execute found at call time, so a later spy sees it", async () => {
    const useCase = new EditNoteUseCase({ reads: [] });
    const execute = vi.spyOn(EditNoteUseCase.prototype, "execute");
    const input = buildInput();
    const actor = buildActor({
      permissions: [Permission.READ, Permission.WRITE],
    });

    await useCase.execute(input, actor);

    expect(execute).toHaveBeenCalledExactlyOnceWith(input, actor);
  });

  describe("at compile time", () => {
    it("requires every use case to declare its access, and fails closed without it", async () => {
      // @ts-expect-error a use case that declares no access does not compile
      class ArchiveNoteUseCase extends NoteUseCase {}
      const deps = { reads: [] };

      await expect(
        new ArchiveNoteUseCase(deps).execute(buildInput(), buildActor()),
      ).rejects.toThrow(TypeError);
      expect(deps.reads).toStrictEqual([]);
    });

    it("accepts only Access.ANYONE without an actor", async () => {
      class StampUseCase extends UseCase<{ output: string }> {
        // @ts-expect-error a shape without actor cannot require permissions
        readonly access = { permissions: [Permission.READ] };

        execute(): Promise<string> {
          return Promise.resolve(faker.lorem.word());
        }
      }

      await expectAppError(
        new StampUseCase().execute(),
        SharedError.PermissionMissing,
        { required: Permission.READ },
      );
    });

    it("refuses Access.ANYONE and an empty requirement with an actor", () => {
      class OpenNoteUseCase extends NoteUseCase {
        // @ts-expect-error a use case with an actor must say what it requires
        readonly access = Access.ANYONE;
      }
      class BlankNoteUseCase extends NoteUseCase {
        // @ts-expect-error an empty requirement says nothing; use Access.MEMBER
        readonly access = {};
      }

      expect(new OpenNoteUseCase({ reads: [] }).access).toBe(Access.ANYONE);
      expect(new BlankNoteUseCase({ reads: [] }).access).toStrictEqual({});
    });

    it("accepts only the actor's permission codes and roles", async () => {
      const unknownCode = faker.string.alpha(12);
      const unknownRole = faker.string.alpha(12);

      class PinNoteUseCase extends NoteUseCase {
        // @ts-expect-error only the actor's permission codes are accepted
        readonly access = { permissions: [unknownCode] };
      }
      class LockNoteUseCase extends NoteUseCase {
        // @ts-expect-error only the actor's roles are accepted
        readonly access = { roles: [unknownRole] };
      }

      await expectAppError(
        new PinNoteUseCase({ reads: [] }).execute(
          buildInput(),
          buildActor({ permissions: Object.values(Permission) }),
        ),
        SharedError.PermissionMissing,
        { required: unknownCode },
      );
      await expectAppError(
        new LockNoteUseCase({ reads: [] }).execute(
          buildInput(),
          buildActor({ role: NoteRole.OWNER }),
        ),
        SharedError.RoleMissing,
        { roles: [unknownRole] },
      );
    });
  });
});
