import { AppError } from "../errors/app-error";
import { SharedError } from "../errors/shared.error";

export const PERMISSION_PATTERN = "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$";
export const PERMISSION_MAX_LENGTH = 100;

export type ModulePermissions = Readonly<{
  module: string;
  permissions: readonly string[];
}>;

export class PermissionCatalog {
  private readonly PERMISSION_REGEX = new RegExp(PERMISSION_PATTERN);
  private readonly codes = new Set<string>();

  constructor(declarations: readonly ModulePermissions[]) {
    for (const declaration of declarations) {
      for (const permission of declaration.permissions) {
        this.add(declaration.module, permission);
      }
    }
  }

  public all(): string[] {
    return [...this.codes].sort();
  }

  public includes(permission: string): boolean {
    return this.codes.has(permission);
  }

  private add(module: string, permission: string): void {
    if (
      this.codes.has(permission) ||
      !permission.startsWith(`${module}.`) ||
      permission.length > PERMISSION_MAX_LENGTH ||
      !this.PERMISSION_REGEX.test(permission)
    ) {
      throw new AppError(SharedError.InvalidPermissionCatalog, {
        module,
        permission,
      });
    }
    this.codes.add(permission);
  }
}
