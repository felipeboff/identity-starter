import type { ComponentChild, ComponentChildren } from "preact";
import { useRef } from "preact/hooks";

import { useAction } from "../hooks/use-action";

import { Button, type ButtonSize, type ButtonVariant } from "./button";
import { AlertIcon, InfoIcon } from "./icons";

export type ConfirmButtonProps = {
  children?: ComponentChildren;
  title: string;
  description: ComponentChildren;
  confirmLabel: string;
  tone?: "danger" | "primary";
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ComponentChild;
  ariaLabel?: string;
  disabled?: boolean;
  onConfirm: () => Promise<void>;
};

export const ConfirmButton = (props: ConfirmButtonProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const action = useAction(async () => {
    await props.onConfirm();
    dialog.current?.close();
  });
  const tone = props.tone ?? "danger";

  return (
    <>
      <Button
        variant={props.variant ?? "secondary"}
        size={props.size}
        icon={props.icon}
        ariaLabel={props.ariaLabel}
        disabled={props.disabled}
        onClick={() => dialog.current?.showModal()}
      >
        {props.children}
      </Button>
      <dialog
        ref={dialog}
        class="dialog"
        onClick={(event) => {
          if (event.target === dialog.current && !action.pending)
            dialog.current?.close();
        }}
      >
        <div class="dialog-body">
          <span class={`icon-tile icon-tile-${tone}`}>
            {tone === "danger" ? <AlertIcon /> : <InfoIcon />}
          </span>
          <h3>{props.title}</h3>
          <div class="dialog-description">{props.description}</div>
          <div class="dialog-actions">
            <Button
              variant="ghost"
              disabled={action.pending}
              onClick={() => dialog.current?.close()}
            >
              Cancelar
            </Button>
            <Button
              variant={tone === "danger" ? "danger" : "primary"}
              pending={action.pending}
              onClick={() => void action.run()}
            >
              {props.confirmLabel}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
};
