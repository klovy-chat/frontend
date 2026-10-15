// ToastContext.tsx
// Krótki feedback po akcjach (toast).
// Zakres:
//  - kolejka sukces/błąd
//  - kolejka sukces/błąd; walidacja pól zostaje inline
// Błędy pól formularza zostaw inline, nie w toście.
// Przy zmianach: styles/common/toast.css.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { Check, CircleAlert, Info, TriangleAlert, X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  exiting?: boolean;
}

export interface ToastOptions {
  type?: ToastType;
  duration?: number;
}

interface ToastApi {
  show: (message: string, options?: ToastOptions) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION = 4200;
const EXIT_DURATION_MS = 240;

function ToastIcon({ type }: { type: ToastType }) {
  const Icon = { success: Check, error: CircleAlert, warning: TriangleAlert, info: Info }[type];
  return <Icon size={16} strokeWidth={2} />;
}

function ToastList({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  const { t } = useTranslation();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-viewport" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast--${toast.type}${toast.exiting ? " toast--exit" : ""}`}
          role={toast.type === "error" ? "alert" : "status"}
        >
          <span className="toast__icon" aria-hidden="true">
            <ToastIcon type={toast.type} />
          </span>
          <span className="toast__message">{toast.message}</span>
          <button
            type="button"
            className="toast__close"
            aria-label={t("common.close")}
            disabled={toast.exiting}
            onClick={() => onDismiss(toast.id)}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const exitTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    exitTimers.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      const autoTimer = timers.current.get(id);
      if (autoTimer) {
        clearTimeout(autoTimer);
        timers.current.delete(id);
      }

      let shouldScheduleExit = false;
      setToasts((prev) => {
        const target = prev.find((t) => t.id === id);
        if (!target || target.exiting) return prev;
        shouldScheduleExit = true;
        return prev.map((t) => (t.id === id ? { ...t, exiting: true } : t));
      });

      if (!shouldScheduleExit || exitTimers.current.has(id)) return;

      const exitTimer = setTimeout(() => removeToast(id), EXIT_DURATION_MS);
      exitTimers.current.set(id, exitTimer);
    },
    [removeToast],
  );

  const show = useCallback(
    (message: string, options?: ToastOptions) => {
      const trimmed = message.trim();
      if (!trimmed) return;

      const id = ++nextId.current;
      const type = options?.type ?? "info";
      const duration = options?.duration ?? DEFAULT_DURATION;

      setToasts((prev) => [...prev.slice(-4), { id, message: trimmed, type }]);

      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message, duration) => show(message, { type: "success", duration }),
      error: (message, duration) => show(message, { type: "error", duration }),
      info: (message, duration) => show(message, { type: "info", duration }),
      warning: (message, duration) => show(message, { type: "warning", duration }),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastList toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
