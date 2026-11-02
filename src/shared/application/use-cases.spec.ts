import { faker } from "@faker-js/faker";
import { SharedError } from "@shared/domain/errors/shared.error";
import { expectAppError } from "@shared/testing/expect-app-error";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UseCase } from "./use-cases";

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

type NoteActor = Readonly<{ permissions: readonly Permission[] }>;
type NoteInput = Readonly<{ noteId: string }>;
type NoteDeps = Readonly<{ reads: string[] }>;
type NoteShape = {
  input: NoteInput;
  output: string;
  deps: NoteDeps;
  actor: NoteActor;
};

type MemberActor = Readonly<{
  permissions: readonly Permission[];
  role: NoteRole;
}>;
type MemberShape = {
  input: NoteInput;
  output: string;
  deps: NoteDeps;
  actor: MemberActor;
};

class EditNoteUseCase extends UseCase<NoteShape> {
  readonly permissions = [Permission.WRITE, Permission.READ];

  execute(input: NoteInput, _actor: NoteActor): Promise<string> {
    this.deps.reads.push(input.noteId);
    return Promise.resolve(input.noteId);
  }
}

class ViewNoteUseCase extends UseCase<NoteShape> {
  execute(input: NoteInput, _actor: NoteActor): Promise<string> {
    this.deps.reads.push(input.noteId);
    return Promise.resolve(input.noteId);
  }
}

class OpenNoteUseCase extends ViewNoteUseCase {
  readonly permissions = [];
}

class ShareNoteUseCase extends ViewNoteUseCase {
  readonly anyPermissions = [Permission.WRITE, Permission.DELETE];
}

class MoveNoteUseCase extends ViewNoteUseCase {
  readonly permissions = [Permission.READ];
  readonly anyPermissions = [Permission.WRITE, Permission.DELETE];
}

class PublicNoteUseCase extends ViewNoteUseCase {
  readonly anyPermissions = [];
}

class ReviewNoteUseCase extends UseCase<MemberShape> {
  readonly roles = [NoteRole.EDITOR, NoteRole.OWNER];

  execute(input: NoteInput, _actor: MemberActor): Promise<string> {
    this.deps.reads.push(input.noteId);
    return Promise.resolve(input.noteId);
  }
}

class CommentNoteUseCase extends ReviewNoteUseCase {
  readonly roles = [];
}

class PublishNoteUseCase extends ReviewNoteUseCase {
  readonly permissions = [Permission.WRITE];
}

const buildInput = (): NoteInput => ({
  noteId: faker.database.mongodbObjectId(),
});

