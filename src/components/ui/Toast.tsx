"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Icon } from "./Icon";

interface ToastState {
  id: number;
  message: string;
  icon: string;
}

interface ToastContextValue {
  show: (message: string, icon?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 2500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, icon = "check_circle") => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const id = Date.now();
    setToast({ id, message, icon });

    timeoutRef.current = setTimeout(() => {
      setToast(null);
    }, TOAST_DURATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <div
          role="status"
          className={cn(
            "fixed top-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-on-primary shadow-xl",
            "flex items-center gap-2 font-label-md text-label-md",
          )}
        >
          <Icon name={toast.icon} size={16} />
          <span>{toast.message}</span>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
