import type { ComponentChild, ComponentChildren } from "preact";

import { Link } from "../router/router";

export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "danger" | "danger-soft" | "social";

export type ButtonSize = "md" | "sm";

export type ButtonProps = {
  children?: ComponentChildren;
  variant?: ButtonVariant;
  size?: ButtonSize;
  type?: "button" | "submit";
  pending?: boolean;
  disabled?: boolean;
  block?: boolean;
  icon?: ComponentChild;
  title?: string;
  ariaLabel?: string;
  onClick?: () => void;
};

export class ButtonStyle {
  classOf(props: ButtonProps): string {
    return [
      "btn",
      `btn-${props.variant ?? "secondary"}`,
      `btn-${props.size ?? "md"}`,
      props.block ? "btn-block" : "",
      props.pending ? "is-pending" : "",
    ]
      .filter(Boolean)
      .join(" ");
  }
}

const buttonStyle = new ButtonStyle();

export const Spinner = () => <span class="spinner" aria-hidden="true" />;

export const Button = (props: ButtonProps) => (
  <button
    type={props.type ?? "button"}
    class={buttonStyle.classOf(props)}
    disabled={props.disabled || props.pending}
    aria-busy={props.pending}
    aria-label={props.ariaLabel}
    title={props.title}
    onClick={props.onClick}
  >
    {props.pending ? <Spinner /> : props.icon}
    {props.children}
  </button>
);

export type LinkButtonProps = ButtonProps & {
  href: string;
};

export const LinkButton = (props: LinkButtonProps) => (
  <Link href={props.href} class={buttonStyle.classOf(props)}>
    {props.icon}
    {props.children}
  </Link>
);