describe("UseCase", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs the body for an actor holding every declared permission", async () => {
    const deps = { reads: [] };
    const useCase = new EditNoteUseCase(deps);
    const input = buildInput();

    const out = await useCase.execute(input, {
      permissions: [Permission.READ, Permission.WRITE],
    });

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
      const useCase = new EditNoteUseCase({ reads: [] });

      const out = useCase.execute(buildInput(), { permissions });

      await expectAppError(out, SharedError.PermissionMissing, { required });
      await expect(out).rejects.toMatchObject({ kind: "forbidden" });
    },
  );

  it("does not run the body when it refuses", async () => {
    const deps = { reads: [] };
    const useCase = new EditNoteUseCase(deps);

    await expectAppError(
      useCase.execute(buildInput(), { permissions: [Permission.READ] }),
      SharedError.PermissionMissing,
    );

    expect(deps.reads).toStrictEqual([]);
  });

  it.each([
    ["undeclared", ViewNoteUseCase],
    ["empty permissions", OpenNoteUseCase],
    ["empty anyPermissions", PublicNoteUseCase],
  ])(
    "runs the body for any actor when nothing is required (%s)",
    async (_, NoteUseCase) => {
      const deps = { reads: [] };
      const useCase = new NoteUseCase(deps);
      const input = buildInput();

      const out = await useCase.execute(input, { permissions: [] });

      expect(out).toBe(input.noteId);
      expect(deps.reads).toStrictEqual([input.noteId]);
    },
  );

  it("runs the body for an actor holding one of anyPermissions", async () => {
    const deps = { reads: [] };
    const useCase = new ShareNoteUseCase(deps);
    const input = buildInput();

    const out = await useCase.execute(input, {
      permissions: [Permission.DELETE],
    });

    expect(out).toBe(input.noteId);
    expect(deps.reads).toStrictEqual([input.noteId]);
  });

  it("refuses with permission_missing listing anyOf when the actor holds none", async () => {
    const deps = { reads: [] };
    const useCase = new ShareNoteUseCase(deps);

    const out = useCase.execute(buildInput(), {
      permissions: [Permission.READ],
    });

    await expectAppError(out, SharedError.PermissionMissing, {
      anyOf: [Permission.WRITE, Permission.DELETE],
    });
    await expect(out).rejects.toMatchObject({ kind: "forbidden" });
    expect(deps.reads).toStrictEqual([]);
  });

  it("requires every permission and one of anyPermissions, checking permissions first", async () => {
    const useCase = new MoveNoteUseCase({ reads: [] });
    const input = buildInput();

    await expectAppError(
      useCase.execute(input, { permissions: [] }),
      SharedError.PermissionMissing,
      { required: Permission.READ },
    );
    await expectAppError(
      useCase.execute(input, { permissions: [Permission.READ] }),
      SharedError.PermissionMissing,
      { anyOf: [Permission.WRITE, Permission.DELETE] },
    );
    await expect(
      useCase.execute(input, {
        permissions: [Permission.READ, Permission.WRITE],
      }),
    ).resolves.toBe(input.noteId);
  });

  it("calls the subclass execute found at call time, so a later spy sees it", async () => {
    const useCase = new EditNoteUseCase({ reads: [] });
    const execute = vi.spyOn(EditNoteUseCase.prototype, "execute");
    const input = buildInput();
    const actor = { permissions: [Permission.READ, Permission.WRITE] };

    await useCase.execute(input, actor);

    expect(execute).toHaveBeenCalledExactlyOnceWith(input, actor);
  });

  it("rejects permissions the shape cannot hold at compile time", async () => {
    const unknownCode = faker.string.alpha(12);

    class StampUseCase extends UseCase<{ output: string }> {
      // @ts-expect-error a shape without actor cannot declare permissions
      readonly permissions = [Permission.READ];

      execute(): Promise<string> {
        return Promise.resolve(unknownCode);
      }
    }

    class ArchiveNoteUseCase extends UseCase<{
      output: string;
      actor: NoteActor;
    }> {
      // @ts-expect-error only the actor's permission codes are accepted
      readonly permissions = [unknownCode];

      execute(_actor: NoteActor): Promise<string> {
        return Promise.resolve(unknownCode);
      }
    }

    await expectAppError(
      new StampUseCase().execute(),
      SharedError.PermissionMissing,
      { required: Permission.READ },
    );
    await expectAppError(
      new ArchiveNoteUseCase().execute({
        permissions: Object.values(Permission),
      }),
      SharedError.PermissionMissing,
      { required: unknownCode },
    );
  });

  it("rejects anyPermissions the shape cannot hold at compile time", async () => {
    const unknownCode = faker.string.alpha(12);

    class StampUseCase extends UseCase<{ output: string }> {
      // @ts-expect-error a shape without actor cannot declare anyPermissions
      readonly anyPermissions = [Permission.READ];

      execute(): Promise<string> {
        return Promise.resolve(unknownCode);
      }
    }

    class ArchiveNoteUseCase extends UseCase<{
      output: string;
      actor: NoteActor;
    }> {
      // @ts-expect-error only the actor's permission codes are accepted
      readonly anyPermissions = [unknownCode];

      execute(_actor: NoteActor): Promise<string> {
        return Promise.resolve(unknownCode);
      }
    }

    await expectAppError(
      new StampUseCase().execute(),
      SharedError.PermissionMissing,
      { anyOf: [Permission.READ] },
    );
    await expectAppError(
      new ArchiveNoteUseCase().execute({
        permissions: Object.values(Permission),
      }),
      SharedError.PermissionMissing,
      { anyOf: [unknownCode] },
    );
  });

  describe("roles", () => {
    it.each([NoteRole.EDITOR, NoteRole.OWNER])(
      "runs the body for an actor with one of the declared roles (%s)",
      async (role) => {
        const deps = { reads: [] };
        const useCase = new ReviewNoteUseCase(deps);
        const input = buildInput();

        const out = await useCase.execute(input, { permissions: [], role });

        expect(out).toBe(input.noteId);
        expect(deps.reads).toStrictEqual([input.noteId]);
      },
    );

    it("refuses with role_missing listing the roles when the actor has another one", async () => {
      const deps = { reads: [] };
      const useCase = new ReviewNoteUseCase(deps);

      const out = useCase.execute(buildInput(), {
        permissions: Object.values(Permission),
        role: NoteRole.VIEWER,
      });

      await expectAppError(out, SharedError.RoleMissing, {
        roles: [NoteRole.EDITOR, NoteRole.OWNER],
      });
      await expect(out).rejects.toMatchObject({ kind: "forbidden" });
      expect(deps.reads).toStrictEqual([]);
    });

    it("runs the body for any role when the declared roles are empty", async () => {
      const useCase = new CommentNoteUseCase({ reads: [] });
      const input = buildInput();

      const out = await useCase.execute(input, {
        permissions: [],
        role: NoteRole.VIEWER,
      });

      expect(out).toBe(input.noteId);
    });

    it("requires the permissions and one of the roles, checking permissions first", async () => {
      const useCase = new PublishNoteUseCase({ reads: [] });
      const input = buildInput();

      await expectAppError(
        useCase.execute(input, { permissions: [], role: NoteRole.VIEWER }),
        SharedError.PermissionMissing,
        { required: Permission.WRITE },
      );
      await expectAppError(
        useCase.execute(input, {
          permissions: [Permission.WRITE],
          role: NoteRole.VIEWER,
        }),
        SharedError.RoleMissing,
        { roles: [NoteRole.EDITOR, NoteRole.OWNER] },
      );
      await expect(
        useCase.execute(input, {
          permissions: [Permission.WRITE],
          role: NoteRole.EDITOR,
        }),
      ).resolves.toBe(input.noteId);
    });

    it("rejects roles the shape cannot hold at compile time", async () => {
      const unknownRole = faker.string.alpha(12);

      class StampUseCase extends UseCase<{ output: string }> {
        // @ts-expect-error a shape without actor cannot declare roles
        readonly roles = [NoteRole.EDITOR];

        execute(): Promise<string> {
          return Promise.resolve(unknownRole);
        }
      }

      class ArchiveNoteUseCase extends UseCase<{
        output: string;
        actor: MemberActor;
      }> {
        // @ts-expect-error only the actor's roles are accepted
        readonly roles = [unknownRole];

        execute(_actor: MemberActor): Promise<string> {
          return Promise.resolve(unknownRole);
        }
      }

      await expectAppError(
        new StampUseCase().execute(),
        SharedError.RoleMissing,
        {
          roles: [NoteRole.EDITOR],
        },
      );
      await expectAppError(
        new ArchiveNoteUseCase().execute({
          permissions: [],
          role: NoteRole.OWNER,
        }),
        SharedError.RoleMissing,
        { roles: [unknownRole] },
      );
    });
  });
});
