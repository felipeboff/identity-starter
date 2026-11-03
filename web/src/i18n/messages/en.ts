import type { Permission, Role } from "../../api/identity.types";
import type {
  QueryName,
  RateLimit,
  RateLimitScope,
  RateLimitWindow,
  RouteGroup,
  RouteId,
} from "../../explorer/route-catalog";

export type RouteCopy = {
  summary: string;
  note?: string;
};

const errorCodes: Record<string, string> = {
  "client.network_failed": "Couldn't reach the API. Check that it's running.",
  "client.unexpected_response": "The API responded with something unexpected.",
  "client.oauth_cancelled": "The provider cancelled or refused the sign-in.",
  "client.oauth_unrecognized":
    "We don't recognize this sign-in attempt. Start again from here.",
  "client.oauth_incomplete": "The provider's response was incomplete.",
  "shared.input_invalid": "Check the highlighted fields.",
  "shared.body_malformed": "The request was malformed.",
  "shared.rate_limited": "Too many attempts. Try again in {seconds} s.",
  "shared.permission_missing": "You don't have permission to do this.",
  "shared.version_conflict":
    "The data changed while you were editing. Reload and try again.",
  "shared.already_exists": "This record already exists.",
  "shared.route_not_found": "This route doesn't exist in the API.",
  "shared.internal": "Something went wrong on our side. Try again.",
  "identity.invalid_credentials": "Incorrect email or password.",
  "identity.sign_in_locked":
    "Too many attempts for this email. Try again in {seconds} s.",
  "identity.account_email_taken": "An account with this email already exists.",
  "identity.credential_email_taken":
    "An account with this email already exists.",
  "identity.account_deleted": "This account is deactivated.",
  "identity.account_not_found": "Account not found.",
  "identity.account_email_already_verified": "Your email is already confirmed.",
  "identity.credential_not_found":
    "There's no sign-in with this provider on this account.",
  "identity.credential_password_not_set":
    "This account signs in only with GitHub or Google.",
  "identity.email_change_needs_password":
    "Accounts that sign in only with GitHub or Google can't change their email.",
  "identity.email_change_expired": "The email change link has expired.",
  "identity.email_change_already_consumed":
    "This email change link has already been used.",
  "identity.email_change_deleted": "This email change was cancelled.",
  "identity.invalid_email_change_token": "Invalid email change link.",
  "identity.email_verification_expired":
    "The confirmation link has expired. Request a new one.",
  "identity.email_verification_already_consumed":
    "This confirmation link has already been used.",
  "identity.email_verification_deleted":
    "This confirmation link was cancelled.",
  "identity.invalid_email_verification_token": "Invalid confirmation link.",
  "identity.email_delivery_failed":
    "We couldn't send the email right now. Try again in a moment.",
  "identity.forbidden": "You can't do this with this account.",
  "identity.invalid_access_token": "Access token missing, invalid or expired.",
  "identity.invalid_refresh_token": "Your session has expired. Sign in again.",
  "identity.refresh_token_reused":
    "For security, every session has been ended. Sign in again.",
  "identity.session_expired": "Your session has expired. Sign in again.",
  "identity.session_revoked": "This session was ended. Sign in again.",
  "identity.session_not_found": "Session not found.",
  "identity.invalid_invitation_token": "This invitation is invalid.",
  "identity.invitation_expired":
    "This invitation has expired. Ask for a new one.",
  "identity.invitation_already_accepted":
    "This invitation has already been accepted.",
  "identity.invitation_revoked": "This invitation was revoked.",
  "identity.invitation_not_found": "Invitation not found.",
  "identity.invalid_password_reset_token": "Invalid reset link.",
  "identity.password_reset_expired":
    "The reset link has expired. Request a new one.",
  "identity.password_reset_already_consumed":
    "This reset link has already been used.",
  "identity.password_reset_deleted": "This reset link was cancelled.",
  "identity.last_credential_cannot_be_removed":
    "This is the only way to sign in to your account, so it can't be disconnected.",
  "identity.membership_not_found": "Member not found.",
  "identity.membership_deleted": "This member was removed.",
  "identity.invalid_membership_permissions": "Invalid permissions.",
  "identity.invalid_membership_role": "Invalid role.",
  "identity.oauth_code_rejected":
    "The provider rejected the code. Try signing in again.",
  "identity.oauth_email_not_verified":
    "Your email at the provider hasn't been verified yet.",
  "identity.oauth_linked_to_another_account":
    "This provider account is already linked to another user.",
  "identity.oauth_provider_already_linked":
    "This provider is already connected.",
  "identity.oauth_provider_failed": "The provider didn't respond. Try again.",
  "identity.oauth_provider_not_supported": "Provider not supported.",
};

