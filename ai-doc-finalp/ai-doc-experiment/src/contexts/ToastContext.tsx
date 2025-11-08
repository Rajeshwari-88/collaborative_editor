import React, { createContext, useContext, useState, useCallback } from "react";
import Toast, { ToastProps } from "../components/common/Toast";

interface ToastContextType {
  showToast: (toast: Omit<ToastProps, "id" | "onClose">) => void;
  showVideoCallToast: (title: string, message?: string) => void;
  showSuccessToast: (title: string, message?: string) => void;
  showErrorToast: (title: string, message?: string) => void;
  showInfoToast: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

interface ToastItem extends ToastProps {
  id: string;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastProps, "id" | "onClose">) => {
      const id = `toast-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const newToast: ToastItem = {
        ...toast,
        id,
        onClose: removeToast,
      };

      setToasts((prev) => [...prev, newToast]);
    },
    [removeToast]
  );

  const showVideoCallToast = useCallback(
    (title: string, message?: string) => {
      showToast({
        type: "video-call",
        title,
        message,
        duration: 5000,
      });
    },
    [showToast]
  );

  const showSuccessToast = useCallback(
    (title: string, message?: string) => {
      showToast({
        type: "success",
        title,
        message,
        duration: 4000,
      });
    },
    [showToast]
  );

  const showErrorToast = useCallback(
    (title: string, message?: string) => {
      showToast({
        type: "error",
        title,
        message,
        duration: 6000,
      });
    },
    [showToast]
  );

  const showInfoToast = useCallback(
    (title: string, message?: string) => {
      showToast({
        type: "info",
        title,
        message,
        duration: 4000,
      });
    },
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{
        showToast,
        showVideoCallToast,
        showSuccessToast,
        showErrorToast,
        showInfoToast,
      }}
    >
      {children}

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
