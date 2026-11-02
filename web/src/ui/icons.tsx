import type { ComponentChildren } from "preact";

export type IconProps = {
  size?: number;
  class?: string;
};

type StrokeIconProps = IconProps & {
  children: ComponentChildren;
};

const StrokeIcon = (props: StrokeIconProps) => (
  <svg
    width={props.size ?? 18}
    height={props.size ?? 18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class={props.class}
  >
    {props.children}
  </svg>
);

export const AsteriskLogo = (props: IconProps) => (
  <svg
    width={props.size ?? 32}
    height={props.size ?? 32}
    viewBox="0 0 32 32"
    aria-hidden="true"
    class={props.class}
  >
    <g stroke="currentColor" stroke-width="5" stroke-linecap="round">
      <path d="M16 3.5v25" />
      <path d="M5.2 9.75l21.6 12.5" />
      <path d="M5.2 22.25l21.6-12.5" />
    </g>
  </svg>
);

export const EyeIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </StrokeIcon>
);

export const EyeOffIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2" />
    <path d="M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.9 0 3.6-.6 5-1.5" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </StrokeIcon>
);

export const HomeIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M10 21v-6h4v6" />
  </StrokeIcon>
);

export const UserIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
  </StrokeIcon>
);

export const ShieldIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="M12 3 4 6v6c0 5 3.4 8.3 8 9 4.6-.7 8-4 8-9V6l-8-3z" />
    <path d="m9 12 2 2 4-4" />
  </StrokeIcon>
);

export const MailIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m3.5 7 8.5 6 8.5-6" />
  </StrokeIcon>
);

export const UsersIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
    <path d="M18 14.3c2.1.7 3.5 2.8 3.5 5.7" />
  </StrokeIcon>
);

export const KeyIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <circle cx="8" cy="15" r="4" />
    <path d="m10.8 12.2 9.2-9.2" />
    <path d="m17 6 3 3" />
    <path d="m14.5 8.5 2 2" />
  </StrokeIcon>
);

export const TerminalIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="m7 9 3 3-3 3" />
    <path d="M13 15h4" />
  </StrokeIcon>
);

export const LogOutIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 17l-5-5 5-5" />
    <path d="M5 12h11" />
  </StrokeIcon>
);

export const CheckIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </StrokeIcon>
);

export const AlertIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5" />
    <path d="M12 16.5v.01" />
  </StrokeIcon>
);

export const InfoIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5" />
    <path d="M12 7.5v.01" />
  </StrokeIcon>
);

export const MonitorIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8" />
    <path d="M12 16v4" />
  </StrokeIcon>
);

export const PhoneIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
    <path d="M11 18h2" />
  </StrokeIcon>
);

export const CopyIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </StrokeIcon>
);

export const CloseIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </StrokeIcon>
);

export const ArrowLeftIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="M19 12H5" />
    <path d="m11 6-6 6 6 6" />
  </StrokeIcon>
);

export const ArrowRightIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </StrokeIcon>
);

export const TrashIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="M4 7h16" />
    <path d="M10 11v6M14 11v6" />
    <path d="M6 7l1 13h10l1-13" />
    <path d="M9 7V4h6v3" />
  </StrokeIcon>
);

export const LinkIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
    <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
  </StrokeIcon>
);

export const RefreshIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="M20 11a8 8 0 0 0-14.6-4.5L4 8" />
    <path d="M4 3v5h5" />
    <path d="M4 13a8 8 0 0 0 14.6 4.5L20 16" />
    <path d="M20 21v-5h-5" />
  </StrokeIcon>
);

export const SendIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="M21 3 10 14" />
    <path d="M21 3 14.5 21l-4.5-7-7-4.5L21 3z" />
  </StrokeIcon>
);

export const SearchIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </StrokeIcon>
);

export const LockIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </StrokeIcon>
);

export const ClockIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </StrokeIcon>
);

export const GlobeIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" />
  </StrokeIcon>
);

export const GitHubIcon = (props: IconProps) => (
  <svg
    width={props.size ?? 18}
    height={props.size ?? 18}
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
    class={props.class}
  >
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

export const GoogleIcon = (props: IconProps) => (
  <svg
    width={props.size ?? 18}
    height={props.size ?? 18}
    viewBox="0 0 48 48"
    aria-hidden="true"
    class={props.class}
  >
    <path
      fill="#FFC107"
      d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.5z"
    />
    <path
      fill="#FF3D00"
      d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
    />
    <path
      fill="#1976D2"
      d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z"
    />
  </svg>
);
