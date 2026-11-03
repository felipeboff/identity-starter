import { PermissionCatalog } from "@shared/domain/value-objects/permission-catalog.value-object";

export type ListPermissionsOutput = {
  permissions: string[];
};

export type ListPermissionsDeps = {
  permissions: PermissionCatalog;
};
