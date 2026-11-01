import { useState } from "preact/hooks";

import { CheckIcon, CopyIcon } from "./icons";

export type CopyButtonProps = {
  value: string;
  label?: string;
};

const COPIED_FEEDBACK_MS = 1600;

export const CopyButton = (props: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      class={`copy-button ${copied ? "is-copied" : ""}`}
      aria-label={props.label ?? "Copiar"}
      title={props.label ?? "Copiar"}
      onClick={async () => {
        await navigator.clipboard.writeText(props.value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
      }}
    >
      {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
    </button>
  );
};