const violationReasons: Record<string, string> = {
  required: "Fill in this field.",
  format: "Invalid format.",
  pattern: "Invalid format.",
  enum: "Value not allowed.",
  type: "Invalid value.",
  minLength: "Too short.",
  maxLength: "Too long.",
};

const permissions: Record<Permission, string> = {
  "identity.invitation.create": "Create invitations",
  "identity.invitation.read": "View invitations",
  "identity.invitation.revoke": "Revoke invitations",
  "identity.account.reactivate": "Reactivate accounts",
  "identity.account.deactivate": "Deactivate accounts",
  "identity.session.read": "View other people's sessions",
  "identity.session.revoke": "End other people's sessions",
  "identity.session.revoke_all": "End all sessions of an account",
  "identity.member.read": "View members",
  "identity.member.role.update": "Change members' roles",
  "identity.member.permissions.update": "Change members' permissions",
};

const roles: Record<Role, string> = {
  user: "User",
  admin: "Administrator",
};

const routeGroups: Record<RouteGroup, string> = {
  auth: "Authentication",
  account: "My account",
  sessions: "Sessions",
  members: "Accounts and members",
  invitations: "Invitations",
};

const someoneElsesAccount =
  "On someone else's account it requires the permission.";

const routes: Record<RouteId, RouteCopy> = {
  "sign-up": {
    summary:
      "Creates an account with email and password and opens a session right away.",
    note: "The response tokens become this browser's session.",
  },
  "sign-in": {
    summary: "Signs in with email and password.",
    note: "Without the right password, every failure is the same 401, whether the account exists or not. 5 failures for the same email within 15 min lock its sign-in.",
  },
  "oauth-sign-in": {
    summary: "Exchanges a GitHub or Google code for a session.",
    note: "The code comes from the provider's redirect and only works once.",
  },
  refresh: {
    summary: "Rotates the refresh token and returns a new pair.",
    note: "Resending an already rotated token is treated as theft: every session is dropped.",
  },
  "password-reset-request": {
    summary: "Sends a password reset link.",
    note: "Works for any active account, with or without a password: the link creates the password if there isn't one. Responds 204 even without an account.",
  },
  "password-reset": {
    summary: "Changes the password with the email token and ends the sessions.",
  },
  "email-verification": {
    summary: "Confirms the email with the link token.",
  },
  "accept-invitation": {
    summary:
      "Accepts an invitation, creates the account already confirmed and signs in.",
  },
  "confirm-email-change": {
    summary: "Confirms the email change and ends every session.",
  },
  "sign-out": {
    summary: "Ends the current session.",
  },
  "get-me": {
    summary: "Returns the caller's account and membership.",
  },
  "update-name": {
    summary: "Updates the name.",
  },
  "change-password": {
    summary: "Changes the password and ends every session, including this one.",
  },
  "request-email-change": {
    summary: "Sends a 1-hour link to the new email.",
  },
  "request-email-verification": {
    summary: "Resends the email confirmation link.",
  },
  "list-credentials": {
    summary: "The account's sign-in methods: password and connected providers.",
  },
  "link-oauth": {
    summary: "Links a provider to the account with an OAuth code.",
  },
  "unlink-oauth": {
    summary: "Unlinks a provider; refuses if it's the only way to sign in.",
  },
  "list-sessions": {
    summary: "Active sessions, newest to oldest.",
  },
  "revoke-other-sessions": {
    summary: "Ends every session except the current one.",
  },
  "revoke-session": {
    summary: "Ends a session.",
    note: "On someone else's session it requires the permission.",
  },
  "list-account-sessions": {
    summary: "An account's active sessions, newest to oldest.",
    note: someoneElsesAccount,
  },
  "revoke-all-sessions": {
    summary: "Ends every session of an account.",
    note: someoneElsesAccount,
  },
  "deactivate-account": {
    summary: "Deactivates the account and ends its sessions.",
    note: someoneElsesAccount,
  },
  "reactivate-account": {
    summary: "Reactivates a deactivated account.",
  },
  "list-members": {
    summary: "Members with account and membership, page by page.",
    note: "Send the response's nextCursor as cursor to get the next page.",
  },
  "update-member-role": {
    summary: "Changes a member's role. Nobody changes their own.",
  },
  "update-member-permissions": {
    summary: "Replaces a member's permissions. Only grants what you have.",
  },
  "invite-member": {
    summary: "Invites by email with a role and permissions.",
  },
  "list-invitations": {
    summary: "Pending invitations, newest to oldest.",
  },
  "revoke-invitation": {
    summary: "Revokes a pending invitation; an accepted one responds 422.",
  },
  "list-permissions": {
    summary:
      "Every permission code that can be granted, in alphabetical order.",
  },
};

