import { PermissionCatalog } from "@shared/domain/value-objects/permission-catalog.value-object";

import { identityPermissions } from "@/identity/identity.module";

export const permissionCatalog = new PermissionCatalog([identityPermissions]);
