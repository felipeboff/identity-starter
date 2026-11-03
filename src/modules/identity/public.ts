/**
 * What other modules may use from identity.
 */
export type { Actor } from "./application/actor";
export { IdentityPermission } from "./domain/identity.permission";
export { MembershipRole } from "./domain/membership.entity";
export {
  type AccountRegisteredEvent,
  type AccountRegisteredPayload,
  AccountRegisteredVia,
  type EmailChangedPayload,
  IdentityEvent,
} from "./application/events/identity-event";
