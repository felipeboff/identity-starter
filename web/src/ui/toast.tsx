import { createContext, type ComponentChildren } from "preact";
import {
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { useMessages } from "../hooks/use-messages";
import { errorMessages } from "../services";

import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from "./icons";

export type ToastTone = "success" | "danger" | "info";

export type ToastInput = {
  tone?: ToastTone;
  title: string;
  description?: string;
};

type ToastEntry = ToastInput & {
  id: number;
};

export type ToastApi = {
  show: (toast: ToastInput) => void;
  error: (error: unknown) => void;
};

const TOAST_DURATION_MS = 4500;

const ToastContext = createContext<ToastApi | null>(null);

export type ToastProviderProps = {
  children: ComponentChildren;
};

export const ToastProvider = (props: ToastProviderProps) => {
  const t = useMessages();
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
      window.setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      error: (error) =>
        show({ tone: "danger", title: errorMessages.describe(error) }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {props.children}
      <div class="toaster" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} class={`toast toast-${toast.tone ?? "info"}`}>
            <span class="toast-icon">
              {toast.tone === "success" ? (
                <CheckIcon />
              ) : toast.tone === "danger" ? (
                <AlertIcon />
              ) : (
                <InfoIcon />
              )}
            </span>
            <div class="toast-body">
              <strong>{toast.title}</strong>
              {toast.description && <p>{toast.description}</p>}
            </div>
            <button
              type="button"
              class="toast-close"
              aria-label={t.common.close}
              onClick={() => dismiss(toast.id)}
            >
              <CloseIcon size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastApi => {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside ToastProvider");
  return api;
};
