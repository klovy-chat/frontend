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
  if (type === "success") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (type === "error") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );
  }
  if (type === "warning") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
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
