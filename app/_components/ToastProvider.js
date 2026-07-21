"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, options = {}) => {
    const variant = options.variant === "error" ? "error" : "success";
    setToast({
      message: String(message ?? ""),
      variant,
      id: Date.now(),
      actionLabel: options.actionLabel ? String(options.actionLabel) : "",
      onAction: typeof options.onAction === "function" ? options.onAction : null,
      durationMs: Number(options.durationMs) > 0 ? Number(options.durationMs) : 3200,
    });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), toast.durationMs || 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <div
          key={toast.id}
          className={`app-toast app-toast-${toast.variant}`}
          role="status"
          aria-live="polite"
        >
          <span>{toast.message}</span>
          {toast.actionLabel && toast.onAction ? (
            <button
              type="button"
              className="app-toast-action"
              onClick={() => {
                toast.onAction();
                setToast(null);
              }}
            >
              {toast.actionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: () => {},
    };
  }
  return ctx;
}