const queryHints: Record<QueryName, string> = {
  limit: "1 to 100; default 50",
  cursor: "nextCursor from the previous page",
};

const rateWindows: Record<RateLimitWindow, string> = {
  hour: "per hour",
  "quarter-hour": "every 15 min",
};

const rateScopes: Record<RateLimitScope, string> = {
  ip: "per IP",
  email: "per email",
};

export const en = {
  common: {
    loading: "Loading",
    cancel: "Cancel",
    copy: "Copy",
    copyLabel: (label: string) => `Copy ${label}`,
    close: "Close",
    save: "Save",
    back: "Back",
    signIn: "Sign in",
    signUp: "Create account",
    signOut: "Sign out",
    language: "Language",
    yourName: "Your name",
    yourEmail: "Your email",
    emailPlaceholder: "you@example.com",
    email: "Email",
    password: "Password",
    currentPassword: "Current password",
    newPassword: "New password",
    passwordLength: (min: number, max: number) =>
      `${min} to ${max} characters.`,
    incompleteLink: "Incomplete link",
    openLinkAsReceived: "Open the link exactly as it arrived in the email.",
    linkSent: "Link sent",
    accountDeactivated: "Your account has been deactivated.",
    accountId: "Account ID",
    memberSince: "Member since",
  },
  nav: {
    main: "Main",
    overview: "Overview",
    profile: "Profile",
    security: "Security",
    invitations: "Invitations",
    members: "Members",
    explorer: "Route explorer",
  },
  authLayout: {
    eyebrow: (app: string) => `With ${app}`,
    tagline: "Your account, your sessions and your team in one place",
    exploreRoutes: "Explore the API routes",
  },
  auth: {
    sessionEnded: "Your session has ended. Sign in again.",
  },
  form: {
    required: "Fill in this field.",
    minLength: (min: number) => `Use at least ${min} characters.`,
    invalidEmail: "Enter a valid email.",
    invalidFormat: "Invalid format.",
    showPassword: "Show password",
    hidePassword: "Hide password",
    noOptions: "No options.",
  },
  errors: {
    fallback: "Something went wrong. Try again.",
    invalidValue: "Invalid value.",
    passwordLength: "Use 12 to 128 characters.",
    codes: errorCodes,
    reasons: violationReasons,
  },
  format: {
    deviceOn: (browser: string, system: string) => `${browser} on ${system}`,
    unknownDevice: "Unknown device",
  },
  permissions,
  permissionLabel: (code: string) =>
    (permissions as Record<string, string | undefined>)[code] ?? code,
  roles,
  oauth: {
    notConfigured: (provider: string) =>
      `${provider} sign-in is not configured`,
    configureHint: (envName: string) =>
      `Set ${envName} in web/.env and restart Vite.`,
    continueWith: "or continue with",
  },
  signIn: {
    title: "Sign in to your account",
    subtitle:
      "Access your sessions, invitations and permissions from anywhere, all organized in one place.",
    forgotPassword: "Forgot your password?",
    noAccount: "Don't have an account yet?",
    accountDeactivated:
      "This account is deactivated. Ask an administrator to reactivate it.",
    accountUnavailable:
      "We couldn't sign you in to this account. Talk to an administrator.",
  },
  signUp: {
    title: "Create an account",
    subtitle:
      "Get started in seconds. We'll send a link to confirm your email right after you sign up.",
    eyebrow: "Takes less than a minute",
    tagline:
      "One account to access everything, with sessions under your control",
    emailTaken:
      "This email already has an account. Sign in with GitHub or Google, or create a password via “Forgot your password?” on the sign-in screen.",
    created: "Account created",
    confirmationSent: (email: string) =>
      `We sent a confirmation link to ${email}.`,
    passwordHint: (min: number, max: number) =>
      `${min} to ${max} characters. A long phrase works well.`,
    submit: "Get started",
    haveAccount: "Already have an account?",
  },
  forgotPassword: {
    title: "Forgot your password?",
    subtitle:
      "Enter your account email and we'll send a link to create a new password. This also works for accounts created with GitHub or Google.",
    eyebrow: "It happens to everyone",
    tagline: "Get your access back without losing anything that's yours",
    checkInbox: "Check your inbox",
    backToSignIn: "Back to sign in",
    sent: (email: string) =>
      `If there's an account for ${email}, the link will arrive shortly. It's valid for a short time and can only be used once.`,
    submit: "Send link",
    remembered: "Remembered it?",
  },
  resetPassword: {
    title: "Create a new password",
    subtitle: "After the change, all open sessions are ended for security.",
    eyebrow: "Almost there",
    tagline: "A new password, and every old session ended",
    requestNewLink: "Request a new link",
    saved: "Password saved",
    savedDescription:
      "Use the new password to sign in with your email. Open sessions have been ended.",
    mismatch: "The passwords don't match.",
    savedNotice: "Password saved. Sign in with the new password.",
    repeatPassword: "Repeat the new password",
    submit: "Reset password",
  },
  verifyEmail: {
    newLinkSent: "New link sent",
    missingToken:
      "The link came without its token. Open it as it arrived in the email.",
    goToDashboard: "Go to dashboard",
    title: "Email confirmation",
    eyebrow: "One more step",
    tagline: "A confirmed email makes your account easier to recover",
    confirming: "Confirming your email…",
    confirmed: "Email confirmed",
    confirmedDescription: (email: string) =>
      `${email} is confirmed. You're all set.`,
    failed: "Couldn't confirm",
    sendNewLink: "Send a new link",
  },
  acceptInvitation: {
    title: "You've been invited",
    subtitle:
      "Choose your name and a password. The account starts out confirmed, with the invitation's role and permissions.",
    eyebrow: "Welcome to the team",
    tagline: "Your access comes ready, just the way the team set it up",
    incomplete: "Incomplete invitation",
    goToSignIn: "Go to sign in",
    signedInAs: (email: string) =>
      `You're signed in as ${email}. Accepting the invitation creates another account and replaces this browser's session.`,
    welcome: (name: string) => `Welcome, ${name}!`,
    submit: "Accept invitation",
  },
  confirmEmailChange: {
    changedNotice: (email: string) =>
      `Email changed to ${email}. Sign in again with the new address.`,
    title: "Change the account email",
    eyebrow: "Confirmation",
    tagline:
      "Your new email becomes the one you sign in with and get notices at",
    openLinkAsReceived: "Open the link exactly as it arrived at the new email.",
    changed: "Email changed",
    signInWithNewEmail: "Sign in with the new email",
    changedDescription: (email: string) =>
      `The account now uses ${email}. All sessions have been ended and the old address received a notice.`,
    confirmTitle: "Confirm the change?",
    confirm: "Confirm email change",
    confirmDescription:
      "When you confirm, every session on the account ends, including this one, and you sign in again with the new email.",
  },
  oauthCallback: {
    linked: (provider: string) => `${provider} connected to your account`,
    created: (provider: string) => `Account created with ${provider}`,
    welcomeBack: (name: string) => `Welcome back, ${name}`,
    emailTaken: (provider: string) =>
      `There's already an account with your ${provider} email. Sign in with email and password (or create one via “Forgot your password?”) and connect ${provider} under Security.`,
    title: (provider: string) => `Signing in with ${provider}`,
    eyebrow: "Social sign-in",
    tagline: "No new password to remember",
    failed: "Couldn't finish",
    checking: (provider: string) => `Checking the response from ${provider}…`,
  },
  notFound: {
    title: "Page not found",
    tagline: "This path doesn't lead anywhere",
    nothingHere: "Nothing here",
    backHome: "Back to home",
    description: "Check the address or go back to the home page.",
  },
  overview: {
    linkSent: "Confirmation link sent",
    checkEmail: (email: string) => `Check ${email}.`,
    memberId: "Member ID",
    createdAt: "Created at",
    emailConfirmedAt: "Email confirmed at",
    notYet: "Not yet",
    eyebrow: "Good to see you here",
    greeting: (name: string) => `Hello, ${name}`,
    emailConfirmed: "Email confirmed",
    emailPending: "Email pending",
    confirmEmail: "Confirm your email",
    resendLink: "Resend link",
    confirmEmailDescription: (email: string) =>
      `We sent a link to ${email} when you signed up. It helps you recover the account if you forget your password.`,
    activeSessions: "Active sessions",
    permissions: "Permissions",
    outOf: (total: number) => `of ${total}`,
    yourPermissions: "Your permissions",
    yourPermissionsDescription:
      "The role is just a label; what counts are the permissions below.",
    accountDetails: "Account details",
    accountDetailsDescription: "Copy the ID to use it in the Route explorer.",
  },
  profile: {
    title: "Profile",
    description: "Your name, your email and your password.",
    personal: "Personal details",
    personalDescription: "How your name appears to the team.",
    nameUpdated: "Name updated",
    name: "Name",
    emailDescription:
      "We'll send a 1-hour link to the new address. The change ends every session.",
    confirmed: "Confirmed",
    notConfirmed: "Not confirmed",
    current: "Current:",
    emailChangeSent: (email: string) =>
      `Open the email we sent to ${email} to complete the change.`,
    setPasswordFirst: "Set a password first",
    setPasswordFirstDescription:
      "Changing your email asks for your current password. Your account signs in only with GitHub or Google: create a password with the link in the card below.",
    newEmail: "New email",
    sendChangeLink: "Send change link",
    setPassword: "Set password",
    setPasswordDescription: (email: string) =>
      `Your account signs in only with GitHub or Google. To create a password, we'll send a link to ${email}: that way you keep a way to sign in even without the provider.`,
    changePasswordDescription:
      "Changing the password ends every session, including this one.",
    passwordLinkSent: (email: string) =>
      `Open the email we sent to ${email} and create the password there. When you save it, open sessions end and you sign in again.`,
    sendPasswordLink: "Send link to create a password",
    passwordChanged:
      "Password changed. For security, all sessions have been ended; sign in again.",
    changePassword: "Change password",
    deactivate: "Deactivate account",
    deactivateDescription:
      "The account becomes inactive and every session ends. Only someone with permission to reactivate accounts can bring it back.",
    deactivateTitle: "Deactivate your account?",
    deactivateConfirmDescription:
      "You'll be signed out now and won't be able to sign in again until someone reactivates the account.",
    deactivateConfirm: "Deactivate",
  },
  sessions: {
    current: "This session",
    meta: (ip: string, opened: string, expires: string) =>
      `${ip} · opened ${opened} · expires ${expires}`,
    end: "End",
    endTitle: "End this session?",
    endDescription: (device: string, ip: string) =>
      `${device} (${ip}) will need to sign in again.`,
    ended: "Session ended",
    endedCount: (count: number) =>
      count === 1 ? "1 session ended" : `${count} sessions ended`,
    endAll: "End all",
  },
  security: {
    title: "Security",
    description:
      "Where your account is open and which providers you sign in with.",
    connected: "Connected",
    noEmail: "No email",
    connectedAt: (relative: string) => `connected ${relative}`,
    onlyMethod: "only way to sign in",
    useProvider: (provider: string) =>
      `Use your ${provider} account to sign in.`,
    disconnectTitle: (provider: string) => `Disconnect ${provider}?`,
    disconnectDescription: (provider: string) =>
      `You'll stop signing in with ${provider}. You can connect it again anytime.`,
    disconnect: "Disconnect",
    disconnected: (provider: string) => `${provider} disconnected`,
    connect: "Connect",
    methods: "Sign-in methods",
    methodsDescription:
      "Sign in with your password, GitHub or Google. At least one has to remain.",
    emailAndPassword: "Email and password",
    active: "Active",
    noPassword: "No password",
    passwordUpdated: (relative: string) => `password updated ${relative}`,
    providersOnly: "This account signs in only through the providers below.",
    changePassword: "Change password",
    setPassword: "Set password",
    activeSessions: "Active sessions",
    activeSessionsDescription:
      "Each sign-in opens a new session; the others stay valid until they expire or are ended.",
    reloadSessions: "Reload sessions",
    endOthersTitle: "End the other sessions?",
    endOthersDescription:
      "Every device other than this one will need to sign in again.",
    endOthers: "End the others",
    endAllTitle: "End all sessions?",
    endAllDescription:
      "Including this one: you'll be signed out on every device right now.",
    allEndedNotice: (count: number) =>
      count === 1
        ? "1 session ended. Sign in again."
        : `${count} sessions ended. Sign in again.`,
  },
  invitations: {
    title: "Invitations",
    description:
      "Invite people by email. The link is valid for 7 days, and a new invitation to the same email replaces the pending one.",
    noAccess: "No access to invitations",
    noAccessDescription: (create: string, read: string) =>
      `Ask someone on the team for the “${create}” or “${read}” permission.`,
    newInvitation: "New invitation",
    newInvitationDescription:
      "You can only grant permissions you already have. The role is just a label.",
    sent: "Invitation sent",
    sentDescription: (email: string) =>
      `${email} received a link valid for 7 days.`,
    emailPlaceholder: "person@example.com",
    role: "Role",
    permissions: "Permissions",
    nothingToGrant: "You have no permissions to pass on.",
    send: "Send invitation",
    pending: "Pending",
    pendingDescription: "Newest to oldest.",
    empty: "No pending invitations",
    emptyDescription:
      "Sent invitations show up here until they're accepted, revoked or expire.",
    meta: (count: number, sent: string, expires: string) =>
      `${count === 1 ? "1 permission" : `${count} permissions`} · sent ${sent} · expires ${expires}`,
    revokeTitle: "Revoke this invitation?",
    revokeDescription: (email: string) =>
      `The link sent to ${email} will stop working.`,
    revoke: "Revoke",
    revoked: "Invitation revoked",
  },
  members: {
    title: "Members",
    description: "Who's on the team, with which role and which permissions.",
    selfNotice:
      "This is your account. Nobody changes their own role or their own permissions.",
    role: "Role",
    roleHint: "Just a label; it neither grants nor removes access.",
    roleChanged: (role: string) => `Role is now ${role}`,
    chooseRole: "Choose the role",
    permissions: "Permissions",
    permissionsHintMember:
      "Checked are the ones the member has today. You can only change the ones you also have.",
    permissionsHintManual:
      "Replaces the whole set. You can only change the ones you also have.",
    permissionsUpdated: "Permissions updated",
    permissionsCount: (count: number) =>
      count === 1
        ? "1 permission on the member."
        : `${count} permissions on the member.`,
    memberPermissions: "Member permissions",
    lockedPermission:
      "You don't have this permission, so you can't grant or remove it.",
    savePermissions: "Save permissions",
    access: "Access",
    accessHintUnknown: "Deactivating ends every session on the account.",
    accessHintDeactivated: "The account is deactivated and can't sign in.",
    accessHintActive:
      "The account is active. Deactivating ends all of its sessions.",
    reactivateTitle: "Reactivate the account?",
    reactivateDescription: "The person will be able to sign in again.",
    reactivateConfirm: "Reactivate",
    reactivated: (name: string) => `${name} reactivated`,
    reactivate: "Reactivate account",
    deactivateTitle: "Deactivate the account?",
    deactivateDescription:
      "The person is signed out of every device and can't sign in until someone reactivates the account.",
    deactivateConfirm: "Deactivate",
    deactivated: "Account deactivated",
    deactivate: "Deactivate account",
    sessions: "Sessions",
    revokeAllHint: "Forces the person to sign in again on every device.",
    revokeAllTitle: "End every session on the account?",
    revokeAllDescription: "Its refresh tokens stop working right away.",
    allSessionsEnded: "All your sessions have been ended.",
    revokeAll: "End all sessions",
    noSessions: "No active sessions right now.",
    deactivatedBadge: "Deactivated",
    you: "You",
    lastSeen: "Last seen",
    never: "Never",
    emailConfirmed: "Email confirmed",
    no: "No",
    team: "Team",
    loaded: (count: number, more: boolean) =>
      `${count}${more ? "+" : ""} ${count === 1 && !more ? "member" : "members"} loaded`,
    loadingList: "Loading…",
    reload: "Reload members",
    search: "Search by name or email",
    nobodyFound: "Nobody found",
    loadMoreToSearch: "Load more members to search among all of them.",
    checkSearch: "Check the name or email.",
    loadMore: "Load more",
    chooseMember: "Choose a member",
    chooseMemberDescription: "Their role, permissions and access show up here.",
    listHidden: "Member list hidden",
    listHiddenDescription: (permission: string) =>
      `Without the “${permission}” permission, enter the account ID of the person you want to manage.`,
    member: "Member",
    invalidAccountId: "Use the 24 hexadecimal characters of the ID.",
    noAccess: "No access to members",
    noAccessDescription: (permission: string) =>
      `Ask someone on the team for the “${permission}” permission.`,
  },
  explorer: {
    title: "Route explorer",
    description: (count: number) =>
      `Call any of the ${count} API routes and see the raw response. Returned tokens become this browser's session.`,
    noResponse: "No response",
    myAccount: "My account",
    currentSession: (device: string) => `${device} (this one)`,
    sessionReplaced:
      "This browser's session was replaced by the response tokens",
    invalidJson: (message: string) => `Invalid JSON: ${message}`,
    fillIn: (names: string) => `Fill in ${names}.`,
    sessionOf: "Session of",
    copyAccessToken: "Copy access token",
    noSession: "No session",
    filter: "Filter by method, path or text",
    noMatch: "No route matches this filter.",
    send: "Send",
    requiresSignIn: "Requires sign-in",
    public: "Public",
    body: "Body (JSON)",
    restoreExample: "Restore example",
    noStoredToken: "no stored token",
    expected: "Expected by the contract",
    unexpected: "Outside the contract",
    copyResponse: "Copy response",
    emptyBody: "Response without a body",
    noResponseYet: "No response yet",
    noResponseYetDescription: "Adjust the request and click Send.",
    history: "History",
    historyDescription: (limit: number) =>
      `The last ${limit} calls in this tab.`,
    idPlaceholder: "24 hexadecimal characters",
    suggestionsHint: "Double-click the field to see suggestions.",
    groups: routeGroups,
    routes,
    queryHints,
    rateLimit: (limit: RateLimit) =>
      `${limit.max} ${rateWindows[limit.window]} ${rateScopes[limit.scope]}`,
  },
};

export type Messages = typeof en;
